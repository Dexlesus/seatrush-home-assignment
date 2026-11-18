import { chainOf, HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';
import { SaleOpenCheck } from './sale-open.check.js';

/** Tickets go on sale at exactly 10:00:00. */
const DROP = new Date('2026-11-20T10:00:00.000Z');

function at(time: string): HoldContext {
  return { now: new Date(`2026-11-20T${time}.000Z`), event: { dropAt: DROP } };
}

/** A checker that only remembers whether it was reached. */
class NextCheck extends HoldCheck {
  reached = false;
  protected validate(): void {
    this.reached = true;
  }
}

describe('SaleOpenCheck (rule 2): nobody can hold seats before the drop', () => {
  it('stops a request 2 minutes before the drop with SALE_NOT_OPEN', () => {
    expect(() => new SaleOpenCheck().check(at('09:58:00'))).toThrow(
      expect.objectContaining({
        code: 'SALE_NOT_OPEN',
        details: { opensAt: '2026-11-20T10:00:00.000Z', secondsLeft: 120 },
      }),
    );
  });

  it('lets a request through at exactly the drop time', () => {
    expect(() => new SaleOpenCheck().check(at('10:00:00'))).not.toThrow();
  });

  it('lets a request through after the drop', () => {
    expect(() => new SaleOpenCheck().check(at('10:01:00'))).not.toThrow();
  });

  it('when the sale is open, passes the request on to the next check', () => {
    const next = new NextCheck();

    chainOf(new SaleOpenCheck(), next).check(at('10:00:01'));

    expect(next.reached).toBe(true);
  });

  it('when the sale is closed, the next check is never reached', () => {
    const next = new NextCheck();

    expect(() =>
      chainOf(new SaleOpenCheck(), next).check(at('09:59:59')),
    ).toThrow();
    expect(next.reached).toBe(false);
  });
});
