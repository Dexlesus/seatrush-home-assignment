import { makeContext, seat } from './__fixtures__/context.js';
import { SeatsExistCheck } from './seats-exist.check.js';

const check = new SeatsExistCheck();

describe('SeatsExistCheck (rule 3): every seat must exist in this hall', () => {
  it('passes when every requested seat was found', () => {
    expect(() => check.check(makeContext())).not.toThrow();
  });

  it('rejects a seat the hall does not have, and names it: SEAT_NOT_FOUND', () => {
    const context = makeContext({
      requestedLabels: ['B1', 'Z99'],
      seats: [seat('B1')], // Z99 was not found in the database
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({
        code: 'SEAT_NOT_FOUND',
        details: { seats: ['Z99'] },
      }),
    );
  });
});
