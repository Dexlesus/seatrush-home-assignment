import { normalizeLabel, normalizeSeatRequest } from '../domain/hold-rules.js';
import type { SeatSelectionStrategy } from './seat-selection.js';

/** The fan clicked the seats: hold exactly those ("b7" → "B7"). */
export class ExplicitSeatsStrategy implements SeatSelectionStrategy {
  constructor(private readonly labels: string[]) {}

  describe(): object {
    return normalizeSeatRequest(this.labels);
  }

  chooseSeats(): Promise<string[]> {
    return Promise.resolve(this.labels.map(normalizeLabel));
  }
}
