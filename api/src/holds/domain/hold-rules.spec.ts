import {
  decideRelease,
  holdExpiresAt,
  normalizeSeatRequest,
  requestFingerprint,
} from './hold-rules.js';

const NOW = new Date('2026-11-20T10:00:00.000Z');

describe('holdExpiresAt (rule 3): a hold lasts HOLD_TTL_SECONDS', () => {
  it('ends exactly TTL seconds after now', () => {
    expect(holdExpiresAt(NOW, 300).toISOString()).toBe(
      '2026-11-20T10:05:00.000Z',
    );
  });
});

describe('requestFingerprint: is this the same request again? (Idempotency-Key)', () => {
  it('ignores the order of the seats and their case: B1,B2 = b2,B1', () => {
    const a = requestFingerprint(normalizeSeatRequest(['B1', 'B2']));
    const b = requestFingerprint(normalizeSeatRequest(['b2', 'B1']));

    expect(a).toBe(b);
  });

  it('ignores the order of keys in an object', () => {
    expect(requestFingerprint({ x: 1, y: 2 })).toBe(
      requestFingerprint({ y: 2, x: 1 }),
    );
  });

  it('is different for different seats', () => {
    const a = requestFingerprint(normalizeSeatRequest(['B1', 'B2']));
    const b = requestFingerprint(normalizeSeatRequest(['B1', 'B3']));

    expect(a).not.toBe(b);
  });
});

describe('decideRelease (rule 3): only the fan who made the hold can release it', () => {
  const ACTIVE = {
    fanId: 'dana',
    status: 'ACTIVE' as const,
    expiresAt: new Date(NOW.getTime() + 60_000),
  };

  it('lets the owner release an active hold', () => {
    expect(decideRelease(ACTIVE, 'dana', NOW)).toBe('RELEASE');
  });

  it("answers HOLD_NOT_FOUND to another fan: it doesn't even say the hold exists", () => {
    expect(() => decideRelease(ACTIVE, 'noa', NOW)).toThrow(
      expect.objectContaining({ code: 'HOLD_NOT_FOUND' }),
    );
  });

  it('refuses to release a hold that was already bought: HOLD_ALREADY_PURCHASED', () => {
    expect(() =>
      decideRelease({ ...ACTIVE, status: 'CONVERTED' }, 'dana', NOW),
    ).toThrow(expect.objectContaining({ code: 'HOLD_ALREADY_PURCHASED' }));
  });

  it('does nothing for a hold that is already over (released or expired)', () => {
    expect(decideRelease({ ...ACTIVE, status: 'RELEASED' }, 'dana', NOW)).toBe(
      'ALREADY_OVER',
    );
    expect(
      decideRelease({ ...ACTIVE, expiresAt: NOW }, 'dana', NOW), // expired right now
    ).toBe('ALREADY_OVER');
  });
});
