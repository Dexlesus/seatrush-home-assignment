import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';
import { DomainError } from '../common/errors/domain-error.js';
import { DbClock } from '../database/db-clock.js';
import type { FanEntity } from '../fans/fan.entity.js';
import {
  requestFingerprint,
  type HoldStatus,
} from '../holds/domain/hold-rules.js';
import {
  IdempotencyService,
  type IdempotentOutcome,
} from '../idempotency/idempotency.service.js';
import { checkoutChain } from './checks/checkout-checks.js';
import type { HoldToCheckOut } from './checks/checkout-context.js';
import { orderTotal } from './checks/order-total.js';
import type { MyOrdersResponseDto, OrderResponseDto } from './dto/order.dto.js';

/** Rule 8: checkout (no real payment) and "My tickets". */
@Injectable()
export class OrdersService {
  private readonly checks = checkoutChain();

  constructor(
    private readonly dataSource: DataSource,
    private readonly clock: DbClock,
    private readonly idempotency: IdempotencyService,
  ) {}

  /**
   * POST /api/holds/:holdId/checkout. One order per hold: checking out again
   * returns the same order (200), even with ten clicks at once, because the
   * hold row is locked and orders.hold_id is UNIQUE.
   */
  checkout(
    fan: FanEntity,
    holdId: string,
    idempotencyKey: string | undefined,
  ): Promise<IdempotentOutcome<OrderResponseDto>> {
    return this.idempotency.run({
      fanId: fan.id,
      key: idempotencyKey,
      fingerprint: requestFingerprint({ action: 'checkout', holdId }),
      work: (manager) => this.checkoutInTransaction(manager, fan.id, holdId),
    });
  }

  private async checkoutInTransaction(
    manager: EntityManager,
    fanId: string,
    holdId: string,
  ): Promise<{ status: number; body: OrderResponseDto }> {
    // Lock the hold: parallel checkouts of the same hold run one at a time.
    const rows = await manager.query<HoldToCheckOut[]>(
      `SELECT id,
              fan_id     AS "fanId",
              status,
              expires_at AS "expiresAt"
         FROM holds
        WHERE id = $1
          FOR UPDATE`,
      [holdId],
    );
    const hold = rows[0] ?? null;
    const now = await this.clock.now(manager);

    // Chain of Responsibility: exists → owner → not released → not expired.
    this.checks.check({ now, fanId, hold });
    if (!hold) {
      throw new DomainError('HOLD_NOT_FOUND', "We couldn't find this hold.");
    }

    // Already bought: the same order again.
    if (hold.status === 'CONVERTED') {
      return {
        status: 200,
        body: await this.describeOrder(manager, { holdId }),
      };
    }

    // Lock the hold's seats in id order, and make sure every one is still
    // held by THIS hold (defence in depth; expiry was checked above).
    const seats = await manager.query<
      {
        id: string;
        holdId: string | null;
        status: string;
        priceAgorot: number;
      }[]
    >(
      `SELECT s.id,
              s.hold_id      AS "holdId",
              s.status,
              z.price_agorot AS "priceAgorot"
         FROM hold_seats hs
         JOIN seats s ON s.id = hs.seat_id
         JOIN zones z ON z.id = s.zone_id
        WHERE hs.hold_id = $1
        ORDER BY s.id
          FOR UPDATE OF s`,
      [holdId],
    );
    if (seats.some((s) => s.holdId !== holdId || s.status !== 'HELD')) {
      throw new DomainError(
        'HOLD_EXPIRED',
        'Your hold ran out and the seats went back on sale. Try again; they might still be free.',
      );
    }

    const orders = await manager.query<{ id: string }[]>(
      `INSERT INTO orders (hold_id, fan_id, event_id, total_agorot)
       SELECT id, fan_id, event_id, $2 FROM holds WHERE id = $1
       RETURNING id`,
      [holdId, orderTotal(seats)],
    );
    const orderId = orders[0]?.id;
    if (!orderId) {
      throw new Error('INSERT INTO orders returned no id');
    }
    // order_items.seat_id is UNIQUE: the database itself refuses to sell a
    // seat twice, even if the code above had a bug.
    await manager.query(
      `INSERT INTO order_items (order_id, seat_id, price_agorot)
       SELECT $1, unnest($2::uuid[]), unnest($3::int[])`,
      [orderId, seats.map((s) => s.id), seats.map((s) => s.priceAgorot)],
    );
    await manager.query(
      `UPDATE seats SET status = 'SOLD', held_until = NULL
        WHERE id = ANY($1::uuid[])`,
      [seats.map((s) => s.id)],
    );
    await manager.query(`UPDATE holds SET status = 'CONVERTED' WHERE id = $1`, [
      holdId,
    ]);

    return {
      status: 201,
      body: await this.describeOrder(manager, { orderId }),
    };
  }

  /** GET /api/me/orders: "My tickets", newest first. */
  async myOrders(fan: FanEntity): Promise<MyOrdersResponseDto> {
    const manager = this.dataSource.manager;
    const rows = await manager.query<{ id: string }[]>(
      `SELECT id FROM orders WHERE fan_id = $1 ORDER BY created_at DESC`,
      [fan.id],
    );
    const orders = await Promise.all(
      rows.map((row) => this.describeOrder(manager, { orderId: row.id })),
    );
    return { orders };
  }

  /** An order as the API returns it, found by its id or by its hold. */
  private async describeOrder(
    manager: EntityManager,
    by: { orderId: string } | { holdId: string },
  ): Promise<OrderResponseDto> {
    const [column, value] =
      'orderId' in by ? ['o.id', by.orderId] : ['o.hold_id', by.holdId];
    const orders = await manager.query<
      {
        orderId: string;
        holdId: string;
        eventId: string;
        eventName: string;
        venue: string;
        startsAt: Date;
        totalAgorot: number;
        createdAt: Date;
        holdStatus: HoldStatus;
      }[]
    >(
      // `column` is one of two fixed strings above, never user input.
      `SELECT o.id           AS "orderId",
              o.hold_id      AS "holdId",
              o.event_id     AS "eventId",
              e.name         AS "eventName",
              e.venue,
              e.starts_at    AS "startsAt",
              o.total_agorot AS "totalAgorot",
              o.created_at   AS "createdAt"
         FROM orders o
         JOIN events e ON e.id = o.event_id
        WHERE ${column} = $1`,
      [value],
    );
    const order = orders[0];
    if (!order) {
      throw new Error('Order not found after checkout');
    }
    const seats = await manager.query<
      { label: string; zone: string; priceAgorot: number }[]
    >(
      `SELECT s.label, z.name AS zone, oi.price_agorot AS "priceAgorot"
         FROM order_items oi
         JOIN seats s ON s.id = oi.seat_id
         JOIN zones z ON z.id = s.zone_id
        WHERE oi.order_id = $1
        ORDER BY s.row_index, s.seat_number`,
      [order.orderId],
    );
    return {
      orderId: order.orderId,
      holdId: order.holdId,
      eventId: order.eventId,
      eventName: order.eventName,
      venue: order.venue,
      startsAt: order.startsAt.toISOString(),
      seats,
      totalAgorot: order.totalAgorot,
      createdAt: order.createdAt.toISOString(),
    };
  }
}
