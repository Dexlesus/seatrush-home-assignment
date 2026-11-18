import { groupByRow, largestBlockAvailable, seatsLeftToPick } from './seats';

/** "." = available, "x" = taken; one string per row, A first. */
function map(rows: string[]) {
  return rows.flatMap((row, r) =>
    row.split('').map((char, i) => ({
      label: `${String.fromCharCode(65 + r)}${i + 1}`,
      row: String.fromCharCode(65 + r),
      seatNumber: i + 1,
      status: char === '.' ? 'AVAILABLE' : 'HELD',
    })),
  );
}

describe('largestBlockAvailable: how many seats together can a fan get right now?', () => {
  it('finds the longest run of free seats in any row', () => {
    expect(largestBlockAvailable(map(['xx..xxxx', 'x..x.xxx']))).toBe(2);
    expect(largestBlockAvailable(map(['x.......']))).toBe(7);
  });

  it('is 0 when everything is taken', () => {
    expect(largestBlockAvailable(map(['xxxx', 'xxxx']))).toBe(0);
  });

  it('does not join seats across two rows', () => {
    // A3–A4 and B1–B2 are 4 free seats, but not side by side.
    expect(largestBlockAvailable(map(['xx..', '..xx']))).toBe(2);
  });
});

describe('seatsLeftToPick: the screen never offers more than the fan may have', () => {
  it('a new fan can pick up to 4 at a time', () => {
    expect(seatsLeftToPick({ limit: 4, bought: 0, held: 0 })).toEqual({
      remaining: 4,
      canPick: 4,
    });
  });

  it('after buying 3, only 1 more', () => {
    expect(seatsLeftToPick({ limit: 4, bought: 3, held: 0 })).toEqual({
      remaining: 1,
      canPick: 1,
    });
  });

  it('held seats count too, and it never goes below 0', () => {
    expect(seatsLeftToPick({ limit: 4, bought: 2, held: 2 })).toEqual({
      remaining: 0,
      canPick: 0,
    });
    expect(seatsLeftToPick({ limit: 2, bought: 3, held: 0 }).remaining).toBe(0);
  });

  it('one hold is still at most 4 seats, even with a bigger limit', () => {
    expect(seatsLeftToPick({ limit: 6, bought: 0, held: 0 })).toEqual({
      remaining: 6,
      canPick: 4,
    });
  });
});

describe('groupByRow', () => {
  it('keeps rows in order A, B, C and seats left to right', () => {
    const rows = groupByRow(map(['..', '..']));

    expect(rows.map((r) => r.row)).toEqual(['A', 'B']);
    expect(rows[0]?.seats.map((s) => s.label)).toEqual(['A1', 'A2']);
  });
});
