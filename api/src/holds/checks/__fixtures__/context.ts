import type { HoldContext, SeatSnapshot } from '../hold-context.js';

/** Test helper: a valid hold context (sale open, B1–B3 free), with overrides. */
export const NOW = new Date('2026-11-20T10:05:00.000Z');

export function seat(
  label: string,
  overrides: Partial<SeatSnapshot> = {},
): SeatSnapshot {
  return {
    id: `seat-${label}`,
    label,
    status: 'AVAILABLE',
    heldUntil: null,
    priceAgorot: 10000,
    ...overrides,
  };
}

export function makeContext(overrides: Partial<HoldContext> = {}): HoldContext {
  return {
    now: NOW,
    event: {
      dropAt: new Date('2026-11-20T10:00:00.000Z'),
      rowCount: 3,
      seatsPerRow: 4,
    },
    requestedLabels: ['B1', 'B2', 'B3'],
    seats: [seat('B1'), seat('B2'), seat('B3')],
    fanSeats: { current: 0, limit: 4 },
    ...overrides,
  };
}
