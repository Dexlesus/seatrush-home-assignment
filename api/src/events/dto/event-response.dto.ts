import { ApiProperty } from '@nestjs/swagger';
import type { SeatStatus } from '../entities/seat.entity.js';

export class ZoneResponseDto {
  @ApiProperty({ example: 'VIP' })
  name: string;

  @ApiProperty({ example: 'A' })
  fromRow: string;

  @ApiProperty({ example: 'A' })
  toRow: string;

  @ApiProperty({ example: 30000, description: 'Price per seat in agorot.' })
  priceAgorot: number;
}

/** What the events list shows for each event. */
export class EventSummaryDto {
  @ApiProperty({ example: '7f3a2c9e-1b4d-4c8a-9e2f-0a1b2c3d4e5f' })
  id: string;

  @ApiProperty({ example: 'Coldplay' })
  name: string;

  @ApiProperty({ example: 'Bloomfield Stadium' })
  venue: string;

  @ApiProperty({ example: '2026-12-01T20:00:00.000Z' })
  startsAt: string;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  dropAt: string;

  @ApiProperty({
    example: false,
    description: 'True once dropAt has passed (by the server clock).',
  })
  saleOpen: boolean;
}

export class EventListResponseDto {
  @ApiProperty({
    example: '2026-11-18T09:56:00.000Z',
    description:
      "The server's clock. Count down from this, not from the fan's own clock.",
  })
  serverNow: string;

  @ApiProperty({ type: [EventSummaryDto], description: 'Soonest drop first.' })
  events: EventSummaryDto[];
}

export class EventResponseDto {
  @ApiProperty({ example: '7f3a2c9e-1b4d-4c8a-9e2f-0a1b2c3d4e5f' })
  id: string;

  @ApiProperty({
    example: false,
    description: 'True once dropAt has passed (by the server clock).',
  })
  saleOpen: boolean;

  @ApiProperty({ example: '2026-11-18T09:56:00.000Z' })
  serverNow: string;

  @ApiProperty({ example: 'Coldplay' })
  name: string;

  @ApiProperty({ example: 'Bloomfield Stadium' })
  venue: string;

  @ApiProperty({ example: '2026-12-01T20:00:00.000Z' })
  startsAt: string;

  @ApiProperty({ example: '2026-11-20T10:00:00.000Z' })
  dropAt: string;

  @ApiProperty({ example: 3 })
  rowCount: number;

  @ApiProperty({ example: 4 })
  seatsPerRow: number;

  @ApiProperty({ type: [ZoneResponseDto] })
  zones: ZoneResponseDto[];
}

export class SeatResponseDto {
  @ApiProperty({ example: 'B7' })
  label: string;

  @ApiProperty({ example: 'B' })
  row: string;

  @ApiProperty({ example: 7 })
  seatNumber: number;

  @ApiProperty({ example: 'VIP' })
  zone: string;

  @ApiProperty({ example: 30000 })
  priceAgorot: number;

  @ApiProperty({ enum: ['AVAILABLE', 'HELD', 'SOLD'], example: 'AVAILABLE' })
  status: SeatStatus;
}

export class SeatMapResponseDto {
  @ApiProperty({ example: '7f3a2c9e-1b4d-4c8a-9e2f-0a1b2c3d4e5f' })
  eventId: string;

  @ApiProperty({ example: '2026-11-18T09:56:00.000Z' })
  serverNow: string;

  @ApiProperty({
    type: [SeatResponseDto],
    description: 'Row by row (A first), left to right.',
  })
  seats: SeatResponseDto[];
}
