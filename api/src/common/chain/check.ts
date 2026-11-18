/**
 * Chain of Responsibility: one link in a chain of checks, like one checker in
 * an airport security line.
 *
 * Each check does ONE thing in `validate`:
 * - something is wrong → it throws a DomainError, and the chain stops there;
 * - all good → `check` hands the request to the next link.
 *
 * Adding a rule = adding a link. The other checks don't change.
 * Used by the hold checks (rules 2–6) and the checkout checks (rules 5, 8).
 */
export abstract class Check<TContext> {
  private next: Check<TContext> | null = null;

  /** Links `next` after this check, and returns it so links can be chained. */
  setNext(next: Check<TContext>): Check<TContext> {
    this.next = next;
    return next;
  }

  /** Runs this check, then the rest of the chain. */
  check(context: TContext): void {
    this.validate(context);
    this.next?.check(context);
  }

  /** The one thing this check verifies. Throws to stop the request. */
  protected abstract validate(context: TContext): void;
}

/** chainOf(a, b, c) links a → b → c and returns a, the start of the line. */
export function chainOf<TContext>(
  first: Check<TContext>,
  ...rest: Check<TContext>[]
): Check<TContext> {
  rest.reduce<Check<TContext>>(
    (previous, current) => previous.setNext(current),
    first,
  );
  return first;
}
