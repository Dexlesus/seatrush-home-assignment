import type { ErrorCode } from './error-codes.js';

/**
 * An expected business error, for example "seat B3 is already taken".
 *
 * Services throw it without knowing anything about HTTP. The exception filter
 * turns it into a response, and takes the status from the error catalog.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'DomainError';
  }
}
