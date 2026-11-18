import { DomainError } from '../../common/errors/domain-error.js';
import type { SeatStatus } from '../../events/entities/seat.entity.js';
import { type CandidateSeat, findBestBlock } from '../domain/best-available.js';
import { isSeatFree } from '../domain/hold-rules.js';
import type {
  SeatSelectionStrategy,
  SelectionInput,
} from './seat-selection.js';

/** How many times to look-then-lock before falling back to locking everything. */
const QUICK_TRIES = 3;

/**
 * Rule 7: "N seats together", chosen by the server in one step.
 *
 * Quick path (almost always):
 * 1. LOOK at the seats without locking anything, and find the best block.
 * 2. LOCK only that block's row (id order), and decide again with fresh data.
 *    Still a block there? Done. The row stays locked until the hold is saved.
 * 3. Someone took it between 1 and 2? Roll back to a savepoint, which releases
 *    that row's locks, and look again.
 * So a best-available request locks one row, like a clicked hold, and doesn't
 * make holds in other rows wait for it.
 *
 * Fallback (a very busy hall, the block taken 3 times in a row): lock every
 * candidate seat in id order and pick under the lock. Slower, never wrong.
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

  async chooseSeats(input: SelectionInput): Promise<string[]> {
    const { manager } = input;
    await manager.query('SAVEPOINT best_available');

    for (let attempt = 1; attempt <= QUICK_TRIES; attempt++) {
      // 1. Look, no locks. No block even now → nothing to wait for.
      const guess = await this.pick(input, { lock: false });
      if (!guess) {
        throw this.noSeatsTogether();
      }
      // 2. Lock only that row and decide with what is true under the lock.
      const block = await this.pick(input, {
        lock: true,
        rowIndex: guess.rowIndex,
      });
      if (block) {
        return block.labels;
      }
      // 3. Taken in the meantime: free that row and look again.
      await manager.query('ROLLBACK TO SAVEPOINT best_available');
    }

    const block = await this.pick(input, { lock: true });
    if (!block) {
      throw this.noSeatsTogether();
    }
    return block.labels;
  }

  /**
   * Reads the candidate seats (only `rowIndex` if given, every row otherwise),
   * locking them in id order if `lock`, and returns the best block in them.
   */
  private async pick(
    { manager, eventId, seatsPerRow, clock, noLoneSeats }: SelectionInput,
    { lock, rowIndex }: { lock: boolean; rowIndex?: number },
  ): Promise<{ labels: string[]; rowIndex: number } | null> {
    const seats = await manager.query<
      (Omit<CandidateSeat, 'free'> & {
        status: SeatStatus;
        heldUntil: Date | null;
      })[]
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
          AND ($4::int  IS NULL OR s.row_index = $4)
        ORDER BY s.id` + (lock ? ' FOR UPDATE OF s' : ''),
      [
        eventId,
        this.request.maxPriceAgorot ?? null,
        this.request.zone ?? null,
        rowIndex ?? null,
      ],
    );
    // After the lock wait (if any): this time decides which holds ran out.
    const now = await clock();

    const labels = findBestBlock(
      seats.map((seat) => ({ ...seat, free: isSeatFree(seat, now) })),
      this.request.count,
      seatsPerRow,
      { noLoneSeats },
    );
    const first = labels?.[0];
    const row = seats.find((seat) => seat.label === first)?.rowIndex;
    return labels && row !== undefined ? { labels, rowIndex: row } : null;
  }

  private noSeatsTogether(): DomainError {
    return new DomainError(
      'NO_SEATS_TOGETHER',
      `No ${this.request.count} seats together right now. Try fewer seats, or remove a filter.`,
      { count: this.request.count },
    );
  }
}
