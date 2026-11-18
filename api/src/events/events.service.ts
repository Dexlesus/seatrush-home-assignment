import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DomainError } from '../common/errors/domain-error.js';
import {
  generateSeats,
  rowIndexOf,
  rowLabel,
  validateZones,
} from './domain/seat-map.js';
import type { CreateEventDto } from './dto/create-event.dto.js';
import type {
  EventResponseDto,
  SeatMapResponseDto,
} from './dto/event-response.dto.js';
import { EventEntity } from './entities/event.entity.js';
import type { SeatStatus } from './entities/seat.entity.js';
import { SeatEntity } from './entities/seat.entity.js';
import { ZoneEntity } from './entities/zone.entity.js';

/** Seats are inserted in batches, so one INSERT never gets too big. */
const SEAT_INSERT_BATCH = 1000;

@Injectable()
export class EventsService {
  constructor(private readonly dataSource: DataSource) {}

  /** Rule 1: create an event with its zones and every one of its seats. */
  async create(dto: CreateEventDto): Promise<EventResponseDto> {
    // 1. Check the rules that need more than one field.
    if (new Date(dto.dropAt) >= new Date(dto.startsAt)) {
      throw new DomainError(
        'INVALID_EVENT_TIMES',
        'Tickets must go on sale (dropAt) before the show starts (startsAt).',
      );
    }
    const problems = validateZones(dto.rowCount, dto.zones);
    const [firstProblem] = problems;
    if (firstProblem) {
      throw new DomainError(
        firstProblem.code,
        problems.map((p) => p.message).join(' '),
        { problems },
      );
    }

    // 2. Build every seat in memory (pure logic, already unit tested).
    const seats = generateSeats(dto.rowCount, dto.seatsPerRow, dto.zones);

    // 3. Save everything in ONE transaction: the event, its zones and its
    //    seats are saved together, or nothing is saved at all.
    return this.dataSource.transaction(async (manager) => {
      const event = await manager.save(
        manager.create(EventEntity, {
          name: dto.name,
          venue: dto.venue,
          startsAt: new Date(dto.startsAt),
          dropAt: new Date(dto.dropAt),
          rowCount: dto.rowCount,
          seatsPerRow: dto.seatsPerRow,
        }),
      );

      const zones = await manager.save(
        dto.zones.map((zone) =>
          manager.create(ZoneEntity, {
            eventId: event.id,
            name: zone.name,
            fromRow: rowIndexOf(zone.fromRow) ?? 0,
            toRow: rowIndexOf(zone.toRow) ?? 0,
            priceAgorot: zone.priceAgorot,
          }),
        ),
      );
      const zoneIdByName = new Map(zones.map((zone) => [zone.name, zone.id]));

      for (let i = 0; i < seats.length; i += SEAT_INSERT_BATCH) {
        const batch = seats.slice(i, i + SEAT_INSERT_BATCH);
        await manager.insert(
          SeatEntity,
          batch.map((seat) => ({
            eventId: event.id,
            zoneId: zoneIdByName.get(seat.zoneName) ?? '',
            rowIndex: seat.rowIndex,
            seatNumber: seat.seatNumber,
            label: seat.label,
            status: 'AVAILABLE' as const,
          })),
        );
      }

      return toEventResponse(event, zones);
    });
  }

  /** The event and its zones, or 404 EVENT_NOT_FOUND. */
  async findOne(eventId: string): Promise<EventResponseDto> {
    const event = await this.getEventOrThrow(eventId);
    const zones = await this.dataSource.getRepository(ZoneEntity).find({
      where: { eventId },
      order: { fromRow: 'ASC' },
    });
    return toEventResponse(event, zones);
  }

  /** Every seat of the event, row by row, with its zone, price and status. */
  async seatMap(eventId: string): Promise<SeatMapResponseDto> {
    await this.getEventOrThrow(eventId);

    const rows = await this.dataSource.query<
      {
        label: string;
        rowIndex: number;
        seatNumber: number;
        zone: string;
        priceAgorot: number;
        status: SeatStatus;
      }[]
    >(
      `SELECT s.label,
              s.row_index    AS "rowIndex",
              s.seat_number  AS "seatNumber",
              z.name         AS zone,
              z.price_agorot AS "priceAgorot",
              s.status
         FROM seats s
         JOIN zones z ON z.id = s.zone_id
        WHERE s.event_id = $1
        ORDER BY s.row_index, s.seat_number`,
      [eventId],
    );

    return {
      eventId,
      seats: rows.map((seat) => ({
        label: seat.label,
        row: rowLabel(seat.rowIndex),
        seatNumber: seat.seatNumber,
        zone: seat.zone,
        priceAgorot: seat.priceAgorot,
        status: seat.status,
      })),
    };
  }

  private async getEventOrThrow(eventId: string): Promise<EventEntity> {
    const event = await this.dataSource
      .getRepository(EventEntity)
      .findOneBy({ id: eventId });
    if (!event) {
      throw new DomainError('EVENT_NOT_FOUND', "This event doesn't exist.", {
        eventId,
      });
    }
    return event;
  }
}

/** Database rows → the JSON the API sends. Rows go back to letters. */
function toEventResponse(
  event: EventEntity,
  zones: ZoneEntity[],
): EventResponseDto {
  return {
    id: event.id,
    name: event.name,
    venue: event.venue,
    startsAt: event.startsAt.toISOString(),
    dropAt: event.dropAt.toISOString(),
    rowCount: event.rowCount,
    seatsPerRow: event.seatsPerRow,
    zones: zones.map((zone) => ({
      name: zone.name,
      fromRow: rowLabel(zone.fromRow),
      toRow: rowLabel(zone.toRow),
      priceAgorot: zone.priceAgorot,
    })),
  };
}
