import {
  generateSeats,
  isSeatInLayout,
  parseSeatLabel,
  rowLabel,
  validateZones,
  type ZoneInput,
} from './seat-map.js';

// The example event from the explanation: 3 rows (A–C), 4 seats per row.
const VIP: ZoneInput = {
  name: 'VIP',
  fromRow: 'A',
  toRow: 'A',
  priceAgorot: 30000,
};
const REGULAR: ZoneInput = {
  name: 'Regular',
  fromRow: 'B',
  toRow: 'C',
  priceAgorot: 15000,
};

describe('rowLabel: row number → letters', () => {
  it('names the first rows A, B ... Z', () => {
    expect(rowLabel(0)).toBe('A');
    expect(rowLabel(1)).toBe('B');
    expect(rowLabel(25)).toBe('Z');
  });

  it('continues after Z with two letters, like a spreadsheet: AA, AB', () => {
    expect(rowLabel(26)).toBe('AA');
    expect(rowLabel(27)).toBe('AB');
  });
});

describe('parseSeatLabel: "B7" → row and seat number', () => {
  it('reads a valid seat label', () => {
    expect(parseSeatLabel('B7')).toEqual({
      label: 'B7',
      rowIndex: 1,
      seatNumber: 7,
    });
  });

  it('accepts lowercase and returns the normal form', () => {
    expect(parseSeatLabel('b7')).toEqual({
      label: 'B7',
      rowIndex: 1,
      seatNumber: 7,
    });
  });

  it('rejects labels that are not a seat', () => {
    expect(parseSeatLabel('B0')).toBeNull(); // seats start at 1
    expect(parseSeatLabel('7B')).toBeNull(); // number before letter
    expect(parseSeatLabel('B')).toBeNull(); // no seat number
    expect(parseSeatLabel('')).toBeNull(); // empty
  });
});

describe('validateZones: every row in exactly one zone', () => {
  it('accepts zones that cover every row once', () => {
    expect(validateZones(3, [VIP, REGULAR])).toEqual([]);
  });

  it('finds a row that has no zone (a gap)', () => {
    const problems = validateZones(3, [VIP]); // rows B and C have no zone

    expect(problems.map((p) => p.code)).toEqual(['ZONES_GAP']);
    expect(problems[0]?.message).toContain('B');
  });

  it('finds a row that is in two zones (an overlap)', () => {
    const vipAndB: ZoneInput = { ...VIP, toRow: 'B' }; // A–B overlaps Regular B–C

    const problems = validateZones(3, [vipAndB, REGULAR]);

    expect(problems.map((p) => p.code)).toEqual(['ZONES_OVERLAP']);
    expect(problems[0]?.message).toContain('B');
  });

  it('rejects a zone with a row the event does not have', () => {
    const tooFar: ZoneInput = { ...REGULAR, toRow: 'D' }; // only A–C exist

    expect(validateZones(3, [VIP, tooFar]).map((p) => p.code)).toContain(
      'ZONE_ROW_OUT_OF_RANGE',
    );
  });

  it('rejects a zone that goes backwards (fromRow after toRow)', () => {
    const backwards: ZoneInput = { ...REGULAR, fromRow: 'C', toRow: 'B' };

    expect(validateZones(3, [VIP, backwards]).map((p) => p.code)).toContain(
      'ZONE_ROWS_REVERSED',
    );
  });
});

describe('generateSeats: build every seat of the event', () => {
  const seats = generateSeats(3, 4, [VIP, REGULAR]);

  it('creates rows × seats per row seats, from A1 to C4 in order', () => {
    expect(seats).toHaveLength(12);
    expect(seats.map((s) => s.label)).toEqual([
      'A1',
      'A2',
      'A3',
      'A4',
      'B1',
      'B2',
      'B3',
      'B4',
      'C1',
      'C2',
      'C3',
      'C4',
    ]);
  });

  it("gives each seat its zone's name and price", () => {
    expect(seats[0]).toMatchObject({
      label: 'A1',
      zoneName: 'VIP',
      priceAgorot: 30000,
    });
    expect(seats[11]).toMatchObject({
      label: 'C4',
      zoneName: 'Regular',
      priceAgorot: 15000,
    });
  });
});

describe('isSeatInLayout: does this seat exist in the hall?', () => {
  const layout = { rowCount: 3, seatsPerRow: 4 };

  it('accepts seats inside the hall', () => {
    expect(isSeatInLayout('A1', layout)).toBe(true);
    expect(isSeatInLayout('C4', layout)).toBe(true);
  });

  it('rejects a row or seat number outside the hall', () => {
    expect(isSeatInLayout('D1', layout)).toBe(false); // there is no row D
    expect(isSeatInLayout('A5', layout)).toBe(false); // row A has only 4 seats
    expect(isSeatInLayout('Z99', layout)).toBe(false);
  });
});
