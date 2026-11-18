export interface SeatLike {
  label: string;
  row: string;
  seatNumber: number;
  status: string;
}

/** Seats grouped by row, rows A→Z, seats left → right. */
export function groupByRow<T extends SeatLike>(
  seats: T[],
): { row: string; seats: T[] }[] {
  const rows = new Map<string, T[]>();
  for (const seat of seats) {
    rows.set(seat.row, [...(rows.get(seat.row) ?? []), seat]);
  }
  return [...rows.entries()]
    .sort(([a], [b]) => a.length - b.length || a.localeCompare(b))
    .map(([row, rowSeats]) => ({
      row,
      seats: [...rowSeats].sort((a, b) => a.seatNumber - b.seatNumber),
    }));
}

/**
 * The most seats side by side that are free right now, in any one row.
 * The screen uses it to disable "3 together" before the fan even clicks.
 * (The server still decides: someone may grab a seat in the same second.)
 */
export function largestBlockAvailable(seats: SeatLike[]): number {
  let best = 0;
  for (const { seats: rowSeats } of groupByRow(seats)) {
    let run = 0;
    let previous: number | null = null;
    for (const seat of rowSeats) {
      const adjacent = previous !== null && seat.seatNumber === previous + 1;
      run = seat.status === 'AVAILABLE' ? (adjacent ? run + 1 : 1) : 0;
      if (seat.status !== 'AVAILABLE') {
        previous = null;
        continue;
      }
      previous = seat.seatNumber;
      best = Math.max(best, run);
    }
  }
  return best;
}
