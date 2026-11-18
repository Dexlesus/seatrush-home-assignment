import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource, type EntityManager } from 'typeorm';
import { DomainError } from '../common/errors/domain-error.js';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { DbClock } from '../database/db-clock.js';
import type { FanEntity } from '../fans/fan.entity.js';
import {
  IdempotencyService,
  type IdempotentOutcome,
} from '../idempotency/idempotency.service.js';
import { holdChain } from './checks/hold-chain.js';
import type { SeatSnapshot } from './checks/hold-context.js';
import {
  decideRelease,
  holdExpiresAt,
  requestFingerprint,
  type HoldStatus,
} from './domain/hold-rules.js';
import type { HoldResponseDto, MyHoldsResponseDto } from './dto/hold.dto.js';
import {
  selectionStrategyFor,
  type HoldRequest,
  type SeatSelectionStrategy,
} from './selection/seat-selection.js';

/**
 * Rules 3–7: holding and releasing seats.
 * Every SQL statement here uses $1, $2 ... parameters: user input is never
 * pasted into SQL text.
 */
@Injectable()
export class HoldsService {
  private readonly checks = holdChain();
  private readonly ttlSeconds: number;
  private readonly maxSeatsPerFan: number;
  private readonly noLoneSeats: boolean;

  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: DbClock,
    private readonly idempotency: IdempotencyService,
    config: ConfigService<EnvironmentVariables, true>,
  ) {
    this.ttlSeconds = config.get('HOLD_TTL_SECONDS', { infer: true });
    this.maxSeatsPerFan = config.get('MAX_SEATS_PER_USER', { infer: true });
    this.noLoneSeats = config.get('NO_LONE_SEATS', { infer: true });
  }

  /** POST /api/events/:eventId/holds: hold seats, all or nothing. */
  hold(
    fan: FanEntity,
    eventId: string,
    request: HoldRequest,
    idempotencyKey: string | undefined,
  ): Promise<IdempotentOutcome<HoldResponseDto>> {
    // Strategy pattern: HOW the seats are chosen (clicked, or best available).
    const strategy = selectionStrategyFor(request);
    const fingerprint = requestFingerprint({
      action: 'hold',
      eventId,
      request: strategy.describe(),
    });

    return this.idempotency.run({
      fanId: fan.id,
      key: idempotencyKey,
      fingerprint,
      work: async (manager) => ({
        status: 201,
        body: await this.holdInTransaction(manager, fan.id, eventId, strategy),
      }),
    });
  }

  /**
   * One transaction, locks always taken in the same order (no deadlocks):
   *   1. the fan's row     → one fan's parallel requests run one at a time (rule 4)
   *   2. the seat rows, by id → one request at a time per seat (rule 6)
   * then the chain of checks, then the writes.
   */
  private async holdInTransaction(
    manager: EntityManager,
    fanId: string,
    eventId: string,
    strategy: SeatSelectionStrategy,
  ): Promise<HoldResponseDto> {
    // Lock 1: the fan.
    await manager.query('SELECT id FROM fans WHERE id = $1 FOR UPDATE', [
      fanId,
    ]);

    const event = await this.findEvent(manager, eventId);

    // Which seats? (best available locks the row of the block it picks)
    const requestedLabels = await strategy.chooseSeats({
      manager,
      eventId,
      seatsPerRow: event.seatsPerRow,
      clock: () => this.clock.now(manager),
      noLoneSeats: this.noLoneSeats,
    });

    // Lock 2: every seat in the ROWS of the requested seats, in id order.
    // The whole row, so the no-lone-seats check sees neighbours that no other
    // request can change under it. (One statement, id order: no deadlocks.)
    const rowSeats = await manager.query<SeatSnapshot[]>(
      `SELECT s.id,
              s.label,
              s.row_index    AS "rowIndex",
              s.seat_number  AS "seatNumber",
              s.status,
              s.held_until   AS "heldUntil",
              z.price_agorot AS "priceAgorot"
         FROM seats s
         JOIN zones z ON z.id = s.zone_id
        WHERE s.event_id = $1
          AND s.row_index IN (SELECT row_index FROM seats
                               WHERE event_id = $1 AND label = ANY($2::text[]))
        ORDER BY s.id
          FOR UPDATE OF s`,
      [eventId, requestedLabels],
    );
    const requested = new Set(requestedLabels);
    const seats = rowSeats.filter((seat) => requested.has(seat.label));

    // The moment of decision: read the clock AFTER every lock is ours. Any
    // time spent waiting in line counts neither against the fan's hold
    // (expiresAt starts now) nor in favour of a hold that ran out meanwhile.
    const now = await this.clock.now(manager);

    const current = await this.countFanSeats(manager, fanId, eventId, now);

    // The chain of checks (rules 2, 3, 4, 5, 6). Throws on the first problem;
    // the transaction then rolls back and nothing is held.
    this.checks.check({
      now,
      event,
      requestedLabels,
      seats,
      rowSeats,
      fanSeats: { current, limit: this.maxSeatsPerFan },
      noLoneSeats: this.noLoneSeats,
    });

    // All good: write the hold.
    const expiresAt = holdExpiresAt(now, this.ttlSeconds);
    const inserted = await manager.query<{ id: string }[]>(
      `INSERT INTO holds (event_id, fan_id, status, expires_at)
       VALUES ($1, $2, 'ACTIVE', $3)
       RETURNING id`,
      [eventId, fanId, expiresAt],
    );
    const holdId = inserted[0]?.id;
    if (!holdId) {
      throw new Error('INSERT INTO holds returned no id');
    }
    const seatIds = seats.map((seat) => seat.id);
    await manager.query(
      `INSERT INTO hold_seats (hold_id, seat_id)
       SELECT $1, unnest($2::uuid[])`,
      [holdId, seatIds],
    );
    await manager.query(
      `UPDATE seats
          SET status = 'HELD', hold_id = $1, held_until = $2
        WHERE id = ANY($3::uuid[])`,
      [holdId, expiresAt, seatIds],
    );

    return this.describeHold(manager, holdId, now);
  }

  /** DELETE /api/holds/:holdId: only the fan who made the hold can release it. */
  async release(fan: FanEntity, holdId: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query<
        { fanId: string; status: HoldStatus; expiresAt: Date }[]
      >(
        `SELECT fan_id     AS "fanId",
                status,
                expires_at AS "expiresAt"
           FROM holds
          WHERE id = $1
            FOR UPDATE`,
        [holdId],
      );
      const hold = rows[0];
      if (!hold) {
        throw new DomainError('HOLD_NOT_FOUND', "We couldn't find this hold.");
      }

      // Lock this hold's seats in id order, THEN read the clock (after every
      // wait). Only seats that still point to THIS hold are touched below.
      await manager.query(
        `SELECT id FROM seats WHERE hold_id = $1 ORDER BY id FOR UPDATE`,
        [holdId],
      );
      const now = await this.clock.now(manager);
      if (decideRelease(hold, fan.id, now) === 'ALREADY_OVER') {
        return; // expired or released: the seats may already be someone else's
      }
      await manager.query(
        `UPDATE seats
            SET status = 'AVAILABLE', hold_id = NULL, held_until = NULL
          WHERE hold_id = $1 AND status = 'HELD'`,
        [holdId],
      );
      await manager.query(
        `UPDATE holds SET status = 'RELEASED' WHERE id = $1`,
        [holdId],
      );
    });
  }

  /** GET /api/me/holds: the fan's active holds that have not expired. */
  async myHolds(fan: FanEntity): Promise<MyHoldsResponseDto> {
    const manager = this.dataSource.manager;
    const now = await this.clock.now(manager);
    const rows = await manager.query<{ id: string }[]>(
      `SELECT id FROM holds
        WHERE fan_id = $1 AND status = 'ACTIVE' AND expires_at > $2
        ORDER BY created_at`,
      [fan.id, now],
    );
    const holds = await Promise.all(
      rows.map((row) => this.describeHold(manager, row.id, now)),
    );
    return { serverNow: now.toISOString(), holds };
  }

  private async findEvent(manager: EntityManager, eventId: string) {
    const rows = await manager.query<
      { dropAt: Date; rowCount: number; seatsPerRow: number }[]
    >(
      `SELECT drop_at       AS "dropAt",
              row_count     AS "rowCount",
              seats_per_row AS "seatsPerRow"
         FROM events
        WHERE id = $1`,
      [eventId],
    );
    const event = rows[0];
    if (!event) {
      throw new DomainError('EVENT_NOT_FOUND', "This event doesn't exist.", {
        eventId,
      });
    }
    return event;
  }

  /**
   * Rule 4: seats the fan already has for this event:
   * seats in ACTIVE holds that have not expired + seats already bought.
   */
  private async countFanSeats(
    manager: EntityManager,
    fanId: string,
    eventId: string,
    now: Date,
  ): Promise<number> {
    const rows = await manager.query<{ count: string }[]>(
      `SELECT (SELECT count(*)
                 FROM hold_seats hs
                 JOIN holds h ON h.id = hs.hold_id
                WHERE h.fan_id = $1 AND h.event_id = $2
                  AND h.status = 'ACTIVE' AND h.expires_at > $3)
            + (SELECT count(*)
                 FROM order_items oi
                 JOIN orders o ON o.id = oi.order_id
                WHERE o.fan_id = $1 AND o.event_id = $2) AS count`,
      [fanId, eventId, now],
    );
    // count(*) is a bigint, which pg sends as text: parse it on purpose.
    return Number(rows[0]?.count ?? 0);
  }

  /** A hold as the API returns it: its seats, total and expiry. */
  private async describeHold(
    manager: EntityManager,
    holdId: string,
    now: Date,
  ): Promise<HoldResponseDto> {
    const holds = await manager.query<
      {
        eventId: string;
        status: HoldStatus;
        expiresAt: Date;
        createdAt: Date;
      }[]
    >(
      `SELECT event_id   AS "eventId",
              status,
              expires_at AS "expiresAt",
              created_at AS "createdAt"
         FROM holds WHERE id = $1`,
      [holdId],
    );
    const hold = holds[0];
    if (!hold) {
      throw new DomainError('HOLD_NOT_FOUND', "We couldn't find this hold.");
    }
    const seats = await manager.query<
      { label: string; zone: string; priceAgorot: number }[]
    >(
      `SELECT s.label, z.name AS zone, z.price_agorot AS "priceAgorot"
         FROM hold_seats hs
         JOIN seats s ON s.id = hs.seat_id
         JOIN zones z ON z.id = s.zone_id
        WHERE hs.hold_id = $1
        ORDER BY s.row_index, s.seat_number`,
      [holdId],
    );
    return {
      holdId,
      eventId: hold.eventId,
      status: hold.status,
      seats,
      totalAgorot: seats.reduce((sum, seat) => sum + seat.priceAgorot, 0),
      createdAt: hold.createdAt.toISOString(),
      expiresAt: hold.expiresAt.toISOString(),
      serverNow: now.toISOString(),
    };
  }
}
