import { HttpStatus } from '@nestjs/common';

/**
 * The error catalog: every code the API can send, and its HTTP status.
 * Each rule stage adds its own codes here (SEAT_TAKEN, HOLD_EXPIRED, ...).
 *
 * The web app shows a friendly message for each code, so a code must never
 * change once it's in use.
 */
export const ERROR_STATUS = {
  VALIDATION_FAILED: HttpStatus.BAD_REQUEST,
  INTERNAL_ERROR: HttpStatus.INTERNAL_SERVER_ERROR,
} as const satisfies Record<string, HttpStatus>;

/** 'VALIDATION_FAILED' | 'INTERNAL_ERROR' | ...: made from the keys above. */
export type ErrorCode = keyof typeof ERROR_STATUS;
