import { DomainError } from '../../common/errors/domain-error.js';
import type { SeatStatus } from '../../events/entities/seat.entity.js';
import { findBestBlock } from '../domain/best-available.js';
import { isSeatFree } from '../domain/hold-rules.js';
import type {
  SeatSelectionStrategy,
  SelectionInput,
} from './seat-selection.js';

/**
 * Rule 7: "N seats together", chosen by the server in one step.
 *
 * It LOCKS every candidate seat (same id order as every other request), then
 * picks the best block. Because the seats are locked, the block it picks is
 * still free when the hold is saved: no retry loop is needed.
 */
export class BestAvailableStrategy implements SeatSelectionStrategy {
  constructor(
    private readonly request: {
      count: number;
      maxPriceAgorot?: number;
      zone?: string;
    },
  ) {}

  describe(): object {
    return {
      bestAvailable: {
        count: this.request.count,
        maxPriceAgorot: this.request.maxPriceAgorot ?? null,
        zone: this.request.zone ?? null,
      },
    };
  }

  async chooseSeats({
    manager,
    eventId,
    seatsPerRow,
    now,
  }: SelectionInput): Promise<string[]> {
    const rows = await manager.query<
      {
        label: string;
        rowIndex: number;
        seatNumber: number;
        status: SeatStatus;
        heldUntil: Date | null;
        priceAgorot: number;
        zone: string;
      }[]
    >(
      `SELECT s.label,
              s.row_index    AS "rowIndex",
              s.seat_number  AS "seatNumber",
              s.status,
              s.held_until   AS "heldUntil",
              z.price_agorot AS "priceAgorot",
              z.name         AS zone
         FROM seats s
         JOIN zones z ON z.id = s.zone_id
        WHERE s.event_id = $1
          AND ($2::int  IS NULL OR z.price_agorot <= $2)
          AND ($3::text IS NULL OR z.name = $3)
        ORDER BY s.id
          FOR UPDATE OF s`,
      [eventId, this.request.maxPriceAgorot ?? null, this.request.zone ?? null],
    );

    const block = findBestBlock(
      rows.map((seat) => ({ ...seat, free: isSeatFree(seat, now) })),
      this.request.count,
      seatsPerRow,
    );
    if (!block) {
      throw new DomainError(
        'NO_SEATS_TOGETHER',
        `No ${this.request.count} seats together right now. Try fewer seats, or remove a filter.`,
        { count: this.request.count },
      );
    }
    return block;
  }
}
