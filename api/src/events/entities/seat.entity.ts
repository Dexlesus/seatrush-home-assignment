import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

export type SeatStatus = 'AVAILABLE' | 'HELD' | 'SOLD';

/** One seat of an event, like "B7". */
@Entity({ name: 'seats' })
export class SeatEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ name: 'zone_id', type: 'uuid' })
  zoneId: string;

  /** Row as a number: A = 0, B = 1 ... */
  @Column({ name: 'row_index', type: 'int' })
  rowIndex: number;

  @Column({ name: 'seat_number', type: 'int' })
  seatNumber: number;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'text', default: 'AVAILABLE' })
  status: SeatStatus;
}
