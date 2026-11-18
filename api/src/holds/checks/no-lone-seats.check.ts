import { DomainError } from '../../common/errors/domain-error.js';
import { isSeatFree } from '../domain/hold-rules.js';
import { loneSeatsLeft } from '../domain/lone-seats.js';
import { HoldCheck } from './hold-check.js';
import type { HoldContext } from './hold-context.js';

/**
 * Extra credit (on when NO_LONE_SEATS=true): reject a hold that would leave
 * one free seat stuck between two taken seats, or between a taken seat and
 * the end of the row. Every seat of those rows is locked before the chain
 * runs, so two fans can't each leave "half" of a lone seat at the same time.
 */
export class NoLoneSeatsCheck extends HoldCheck {
  protected validate({
    noLoneSeats,
    rowSeats,
    requestedLabels,
    event,
    now,
  }: HoldContext): void {
    if (!noLoneSeats) {
      return;
    }

    const requested = new Set(requestedLabels);
    const lone: string[] = [];

    for (const rowIndex of new Set(rowSeats.map((s) => s.rowIndex))) {
      const row = rowSeats.filter((s) => s.rowIndex === rowIndex);
      const bySeat = new Map(row.map((s) => [s.seatNumber, s]));
      const free = Array.from({ length: event.seatsPerRow }, (_, i) => {
        const seat = bySeat.get(i + 1);
        return seat !== undefined && isSeatFree(seat, now);
      });
      const taking = row
        .filter((s) => requested.has(s.label))
        .map((s) => s.seatNumber);

      for (const n of loneSeatsLeft(free, taking)) {
        lone.push(bySeat.get(n)?.label ?? '');
      }
    }

    if (lone.length > 0) {
      throw new DomainError(
        'LONE_SEAT',
        `This would leave ${lone.join(' and ')} on its own, and a single seat is hard to sell. Add it to your seats, or pick seats that leave 2 or more together.`,
        { seats: lone },
      );
    }
  }
}
