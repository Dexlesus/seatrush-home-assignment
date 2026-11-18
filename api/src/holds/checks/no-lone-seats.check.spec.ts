import { makeContext, seat } from './__fixtures__/context.js';
import { NoLoneSeatsCheck } from './no-lone-seats.check.js';

const check = new NoLoneSeatsCheck();
const rowB = ['B1', 'B2', 'B3', 'B4'].map((label) => seat(label));

/** Row B has 4 free seats; the fan asks for `labels`. */
function asking(labels: string[], noLoneSeats = true) {
  return makeContext({
    requestedLabels: labels,
    seats: rowB.filter((s) => labels.includes(s.label)),
    rowSeats: rowB,
    noLoneSeats,
  });
}

describe('NoLoneSeatsCheck (extra credit): never leave one seat stuck alone', () => {
  it('does nothing when NO_LONE_SEATS is off', () => {
    expect(() => check.check(asking(['B2', 'B3'], false))).not.toThrow();
  });

  it('passes when the seats left over are 2 or more side by side', () => {
    expect(() => check.check(asking(['B1', 'B2']))).not.toThrow();
  });

  it('rejects a hold that leaves lone seats, and names them', () => {
    expect(() => check.check(asking(['B2', 'B3']))).toThrow(
      expect.objectContaining({
        code: 'LONE_SEAT',
        details: { seats: ['B1', 'B4'] },
      }),
    );
  });

  it('ignores a seat that was already alone', () => {
    const row = [seat('B1'), seat('B2', { status: 'SOLD' }), seat('B3'), seat('B4')];
    const context = makeContext({
      requestedLabels: ['B3', 'B4'],
      seats: row.slice(2),
      rowSeats: row,
      noLoneSeats: true,
    });

    expect(() => check.check(context)).not.toThrow();
  });

  it('checks each row on its own', () => {
    // 2 rows × 3 seats, A3 sold. A1–A2 fills row A; B2 leaves B1 and B3 alone.
    const a1 = seat('A1');
    const a2 = seat('A2');
    const b2 = seat('B2');
    const context = makeContext({
      requestedLabels: ['A1', 'A2', 'B2'],
      seats: [a1, a2, b2],
      rowSeats: [a1, a2, seat('A3', { status: 'SOLD' }), seat('B1'), b2, seat('B3')],
      event: { dropAt: new Date(0), rowCount: 2, seatsPerRow: 3 },
      noLoneSeats: true,
    });

    expect(() => check.check(context)).toThrow(
      expect.objectContaining({ details: { seats: ['B1', 'B3'] } }),
    );
  });
});
