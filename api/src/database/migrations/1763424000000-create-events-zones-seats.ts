import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rule 1: events, their price zones, and their seats.
 * Hand-written SQL, so every constraint is visible and reviewed.
 * The hold columns of `seats` come later, in their own migration (rule 3).
 */
export class CreateEventsZonesSeats1763424000000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      CREATE TABLE events (
        id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        name          text        NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
        venue         text        NOT NULL CHECK (length(venue) BETWEEN 1 AND 200),
        starts_at     timestamptz NOT NULL,
        drop_at       timestamptz NOT NULL,
        row_count     int         NOT NULL CHECK (row_count BETWEEN 1 AND 100),
        seats_per_row int         NOT NULL CHECK (seats_per_row BETWEEN 1 AND 100),
        created_at    timestamptz NOT NULL DEFAULT now(),
        -- Tickets go on sale before the show starts.
        CONSTRAINT events_drop_before_start CHECK (drop_at < starts_at)
      )
    `);

    await db.query(`
      CREATE TABLE zones (
        id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id     uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        name         text NOT NULL CHECK (length(name) BETWEEN 1 AND 50),
        from_row     int  NOT NULL CHECK (from_row >= 0),
        to_row       int  NOT NULL,
        price_agorot int  NOT NULL CHECK (price_agorot >= 0),
        CONSTRAINT zones_rows_in_order CHECK (from_row <= to_row),
        CONSTRAINT zones_name_unique_per_event UNIQUE (event_id, name)
      )
    `);

    await db.query(`
      CREATE TABLE seats (
        id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id    uuid NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        zone_id     uuid NOT NULL REFERENCES zones (id) ON DELETE CASCADE,
        row_index   int  NOT NULL CHECK (row_index >= 0),
        seat_number int  NOT NULL CHECK (seat_number >= 1),
        label       text NOT NULL,
        status      text NOT NULL DEFAULT 'AVAILABLE'
                    CHECK (status IN ('AVAILABLE', 'HELD', 'SOLD')),
        -- One "B7" per event. Also the index for "all seats of an event".
        CONSTRAINT seats_label_unique_per_event UNIQUE (event_id, label),
        CONSTRAINT seats_position_unique_per_event UNIQUE (event_id, row_index, seat_number)
      )
    `);
  }

  async down(db: QueryRunner): Promise<void> {
    await db.query('DROP TABLE seats');
    await db.query('DROP TABLE zones');
    await db.query('DROP TABLE events');
  }
}
