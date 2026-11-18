import { QueryFailedError } from 'typeorm';

/** PostgreSQL error codes we react to. Full list: postgresql.org/docs/current/errcodes-appendix.html */
const UNIQUE_VIOLATION = '23505';

/** True when an INSERT/UPDATE broke a UNIQUE constraint ("this value already exists"). */
export function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError: unknown = error.driverError;
  return (
    typeof driverError === 'object' &&
    driverError !== null &&
    'code' in driverError &&
    driverError.code === UNIQUE_VIOLATION
  );
}
