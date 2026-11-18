import { makeContext } from './__fixtures__/context.js';
import { FanLimitCheck } from './fan-limit.check.js';

const check = new FanLimitCheck();

describe('FanLimitCheck (rule 4): at most MAX_SEATS_PER_USER seats per fan per event', () => {
  it('allows 4 new seats when the fan has none and the limit is 4', () => {
    const context = makeContext({
      requestedLabels: ['A1', 'A2', 'A3', 'A4'],
      fanSeats: { current: 0, limit: 4 },
    });

    expect(() => check.check(context)).not.toThrow();
  });

  it('refuses 2 more seats when the fan already has 3 of 4, and says how many are left', () => {
    const context = makeContext({
      requestedLabels: ['B1', 'B2'],
      fanSeats: { current: 3, limit: 4 },
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({
        code: 'FAN_LIMIT_REACHED',
        details: { limit: 4, current: 3, remaining: 1 },
      }),
    );
  });

  it('allows exactly reaching the limit (3 + 1 = 4)', () => {
    const context = makeContext({
      requestedLabels: ['B1'],
      fanSeats: { current: 3, limit: 4 },
    });

    expect(() => check.check(context)).not.toThrow();
  });

  it('refuses any seat once the fan is at the limit, with a clear message', () => {
    const context = makeContext({
      requestedLabels: ['B1'],
      fanSeats: { current: 4, limit: 4 },
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({
        code: 'FAN_LIMIT_REACHED',
        message: expect.stringContaining('already have 4 seats'),
      }),
    );
  });

  it('uses the configured limit, not a fixed 4 (MAX_SEATS_PER_USER=2)', () => {
    const context = makeContext({
      requestedLabels: ['B1', 'B2', 'B3'],
      fanSeats: { current: 0, limit: 2 },
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({
        code: 'FAN_LIMIT_REACHED',
        details: { limit: 2, current: 0, remaining: 2 },
      }),
    );
  });
});
