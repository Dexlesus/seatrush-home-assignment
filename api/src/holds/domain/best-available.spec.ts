import { findBestBlock, type CandidateSeat } from './best-available.js';

/**
 * Builds a hall: `rows` is one string per row, A first; each character is one
 * seat from left to right: "." free, "x" taken. Prices per row are optional.
 */
function hall(rows: string[], prices: number[] = []): CandidateSeat[] {
  return rows.flatMap((row, rowIndex) =>
    row.split('').map((char, i) => ({
      label: `${String.fromCharCode(65 + rowIndex)}${i + 1}`,
      rowIndex,
      seatNumber: i + 1,
      free: char === '.',
      priceAgorot: prices[rowIndex] ?? 10000,
      zone: rowIndex === 0 ? 'VIP' : 'Regular',
    })),
  );
}

describe('findBestBlock (rule 7): N seats together, best first', () => {
  it("solves the brief's example: row A full, B4 and B5 sold, N = 2 → B2–B3", () => {
    const seats = hall(['xxxxxxxx', '...xx...', '........']);

    expect(findBestBlock(seats, 2, 8)).toEqual(['B2', 'B3']);
  });

  it('prefers the row nearest the stage, even if a later row is more central', () => {
    const seats = hall(['..xxxxxx', '........']); // only A1–A2 free in row A

    expect(findBestBlock(seats, 2, 8)).toEqual(['A1', 'A2']);
  });

  it('in an empty row, picks the block whose middle is the middle of the row', () => {
    expect(findBestBlock(hall(['........']), 2, 8)).toEqual(['A4', 'A5']);
    expect(findBestBlock(hall(['.........']), 3, 9)).toEqual([
      'A4',
      'A5',
      'A6',
    ]);
  });

  it('on a tie, picks the lower first seat number', () => {
    // 8 seats, N = 1, A4 and A5 are equally central (middle is 4.5).
    expect(findBestBlock(hall(['........']), 1, 8)).toEqual(['A4']);
  });

  it('skips seats that are not candidates (filtered out by max price or zone)', () => {
    const seats = hall(['........', '........'], [30000, 10000]).filter(
      (seat) => seat.priceAgorot <= 15000, // max price ₪150: row A is too expensive
    );

    expect(findBestBlock(seats, 2, 8)).toEqual(['B4', 'B5']);
  });

  it('returns null when no N free seats are side by side anywhere', () => {
    const seats = hall(['.x.x.x.x', 'x.x.x.x.']);

    expect(findBestBlock(seats, 2, 8)).toBeNull();
  });

  it('returns null when N is bigger than a whole row', () => {
    expect(findBestBlock(hall(['....']), 5, 4)).toBeNull();
  });
});
