import { loneSeatsLeft } from './lone-seats.js';

/** One row, seat 1 first: "." free, "x" taken. */
function row(seats: string): boolean[] {
  return seats.split('').map((char) => char === '.');
}

describe('loneSeatsLeft (extra credit: no lone seats)', () => {
  it('finds a seat left alone at the end of the row', () => {
    // B4, B5 sold. Taking B2–B3 leaves B1 between the wall and B2.
    expect(loneSeatsLeft(row('...xx...'), [2, 3])).toEqual([1]);
  });

  it('finds a seat left alone between two taken seats', () => {
    // Taking B1–B2 leaves B3 between B2 (now taken) and B4 (sold).
    expect(loneSeatsLeft(row('...xx...'), [1, 2])).toEqual([3]);
  });

  it('finds every lone seat, on both sides of the block', () => {
    expect(loneSeatsLeft(row('....'), [2, 3])).toEqual([1, 4]);
  });

  it('is happy when the gaps left are 2 seats or more', () => {
    expect(loneSeatsLeft(row('........'), [4, 5])).toEqual([]);
    expect(loneSeatsLeft(row('........'), [1, 2, 3, 4, 5, 6])).toEqual([]);
  });

  it('ignores seats that were already alone before this hold', () => {
    // A1 is already stuck between the wall and A2 (sold): not our fault.
    expect(loneSeatsLeft(row('.x......'), [5, 6])).toEqual([]);
  });

  it('taking the last free seat of a gap leaves nothing behind', () => {
    expect(loneSeatsLeft(row('x.x'), [2])).toEqual([]);
  });
});
