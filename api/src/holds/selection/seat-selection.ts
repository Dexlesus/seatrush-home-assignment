import type { EntityManager } from 'typeorm';
import { DomainError } from '../../common/errors/domain-error.js';
import { BestAvailableStrategy } from './best-available.strategy.js';
import { ExplicitSeatsStrategy } from './explicit-seats.strategy.js';

/** What a fan can ask for: exact seats, or "N seats together". */
export interface HoldRequest {
  seats?: string[];
  bestAvailable?: {
    count: number;
    maxPriceAgorot?: number;
    zone?: string;
  };
}

export interface SelectionInput {
  manager: EntityManager;
  eventId: string;
  seatsPerRow: number;
  now: Date;
}

/**
 * Strategy pattern: HOW the seats of a hold are chosen.
 * Everything after the choice (locks, checks, saving) is the same for every
 * strategy, so a new way of choosing seats is one new class.
 */
export interface SeatSelectionStrategy {
  /** The request in canonical form, for the Idempotency-Key fingerprint. */
  describe(): object;
  /** Picks the seat labels to hold. Runs inside the hold transaction. */
  chooseSeats(input: SelectionInput): Promise<string[]>;
}

/** Picks the strategy that matches the request. Exactly one kind is allowed. */
export function selectionStrategyFor(
  request: HoldRequest,
): SeatSelectionStrategy {
  const hasSeats = request.seats !== undefined;
  const hasBest = request.bestAvailable !== undefined;

  if (hasSeats && !hasBest) {
    return new ExplicitSeatsStrategy(request.seats ?? []);
  }
  if (hasBest && !hasSeats && request.bestAvailable) {
    return new BestAvailableStrategy(request.bestAvailable);
  }
  throw new DomainError(
    'INVALID_HOLD_REQUEST',
    'Send either "seats" (the seats you picked) or "bestAvailable" (N seats together), not both.',
  );
}
