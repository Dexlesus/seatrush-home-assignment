import { errorCode, friendlyError } from './errors';

/** An API error as RTK Query hands it to us. */
function apiError(status: number, code: string, details: object = {}) {
  return { status, data: { statusCode: status, code, message: 'raw', details } };
}

describe('friendlyError: errors read like people talk, not like "Error 409"', () => {
  it('names the seat someone just took', () => {
    expect(friendlyError(apiError(409, 'SEAT_TAKEN', { seats: ['B3'] }))).toBe(
      'Someone just took B3. Pick other seats, or try "best available".',
    );
    expect(
      friendlyError(apiError(409, 'SEAT_TAKEN', { seats: ['B3', 'B4'] })),
    ).toContain('B3 and B4');
  });

  it('says how many seats are left under the per-fan limit', () => {
    expect(
      friendlyError(
        apiError(409, 'FAN_LIMIT_REACHED', { limit: 4, current: 3, remaining: 1 }),
      ),
    ).toBe('You can have up to 4 seats for this show. You have 3, so you can add 1 more.');
    expect(
      friendlyError(
        apiError(409, 'FAN_LIMIT_REACHED', { limit: 4, current: 4, remaining: 0 }),
      ),
    ).toBe('You already have 4 seats for this show, the most one fan can have.');
  });

  it('explains an expired hold kindly, with what to do next', () => {
    expect(friendlyError(apiError(410, 'HOLD_EXPIRED'))).toContain(
      'they might still be free',
    );
  });

  it('explains a lone seat and promo code problems in plain words', () => {
    expect(friendlyError(apiError(409, 'LONE_SEAT', { seats: ['B1'] }))).toBe(
      'That would leave B1 on its own, and a single seat is hard to sell. Add it, or pick seats that leave 2 or more together.',
    );
    expect(friendlyError(apiError(400, 'PROMO_CODE_UNKNOWN', { promoCode: 'FREE' }))).toBe(
      '"FREE" isn\'t a code we know. Check the spelling, or check out without it.',
    );
    expect(friendlyError(apiError(409, 'PROMO_CODE_USED', { promoCode: 'WELCOME20' }))).toBe(
      'You already used WELCOME20 on an earlier order. Remove it and check out, or try SAVE10.',
    );
  });

  it('turns a network failure into a calm message', () => {
    expect(friendlyError({ status: 'FETCH_ERROR', error: 'TypeError' })).toBe(
      "We can't reach the server right now. Check your connection and try again.",
    );
  });

  it("falls back to the server's own message for codes it doesn't know", () => {
    expect(
      friendlyError({ status: 418, data: { code: 'SOMETHING_NEW', message: 'A new problem.' } }),
    ).toBe('A new problem.');
    expect(friendlyError(undefined)).toBe('');
  });

  it('reads the error code, for decisions in the UI', () => {
    expect(errorCode(apiError(409, 'SEAT_TAKEN'))).toBe('SEAT_TAKEN');
    expect(errorCode({ status: 'FETCH_ERROR', error: 'x' })).toBeNull();
  });
});
