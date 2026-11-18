import { DomainError } from '../../common/errors/domain-error.js';
import { normalizeLabel } from '../domain/hold-rules.js';
import { HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/** Rule 1/3: every requested seat must exist in this event's hall. */
export class SeatsExistCheck extends HoldCheck {
  protected validate({ requestedLabels, seats }: HoldContext): void {
    const found = new Set(seats.map((seat) => seat.label));
    const missing = requestedLabels
      .map(normalizeLabel)
      .filter((label) => !found.has(label));

    if (missing.length > 0) {
      throw new DomainError(
        'SEAT_NOT_FOUND',
        `Seat ${missing.join(', ')} doesn't exist in this venue.`,
        { seats: missing },
      );
    }
  }
}
