import type { CreateEventBody } from '../api/types';

/**
 * The admin "create event" form, as plain functions (no React), so the rules
 * are unit tested. The form keeps what the person typed as text; this file
 * turns it into the API body, or explains what's wrong.
 * The server validates everything again: this only saves a round trip.
 */

export interface ZoneDraft {
  /** Only for React lists (a stable key while the admin edits). Not sent. */
  key: number;
  name: string;
  fromRow: string;
  toRow: string;
  /** In shekels, as typed: "150" or "149.90". */
  price: string;
}

export interface EventDraft {
  name: string;
  venue: string;
  /** <input type="datetime-local"> values, in the admin's own time zone. */
  startsAt: string;
  dropAt: string;
  rowCount: string;
  seatsPerRow: string;
  zones: ZoneDraft[];
}

/** 0 → "A", 25 → "Z", 26 → "AA": the same row names as the API. */
export function rowLetter(index: number): string {
  const letter = String.fromCharCode(65 + (index % 26));
  return index < 26 ? letter : `${rowLetter(Math.floor(index / 26) - 1)}${letter}`;
}

/** "149.90" → 14990. Null for anything that isn't a price (no fractions of an agora). */
export function shekelsToAgorot(text: string): number | null {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return null;
  }
  const [whole = '0', fraction = ''] = trimmed.split('.');
  return Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
}

/** A Date → "2026-11-20T10:05", the format <input type="datetime-local"> uses. */
export function toDateTimeLocal(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** A sensible start: drop in 2 minutes (to watch the countdown), show in a week. */
export function defaultDraft(now: Date): EventDraft {
  const minute = 60_000;
  return {
    name: '',
    venue: '',
    dropAt: toDateTimeLocal(new Date(now.getTime() + 2 * minute)),
    startsAt: toDateTimeLocal(new Date(now.getTime() + 7 * 24 * 60 * minute)),
    rowCount: '5',
    seatsPerRow: '8',
    zones: [
      { key: 1, name: 'VIP', fromRow: 'A', toRow: 'A', price: '300' },
      { key: 2, name: 'Regular', fromRow: 'B', toRow: 'E', price: '150' },
    ],
  };
}

function wholeNumber(text: string, min: number, max: number): number | null {
  const n = Number(text);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export function toCreateEventBody(draft: EventDraft): {
  body?: CreateEventBody;
  errors: string[];
} {
  const errors: string[] = [];
  const name = draft.name.trim();
  const venue = draft.venue.trim();
  if (!name) errors.push('Give the event a name.');
  if (!venue) errors.push('Say where it takes place.');

  const rowCount = wholeNumber(draft.rowCount, 1, 100);
  const seatsPerRow = wholeNumber(draft.seatsPerRow, 1, 100);
  if (rowCount === null) errors.push('Rows must be a whole number from 1 to 100.');
  if (seatsPerRow === null) errors.push('Seats per row must be a whole number from 1 to 100.');

  const startsAt = new Date(draft.startsAt);
  const dropAt = new Date(draft.dropAt);
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(dropAt.getTime())) {
    errors.push('Pick both dates.');
  } else if (dropAt >= startsAt) {
    errors.push('Tickets must go on sale before the show starts.');
  }

  if (draft.zones.length === 0) errors.push('Add at least one zone.');
  const zones = draft.zones.map((zone) => {
    const priceAgorot = shekelsToAgorot(zone.price);
    if (priceAgorot === null) {
      errors.push(`Zone "${zone.name}": the price must be in shekels, like 150 or 149.90.`);
    }
    return {
      name: zone.name.trim(),
      fromRow: zone.fromRow.trim().toUpperCase(),
      toRow: zone.toRow.trim().toUpperCase(),
      priceAgorot: priceAgorot ?? 0,
    };
  });

  if (errors.length > 0 || rowCount === null || seatsPerRow === null) {
    return { errors };
  }
  return {
    errors,
    body: {
      name,
      venue,
      startsAt: startsAt.toISOString(),
      dropAt: dropAt.toISOString(),
      rowCount,
      seatsPerRow,
      zones,
    },
  };
}
