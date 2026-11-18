import { QueryFailedError } from 'typeorm';

/** PostgreSQL error codes we react to. Full list: postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';
const SERIALIZATION_FAILURE = '40001';
const DEADLOCK_DETECTED = '40P01';
const LOCK_NOT_AVAILABLE = '55P03'; // waited longer than lock_timeout
const QUERY_CANCELED = '57014'; // ran longer than statement_timeout

/** The PostgreSQL error code of a failed query, if it is one. */
function postgresCode(error: unknown): string | null {
  if (!(error instanceof QueryFailedError)) {
    return null;
  }
  const driverError: unknown = error.driverError;
  if (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    typeof driverError.code === 'string'
  ) {
    return driverError.code;
  }
  return null;
}

/** True when an INSERT/UPDATE broke a UNIQUE constraint ("this value already exists"). */
export function isUniqueViolation(error: unknown): boolean {
  return postgresCode(error) === UNIQUE_VIOLATION;
}

/**
 * True when PostgreSQL stopped the transaction and rolled it back: a deadlock,
 * a serialization failure, or a time limit (a lock wait or a query took too
 * long, see typeorm.config.ts). Nothing was saved, so the client can safely
 * try again. Our fixed lock order makes deadlocks very unlikely.
 */
export function isRetryableConflict(error: unknown): boolean {
  const code = postgresCode(error);
  return (
    code === DEADLOCK_DETECTED ||
    code === SERIALIZATION_FAILURE ||
    code === LOCK_NOT_AVAILABLE ||
    code === QUERY_CANCELED
  );
}
