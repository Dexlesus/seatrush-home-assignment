/**
 * Extra credit: no lone seats. A pure function, one row at a time.
 *
 * A seat is "lone" when it is free but both of its sides are blocked: a taken
 * seat or the end of the row. Nobody buys one seat stuck between strangers, so
 * the hall would end up with empty seats that never sell.
 *
 * @param free   the row, seat 1 first: true = free right now
 * @param taking the seat numbers (1-based) this hold wants to take
 * @returns the seat numbers this hold would leave alone. Seats that were
 *          ALREADY alone before the hold are not counted (the brief's rule).
 */
export function loneSeatsLeft(free: boolean[], taking: number[]): number[] {
  const takingSet = new Set(taking);
  // Seat n (1-based) is free before / after the hold. Outside the row = wall.
  const before = (n: number) => free[n - 1] === true;
  const after = (n: number) => before(n) && !takingSet.has(n);

  const isLone = (isFree: (n: number) => boolean, n: number) =>
    isFree(n) && !isFree(n - 1) && !isFree(n + 1);

  const lone: number[] = [];
  for (let n = 1; n <= free.length; n++) {
    if (isLone(after, n) && !isLone(before, n)) {
      lone.push(n);
    }
  }
  return lone;
}
