import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/** A fan: the name they typed and their unique handle, like "dana#4821". */
@Entity({ name: 'fans' })
export class FanEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** What the fan typed, for display: "Dana". Can repeat between fans. */
  @Column({ name: 'display_name', type: 'text' })
  displayName: string;

  /** Unique, never reused: it owns the fan's holds and orders. */
  @Column({ type: 'text', unique: true })
  handle: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
