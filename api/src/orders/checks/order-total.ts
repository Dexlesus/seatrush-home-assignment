/** Rule 8: an order costs the sum of its seats, in whole agorot. */
export function orderTotal(seats: { priceAgorot: number }[]): number {
  return seats.reduce((sum, seat) => sum + seat.priceAgorot, 0);
}
