import type { HoldContext, SeatSnapshot } from '../hold-context.js';

/** Test helper: a valid hold context (sale open, B1–B3 free), with overrides. */
export const NOW = new Date('2026-11-20T10:05:00.000Z');

/** "B3" → row 1, seat 3 (single-letter rows are enough for the tests). */
export function seat(
  label: string,
  overrides: Partial<SeatSnapshot> = {},
): SeatSnapshot {
  return {
    id: `seat-${label}`,
    label,
    rowIndex: label.charCodeAt(0) - 65,
    seatNumber: Number(label.slice(1)),
    status: 'AVAILABLE',
    heldUntil: null,
    priceAgorot: 10000,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<HoldContext> = {}): HoldContext {
  const rowB = [seat('B1'), seat('B2'), seat('B3'), seat('B4')];
  return {
    now: NOW,
    event: {
      dropAt: new Date('2026-11-20T10:00:00.000Z'),
      rowCount: 3,
      seatsPerRow: 4,
    },
    requestedLabels: ['B1', 'B2', 'B3'],
    seats: rowB.slice(0, 3),
    rowSeats: rowB,
    fanSeats: { current: 0, limit: 4 },
    noLoneSeats: false,
    ...overrides,
  };
}
