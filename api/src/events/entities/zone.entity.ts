import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

/** One price zone of an event. Rows are stored as numbers: A = 0, B = 1 ... */
@Entity({ name: 'zones' })
export class ZoneEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'from_row', type: 'int' })
  fromRow: number;

  @Column({ name: 'to_row', type: 'int' })
  toRow: number;

  /** Price per seat in agorot (₪300 = 30000). Whole numbers: no rounding errors. */
  @Column({ name: 'price_agorot', type: 'int' })
  priceAgorot: number;
}
