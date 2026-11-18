import { DomainError } from '../../common/errors/domain-error.js';
import { HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/** Rule 2: before the drop time, nobody can hold seats. */
export class SaleOpenCheck extends HoldCheck {
  protected validate({ now, event }: HoldContext): void {
    // `<`, not `<=`: at exactly the drop time the sale is open.
    if (now.getTime() < event.dropAt.getTime()) {
      const secondsLeft = Math.ceil(
        (event.dropAt.getTime() - now.getTime()) / 1000,
      );
      throw new DomainError(
        'SALE_NOT_OPEN',
        "Tickets aren't on sale yet. Stay on this page; the button unlocks by itself.",
        { opensAt: event.dropAt.toISOString(), secondsLeft },
      );
    }
  }
}
