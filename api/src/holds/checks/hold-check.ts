import type { HoldContext } from './hold-context.js';

/**
 * Chain of Responsibility: one link of the chain of checks a hold request
 * must pass, like one checker in an airport security line.
 *
 * Each check does ONE thing in `validate`:
 * - something is wrong → it throws a DomainError, and the chain stops there;
 * - all good → `check` hands the request to the next link.
 *
 * Adding a rule = adding a link. The other checks don't change.
 */
export abstract class HoldCheck {
  private next: HoldCheck | null = null;

  /** Links `next` after this check, and returns it so links can be chained. */
  setNext(next: HoldCheck): HoldCheck {
    this.next = next;
    return next;
  }

  /** Runs this check, then the rest of the chain. */
  check(context: HoldContext): void {
    this.validate(context);
    this.next?.check(context);
  }

  /** The one thing this check verifies. Throws to stop the request. */
  protected abstract validate(context: HoldContext): void;
}

/** chainOf(a, b, c) links a → b → c and returns a, the start of the line. */
export function chainOf(first: HoldCheck, ...rest: HoldCheck[]): HoldCheck {
  rest.reduce((previous, current) => previous.setNext(current), first);
  return first;
}
