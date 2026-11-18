import { DomainError } from '../../common/errors/domain-error.js';
import { normalizeLabel } from '../domain/hold-rules.js';
import { HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/** Rule 3: one request holds 1 to 4 seats. */
export const MAX_SEATS_PER_HOLD = 4;

/** Rule 3: 1–4 seats per request, and no seat asked for twice. */
export class SeatCountCheck extends HoldCheck {
  protected validate({ requestedLabels }: HoldContext): void {
    const count = requestedLabels.length;
    if (count < 1 || count > MAX_SEATS_PER_HOLD) {
      throw new DomainError(
        'INVALID_SEAT_COUNT',
        `Pick between 1 and ${MAX_SEATS_PER_HOLD} seats.`,
        { requested: count, min: 1, max: MAX_SEATS_PER_HOLD },
      );
    }

    const seen = new Set<string>();
    const duplicates = new Set<string>();
    for (const label of requestedLabels.map(normalizeLabel)) {
      if (seen.has(label)) {
        duplicates.add(label);
      }
      seen.add(label);
    }
    if (duplicates.size > 0) {
      const seats = [...duplicates];
      throw new DomainError(
        'DUPLICATE_SEATS',
        `You picked ${seats.join(', ')} more than once.`,
        { seats },
      );
    }
  }
}
