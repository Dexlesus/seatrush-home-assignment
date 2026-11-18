import { DomainError } from '../../common/errors/domain-error.js';
import { isSeatFree } from '../domain/hold-rules.js';
import { HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/**
 * Rules 3, 5 and 6: ALL requested seats must be free, or nothing is held.
 * The seat rows are locked (SELECT ... FOR UPDATE) before this check runs, so
 * no other request can change them between this check and the write.
 */
export class SeatsAvailableCheck extends HoldCheck {
  protected validate({ seats, now }: HoldContext): void {
    const taken = seats
      .filter((seat) => !isSeatFree(seat, now))
      .map((seat) => seat.label);

    if (taken.length > 0) {
      throw new DomainError(
        'SEAT_TAKEN',
        `Someone just took ${joinLabels(taken)}.`,
        { seats: taken },
      );
    }
  }
}

/** ["B2"] → "B2"; ["B2", "B3"] → "B2 and B3"; ["A1","A2","A3"] → "A1, A2 and A3". */
function joinLabels(labels: string[]): string {
  if (labels.length === 1) {
    return labels[0] ?? '';
  }
  return `${labels.slice(0, -1).join(', ')} and ${labels.at(-1) ?? ''}`;
}
