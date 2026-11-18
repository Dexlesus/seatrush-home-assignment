/**
 * Rule 7: "N seats together". A pure function: give it the candidate seats
 * (already filtered by max price / zone), get back the best block or null.
 */
export interface CandidateSeat {
  label: string;
  rowIndex: number;
  seatNumber: number;
  /** Free right now (AVAILABLE, or HELD with an expired hold). */
  free: boolean;
  priceAgorot: number;
  zone: string;
}

/**
 * Chooses N side-by-side free seats in one row, in this order:
 * 1. the row nearest the stage (row A first);
 * 2. the block whose middle is closest to the middle of the row;
 * 3. the lower first seat number.
 *
 * Example (brief): 8 seats, row A full, B4/B5 sold, N=2.
 * Row middle = (8+1)/2 = 4.5. Block B2–B3 has middle 2.5 (distance 2),
 * B6–B7 has middle 6.5 (distance 2): a tie, so the lower first seat wins → B2–B3.
 */
export function findBestBlock(
  seats: CandidateSeat[],
  count: number,
  seatsPerRow: number,
): string[] | null {
  if (count < 1 || count > seatsPerRow) {
    return null;
  }

  // Row index → seat number → the seat, for quick "is seat k free?" lookups.
  const rows = new Map<number, Map<number, CandidateSeat>>();
  for (const seat of seats) {
    const row = rows.get(seat.rowIndex) ?? new Map<number, CandidateSeat>();
    row.set(seat.seatNumber, seat);
    rows.set(seat.rowIndex, row);
  }

  const rowMiddle = (seatsPerRow + 1) / 2;
  const nearestRowFirst = [...rows.keys()].sort((a, b) => a - b);

  for (const rowIndex of nearestRowFirst) {
    const row = rows.get(rowIndex) ?? new Map<number, CandidateSeat>();
    let best: { first: number; distance: number } | null = null;

    for (let first = 1; first + count - 1 <= seatsPerRow; first++) {
      if (!isFreeBlock(row, first, count)) {
        continue;
      }
      const blockMiddle = first + (count - 1) / 2;
      const distance = Math.abs(blockMiddle - rowMiddle);
      // Strictly smaller only: on a tie the earlier (lower) first seat stays.
      if (best === null || distance < best.distance) {
        best = { first, distance };
      }
    }

    if (best !== null) {
      const { first } = best;
      return Array.from(
        { length: count },
        (_, i) => row.get(first + i)?.label ?? '',
      );
    }
  }
  return null;
}

function isFreeBlock(
  row: Map<number, CandidateSeat>,
  first: number,
  count: number,
): boolean {
  for (let n = first; n < first + count; n++) {
    if (!row.get(n)?.free) {
      return false;
    }
  }
  return true;
}
