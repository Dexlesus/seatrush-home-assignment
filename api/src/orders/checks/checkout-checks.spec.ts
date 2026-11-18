import { checkoutChain } from './checkout-checks.js';
import type { CheckoutContext, HoldToCheckOut } from './checkout-context.js';
import { orderTotal } from './order-total.js';

const NOW = new Date('2026-11-20T10:03:00.000Z');

const ACTIVE_HOLD: HoldToCheckOut = {
  id: 'hold-1',
  fanId: 'dana',
  status: 'ACTIVE',
  expiresAt: new Date('2026-11-20T10:05:00.000Z'),
};

/** Dana checks out at 10:03; the hold (if any) has the given overrides. */
function context(hold: HoldToCheckOut | null): CheckoutContext {
  return { now: NOW, fanId: 'dana', hold };
}

describe('checkout chain (rules 5 and 8): who can check out, and when', () => {
  const chain = checkoutChain();

  it('lets the owner check out an active hold', () => {
    expect(() => chain.check(context(ACTIVE_HOLD))).not.toThrow();
  });

  it('answers 404 HOLD_NOT_FOUND for a hold that does not exist', () => {
    expect(() => chain.check(context(null))).toThrow(
      expect.objectContaining({ code: 'HOLD_NOT_FOUND' }),
    );
  });

  it('refuses another fan: NOT_YOUR_HOLD', () => {
    expect(() =>
      chain.check(context({ ...ACTIVE_HOLD, fanId: 'noa' })),
    ).toThrow(expect.objectContaining({ code: 'NOT_YOUR_HOLD' }));
  });

  it('refuses a released hold: HOLD_RELEASED', () => {
    expect(() =>
      chain.check(context({ ...ACTIVE_HOLD, status: 'RELEASED' })),
    ).toThrow(expect.objectContaining({ code: 'HOLD_RELEASED' }));
  });

  it('refuses a hold from the exact moment it expires, cleanup or not: HOLD_EXPIRED', () => {
    expect(() =>
      chain.check(context({ ...ACTIVE_HOLD, expiresAt: NOW })),
    ).toThrow(expect.objectContaining({ code: 'HOLD_EXPIRED' }));
  });

  it('lets an already-bought hold through, so checkout returns the same order again', () => {
    const bought: HoldToCheckOut = {
      ...ACTIVE_HOLD,
      status: 'CONVERTED',
      expiresAt: new Date(0), // long expired, but already bought: still fine
    };

    expect(() => chain.check(context(bought))).not.toThrow();
  });
});

describe('orderTotal (rule 8): the price of an order', () => {
  it('adds up the seat prices, in agorot', () => {
    expect(orderTotal([{ priceAgorot: 30000 }, { priceAgorot: 15000 }])).toBe(
      45000,
    );
  });

  it('is 0 for no seats', () => {
    expect(orderTotal([])).toBe(0);
  });
});
