/**
 * Rule 1, the seat map. Pure functions: no database, no HTTP.
 *
 * Rows are A, B, C ... (row A is nearest the stage). Seats are numbered from 1,
 * left to right, so a seat looks like "B7". Each zone covers some rows and
 * sets their price in agorot (₪1 = 100 agorot).
 *
 * Inside the code a row is a number (A = 0, B = 1 ...) because numbers are easy
 * to compare and loop over. Letters are only for people.
 */

/** A zone as the admin sends it: rows by letter, price in agorot. */
export interface ZoneInput {
  name: string;
  fromRow: string;
  toRow: string;
  priceAgorot: number;
}

/** Where a seat is: "B7" → row 1, seat 7. */
export interface SeatPosition {
  label: string;
  rowIndex: number;
  seatNumber: number;
}

/** A seat ready to be saved: its position, its zone and its price. */
export interface SeatSpec extends SeatPosition {
  zoneName: string;
  priceAgorot: number;
}

export type ZoneProblemCode =
  | 'ZONES_GAP'
  | 'ZONES_OVERLAP'
  | 'ZONE_ROW_OUT_OF_RANGE'
  | 'ZONE_ROWS_REVERSED';

export interface ZoneProblem {
  code: ZoneProblemCode;
  message: string;
}

const LETTERS_IN_ALPHABET = 26;
const CODE_OF_A = 'A'.charCodeAt(0); // 65

/**
 * 0 → "A", 25 → "Z", 26 → "AA", 27 → "AB", like spreadsheet columns.
 * Works like counting in base 26, where the "digits" are A–Z.
 */
export function rowLabel(index: number): string {
  let label = '';
  let n = index + 1;
  while (n > 0) {
    const letter = (n - 1) % LETTERS_IN_ALPHABET;
    label = String.fromCharCode(CODE_OF_A + letter) + label;
    n = Math.floor((n - 1) / LETTERS_IN_ALPHABET);
  }
  return label;
}

/** The opposite of rowLabel: "A" → 0, "AA" → 26. Not a row label → null. */
export function rowIndexOf(label: string): number | null {
  const letters = label.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(letters)) {
    return null;
  }
  let n = 0;
  for (const char of letters) {
    n = n * LETTERS_IN_ALPHABET + (char.charCodeAt(0) - CODE_OF_A + 1);
  }
  return n - 1;
}

/** Letters, then a number that doesn't start with 0: "B7" yes, "B0" / "B07" no. */
const SEAT_LABEL = /^([A-Z]+)([1-9]\d*)$/;

/** "B7" (or "b7") → { label: "B7", rowIndex: 1, seatNumber: 7 }. Not a seat → null. */
export function parseSeatLabel(raw: string): SeatPosition | null {
  const match = SEAT_LABEL.exec(raw.trim().toUpperCase());
  if (!match) {
    return null;
  }
  const [, letters = '', digits = ''] = match;
  const rowIndex = rowIndexOf(letters);
  if (rowIndex === null) {
    return null;
  }
  return { label: `${letters}${digits}`, rowIndex, seatNumber: Number(digits) };
}

/** Does this seat exist in a hall of this size? */
export function isSeatInLayout(
  label: string,
  layout: { rowCount: number; seatsPerRow: number },
): boolean {
  const seat = parseSeatLabel(label);
  return (
    seat !== null &&
    seat.rowIndex < layout.rowCount &&
    seat.seatNumber <= layout.seatsPerRow
  );
}

/**
 * Every row must be in exactly one zone, or its seats would have no price
 * (or two prices). Returns every problem found; an empty list means valid.
 */
export function validateZones(
  rowCount: number,
  zones: ZoneInput[],
): ZoneProblem[] {
  const problems: ZoneProblem[] = [];
  const lastRow = rowLabel(rowCount - 1);

  // For each row, the names of the zones that cover it.
  const zonesOfRow: string[][] = Array.from({ length: rowCount }, () => []);

  for (const zone of zones) {
    const from = rowIndexOf(zone.fromRow);
    const to = rowIndexOf(zone.toRow);

    if (from === null || to === null || from >= rowCount || to >= rowCount) {
      problems.push({
        code: 'ZONE_ROW_OUT_OF_RANGE',
        message: `Zone "${zone.name}" uses rows ${zone.fromRow}–${zone.toRow}, but this event only has rows A–${lastRow}.`,
      });
      continue;
    }
    if (from > to) {
      problems.push({
        code: 'ZONE_ROWS_REVERSED',
        message: `Zone "${zone.name}" goes from row ${zone.fromRow} back to row ${zone.toRow}. Put the row nearer the stage first.`,
      });
      continue;
    }
    for (let row = from; row <= to; row++) {
      zonesOfRow[row]?.push(zone.name);
    }
  }

  const overlapping = rowsWhere(zonesOfRow, (names) => names.length > 1);
  if (overlapping.length > 0) {
    problems.push({
      code: 'ZONES_OVERLAP',
      message: `Rows ${overlapping.join(', ')} are in more than one zone. Each row needs exactly one price.`,
    });
  }

  const uncovered = rowsWhere(zonesOfRow, (names) => names.length === 0);
  if (uncovered.length > 0) {
    problems.push({
      code: 'ZONES_GAP',
      message: `Rows ${uncovered.join(', ')} are not in any zone, so their seats would have no price.`,
    });
  }

  return problems;
}

/** The labels of the rows whose zone list matches the test. */
function rowsWhere(
  zonesOfRow: string[][],
  test: (names: string[]) => boolean,
): string[] {
  return zonesOfRow.flatMap((names, row) =>
    test(names) ? [rowLabel(row)] : [],
  );
}

/**
 * Builds every seat of the event, row by row, left to right: A1, A2 ... C4.
 * Call it only with zones that passed validateZones.
 */
export function generateSeats(
  rowCount: number,
  seatsPerRow: number,
  zones: ZoneInput[],
): SeatSpec[] {
  const seats: SeatSpec[] = [];

  for (let rowIndex = 0; rowIndex < rowCount; rowIndex++) {
    const zone = zones.find((z) => {
      const from = rowIndexOf(z.fromRow) ?? -1;
      const to = rowIndexOf(z.toRow) ?? -1;
      return rowIndex >= from && rowIndex <= to;
    });
    if (!zone) {
      throw new Error(
        `Row ${rowLabel(rowIndex)} has no zone. Validate zones first.`,
      );
    }

    for (let seatNumber = 1; seatNumber <= seatsPerRow; seatNumber++) {
      seats.push({
        label: `${rowLabel(rowIndex)}${seatNumber}`,
        rowIndex,
        seatNumber,
        zoneName: zone.name,
        priceAgorot: zone.priceAgorot,
      });
    }
  }

  return seats;
}
