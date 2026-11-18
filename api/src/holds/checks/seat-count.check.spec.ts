import { makeContext } from './__fixtures__/context.js';
import { SeatCountCheck } from './seat-count.check.js';

const check = new SeatCountCheck();

describe('SeatCountCheck (rule 3): 1 to 4 seats, each one once', () => {
  it('rejects a request with no seats: INVALID_SEAT_COUNT', () => {
    expect(() => check.check(makeContext({ requestedLabels: [] }))).toThrow(
      expect.objectContaining({ code: 'INVALID_SEAT_COUNT' }),
    );
  });

  it('rejects 5 seats in one request: INVALID_SEAT_COUNT', () => {
    const five = ['A1', 'A2', 'A3', 'A4', 'B1'];

    expect(() => check.check(makeContext({ requestedLabels: five }))).toThrow(
      expect.objectContaining({ code: 'INVALID_SEAT_COUNT' }),
    );
  });

  it('accepts exactly 1 and exactly 4 seats (the edges)', () => {
    expect(() =>
      check.check(makeContext({ requestedLabels: ['A1'] })),
    ).not.toThrow();
    expect(() =>
      check.check(makeContext({ requestedLabels: ['A1', 'A2', 'A3', 'A4'] })),
    ).not.toThrow();
  });

  it('rejects the same seat twice, even in different case: DUPLICATE_SEATS', () => {
    expect(() =>
      check.check(makeContext({ requestedLabels: ['B7', 'b7'] })),
    ).toThrow(
      expect.objectContaining({
        code: 'DUPLICATE_SEATS',
        details: { seats: ['B7'] },
      }),
    );
  });
});
