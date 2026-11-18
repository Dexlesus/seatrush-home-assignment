import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** One row of the `events` table. Column names are snake_case in SQL. */
@Entity({ name: 'events' })
export class EventEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text' })
  venue: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  /** The moment tickets go on sale (rule 2). */
  @Column({ name: 'drop_at', type: 'timestamptz' })
  dropAt: Date;

  @Column({ name: 'row_count', type: 'int' })
  rowCount: number;

  @Column({ name: 'seats_per_row', type: 'int' })
  seatsPerRow: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
