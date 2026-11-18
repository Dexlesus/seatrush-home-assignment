import { validateEnv } from './env.validation.js';

describe('validateEnv', () => {
  it('uses the default for every missing variable', () => {
    const env = validateEnv({});

    expect(env).toMatchObject({
      DB_HOST: 'localhost',
      DB_PORT: 55432,
      DB_USER: 'seatrush',
      DB_PASSWORD: 'seatrush',
      DB_NAME: 'seatrush',
      HOLD_TTL_SECONDS: 300,
      MAX_SEATS_PER_USER: 4,
      PORT: 3000,
    });
  });

  it('turns number strings from the environment into real numbers', () => {
    // Environment variables are always strings: "2", never 2.
    const env = validateEnv({
      HOLD_TTL_SECONDS: '2',
      MAX_SEATS_PER_USER: '6',
      PORT: '4000',
    });

    expect(env.HOLD_TTL_SECONDS).toBe(2);
    expect(env.MAX_SEATS_PER_USER).toBe(6);
    expect(env.PORT).toBe(4000);
  });

  it('rejects a hold time that is not a whole number', () => {
    expect(() => validateEnv({ HOLD_TTL_SECONDS: 'abc' })).toThrow(
      /HOLD_TTL_SECONDS/,
    );
    expect(() => validateEnv({ HOLD_TTL_SECONDS: '2.5' })).toThrow(
      /HOLD_TTL_SECONDS/,
    );
  });

  it('rejects zero or negative values for the business rules', () => {
    expect(() => validateEnv({ MAX_SEATS_PER_USER: '0' })).toThrow(
      /MAX_SEATS_PER_USER/,
    );
    expect(() => validateEnv({ HOLD_TTL_SECONDS: '-5' })).toThrow(
      /HOLD_TTL_SECONDS/,
    );
  });

  it('reports every invalid variable at once, not only the first one', () => {
    expect(() =>
      validateEnv({ HOLD_TTL_SECONDS: 'abc', PORT: '99999' }),
    ).toThrow(/HOLD_TTL_SECONDS[\s\S]*PORT/);
  });
});
