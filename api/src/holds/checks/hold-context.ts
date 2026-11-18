import type { SeatStatus } from '../../events/entities/seat.entity.js';

/** A seat as it is in the database right now (row already locked). */
export interface SeatSnapshot {
  id: string;
  label: string;
  status: SeatStatus;
  /** When the current hold on it ends; null if nobody holds it. */
  heldUntil: Date | null;
  priceAgorot: number;
}

/**
 * Everything the hold checks need to decide, loaded BEFORE the chain runs,
 * inside the transaction and after the row locks. The checks only read it:
 * no database calls inside a check, so each check is a small pure function.
 */
export interface HoldContext {
  /** "Now" from the DATABASE clock, the one clock all API copies share. */
  now: Date;
  event: {
    /** When tickets go on sale (rule 2). */
    dropAt: Date;
    rowCount: number;
    seatsPerRow: number;
  };
  /** The seat labels the fan asked for, normalized ("b7" → "B7"). */
  requestedLabels: string[];
  /** The requested seats that exist, as locked in the database. */
  seats: SeatSnapshot[];
  /** Rule 4: seats the fan already has for this event, and the limit. */
  fanSeats: {
    current: number;
    limit: number;
  };
}
