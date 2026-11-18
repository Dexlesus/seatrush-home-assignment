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

  // Rule 3: holding and releasing seats (+ Idempotency-Key).
  INVALID_HOLD_REQUEST: HttpStatus.BAD_REQUEST,
  INVALID_SEAT_COUNT: HttpStatus.BAD_REQUEST,
  DUPLICATE_SEATS: HttpStatus.BAD_REQUEST,
  SEAT_NOT_FOUND: HttpStatus.BAD_REQUEST,
  SEAT_TAKEN: HttpStatus.CONFLICT,
  HOLD_NOT_FOUND: HttpStatus.NOT_FOUND,
  HOLD_ALREADY_PURCHASED: HttpStatus.CONFLICT,
  INVALID_IDEMPOTENCY_KEY: HttpStatus.BAD_REQUEST,
  IDEMPOTENCY_KEY_REUSED: HttpStatus.UNPROCESSABLE_ENTITY,

  // Rule 4: per-fan limit.
  FAN_LIMIT_REACHED: HttpStatus.CONFLICT,

  // Rule 5 / 8: checkout.
  NOT_YOUR_HOLD: HttpStatus.FORBIDDEN,
  HOLD_RELEASED: HttpStatus.CONFLICT,
  HOLD_EXPIRED: HttpStatus.GONE,

  // Rule 6: the database asked us to retry (deadlock / serialization).
  BUSY_TRY_AGAIN: HttpStatus.SERVICE_UNAVAILABLE,

  // Rule 7: best available.
  NO_SEATS_TOGETHER: HttpStatus.CONFLICT,
} as const satisfies Record<string, HttpStatus>;

/** 'VALIDATION_FAILED' | 'INTERNAL_ERROR' | ...: made from the keys above. */
export type ErrorCode = keyof typeof ERROR_STATUS;
