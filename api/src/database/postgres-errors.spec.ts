import { QueryFailedError } from 'typeorm';
import { isRetryableConflict, isUniqueViolation } from './postgres-errors.js';

/** A database error like the pg driver throws it, with a PostgreSQL code. */
function pgError(code: string): QueryFailedError {
  return new QueryFailedError(
    'SELECT 1',
    [],
    Object.assign(new Error('pg'), { code }),
  );
}

describe('postgres errors (rule 6): the database is the last line of defence', () => {
  it('recognises a UNIQUE violation (23505), e.g. a seat sold twice in order_items', () => {
    expect(isUniqueViolation(pgError('23505'))).toBe(true);
  });

  it('does not mistake other database errors for a UNIQUE violation', () => {
    expect(isUniqueViolation(pgError('23503'))).toBe(false); // foreign key
    expect(isUniqueViolation(new Error('not a database error'))).toBe(false);
  });

  it('recognises a deadlock (40P01) as "try again"', () => {
    expect(isRetryableConflict(pgError('40P01'))).toBe(true);
  });

  it('recognises a serialization failure (40001) as "try again"', () => {
    expect(isRetryableConflict(pgError('40001'))).toBe(true);
  });

  it('does not ask to retry ordinary errors', () => {
    expect(isRetryableConflict(pgError('23505'))).toBe(false);
    expect(isRetryableConflict(new Error('boom'))).toBe(false);
  });
});
