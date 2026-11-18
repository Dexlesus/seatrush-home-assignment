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

  // Rule 1: creating an event and reading its seat map.
  INVALID_EVENT_TIMES: HttpStatus.BAD_REQUEST,
  ZONES_GAP: HttpStatus.BAD_REQUEST,
  ZONES_OVERLAP: HttpStatus.BAD_REQUEST,
  ZONE_ROW_OUT_OF_RANGE: HttpStatus.BAD_REQUEST,
  ZONE_ROWS_REVERSED: HttpStatus.BAD_REQUEST,
  EVENT_NOT_FOUND: HttpStatus.NOT_FOUND,

  // Fans: identity by handle ("dana#4821"), no passwords.
  INVALID_NAME: HttpStatus.BAD_REQUEST,
  FAN_NOT_FOUND: HttpStatus.NOT_FOUND,
  IDENTITY_REQUIRED: HttpStatus.UNAUTHORIZED,
  UNKNOWN_FAN: HttpStatus.UNAUTHORIZED,

  // Rule 2: before the drop time, nobody can hold seats.
  SALE_NOT_OPEN: HttpStatus.FORBIDDEN,
} as const satisfies Record<string, HttpStatus>;

/** 'VALIDATION_FAILED' | 'INTERNAL_ERROR' | ...: made from the keys above. */
export type ErrorCode = keyof typeof ERROR_STATUS;
