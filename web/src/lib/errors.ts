import type { SerializedError } from '@reduxjs/toolkit';
import type { FetchBaseQueryError } from '@reduxjs/toolkit/query';

/**
 * The API sends every error as { code, message, details }. Fans should never
 * see "Error 409": this turns each code into a sentence with a next step.
 */
type AnyError = FetchBaseQueryError | SerializedError | undefined | unknown;

interface ApiErrorBody {
  code?: string;
  message?: string;
  details?: Record<string, unknown>;
}

function bodyOf(error: AnyError): ApiErrorBody | null {
  if (
    typeof error === 'object' &&
    error !== null &&
    'data' in error &&
    typeof error.data === 'object' &&
    error.data !== null
  ) {
    return error.data as ApiErrorBody;
  }
  return null;
}

/** The API's error code ("SEAT_TAKEN"), or null for network errors. */
export function errorCode(error: AnyError): string | null {
  return bodyOf(error)?.code ?? null;
}

/** ["B3"] → "B3", ["B3","B4"] → "B3 and B4", ["A1","A2","A3"] → "A1, A2 and A3". */
export function joinSeats(seats: unknown): string {
  const list = Array.isArray(seats) ? seats.map(String) : [];
  if (list.length <= 1) {
    return list[0] ?? 'that seat';
  }
  return `${list.slice(0, -1).join(', ')} and ${list.at(-1) ?? ''}`;
}

export function friendlyError(error: AnyError): string {
  if (error === undefined || error === null) {
    return '';
  }
  if (typeof error === 'object' && 'status' in error) {
    // FETCH_ERROR: no network. PARSING_ERROR: the proxy answered with an HTML
    // error page (e.g. 502 when the API is down), not with our JSON.
    if (error.status === 'FETCH_ERROR' || error.status === 'PARSING_ERROR') {
      return "We can't reach the server right now. Check your connection and try again.";
    }
    if (error.status === 'TIMEOUT_ERROR') {
      return 'The server is slow right now. Please try again in a moment.';
    }
  }

  const body = bodyOf(error);
  const details = body?.details ?? {};
  switch (body?.code) {
    case 'SEAT_TAKEN':
      return `Someone just took ${joinSeats(details.seats)}. Pick other seats, or try "best available".`;
    case 'SALE_NOT_OPEN':
      return "Tickets aren't on sale yet. Stay on this page; the button unlocks by itself.";
    case 'FAN_LIMIT_REACHED': {
      const { limit, current, remaining } = details as {
        limit?: number;
        current?: number;
        remaining?: number;
      };
      return remaining === 0
        ? `You already have ${current} seats for this show, the most one fan can have.`
        : `You can have up to ${limit} seats for this show. You have ${current}, so you can add ${remaining} more.`;
    }
    case 'INVALID_SEAT_COUNT':
      return 'Pick between 1 and 4 seats.';
    case 'DUPLICATE_SEATS':
      return 'You picked the same seat twice.';
    case 'SEAT_NOT_FOUND':
      return `Seat ${joinSeats(details.seats)} doesn't exist in this venue.`;
    case 'NO_SEATS_TOGETHER':
      return `No ${String(details.count ?? '')} seats together right now. Try fewer seats, or remove a filter.`;
    case 'LONE_SEAT':
      return `That would leave ${joinSeats(details.seats)} on its own, and a single seat is hard to sell. Add it, or pick seats that leave 2 or more together.`;
    case 'PROMO_CODE_UNKNOWN':
      return `"${String(details.promoCode ?? '')}" isn't a code we know. Check the spelling, or check out without it.`;
    case 'PROMO_CODE_USED':
      return `You already used ${String(details.promoCode ?? 'this code')} on an earlier order. Remove it and check out, or try SAVE10.`;
    case 'HOLD_EXPIRED':
      return 'Your hold ran out and the seats went back on sale. Try again; they might still be free.';
    case 'HOLD_RELEASED':
      return 'You released these seats.';
    case 'NOT_YOUR_HOLD':
      return 'This hold belongs to another fan.';
    case 'HOLD_NOT_FOUND':
      return "We couldn't find this hold. It may have been released.";
    case 'IDENTITY_REQUIRED':
    case 'UNKNOWN_FAN':
      return 'Please pick a username first.';
    case 'BUSY_TRY_AGAIN':
      return 'Lots of fans are clicking right now. Please try again in a second.';
    case 'EVENT_NOT_FOUND':
      return "This event doesn't exist.";
    default:
      return body?.message ?? 'Something went wrong. Please try again.';
  }
}
