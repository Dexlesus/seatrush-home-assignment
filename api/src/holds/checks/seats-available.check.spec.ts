import { makeContext, NOW, seat } from './__fixtures__/context.js';
import { SeatsAvailableCheck } from './seats-available.check.js';

const check = new SeatsAvailableCheck();
const IN_ONE_MINUTE = new Date(NOW.getTime() + 60_000);
const ONE_MINUTE_AGO = new Date(NOW.getTime() - 60_000);

describe('SeatsAvailableCheck (rule 3): all or nothing', () => {
  it('passes when every seat is free', () => {
    expect(() => check.check(makeContext())).not.toThrow();
  });

  it('one taken seat out of 3 stops the whole hold, and only that seat is named', () => {
    const context = makeContext({
      seats: [
        seat('B1'),
        seat('B2', { status: 'HELD', heldUntil: IN_ONE_MINUTE }), // someone holds B2
        seat('B3'),
      ],
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({
        code: 'SEAT_TAKEN',
        message: 'Someone just took B2.',
        details: { seats: ['B2'] },
      }),
    );
  });

  it('treats a sold seat as taken', () => {
    const context = makeContext({
      seats: [seat('B1'), seat('B2'), seat('B3', { status: 'SOLD' })],
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({
        code: 'SEAT_TAKEN',
        details: { seats: ['B3'] },
      }),
    );
  });

  it('treats a seat whose hold has expired as free (rule 5)', () => {
    const context = makeContext({
      seats: [
        seat('B1'),
        seat('B2', { status: 'HELD', heldUntil: ONE_MINUTE_AGO }), // expired
        seat('B3'),
      ],
    });

    expect(() => check.check(context)).not.toThrow();
  });
});
