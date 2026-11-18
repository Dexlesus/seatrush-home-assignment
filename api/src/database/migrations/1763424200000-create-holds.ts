import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rules 3–6: holds, which seats each hold has, who holds a seat until when,
 * and Idempotency-Keys.
 */
export class CreateHolds1763424200000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      CREATE TABLE holds (
        id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        event_id   uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        fan_id     uuid        NOT NULL REFERENCES fans (id) ON DELETE CASCADE,
        status     text        NOT NULL DEFAULT 'ACTIVE'
                               CHECK (status IN ('ACTIVE', 'RELEASED', 'CONVERTED')),
        -- From this moment the hold is over (rule 5), with or without cleanup.
        expires_at timestamptz NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )
    `);
    // Rule 4 counts a fan's seats per event.
    await db.query(
      'CREATE INDEX holds_fan_event_idx ON holds (fan_id, event_id)',
    );

    await db.query(`
      CREATE TABLE hold_seats (
        hold_id uuid NOT NULL REFERENCES holds (id) ON DELETE CASCADE,
        seat_id uuid NOT NULL REFERENCES seats (id) ON DELETE CASCADE,
        PRIMARY KEY (hold_id, seat_id)
      )
    `);
    await db.query('CREATE INDEX hold_seats_seat_idx ON hold_seats (seat_id)');

    // Who holds the seat right now, and until when. A HELD seat whose
    // held_until has passed counts as AVAILABLE: no cleanup job needed.
    await db.query(`
      ALTER TABLE seats
        ADD COLUMN hold_id    uuid REFERENCES holds (id) ON DELETE SET NULL,
        ADD COLUMN held_until timestamptz,
        ADD CONSTRAINT seats_held_has_hold
            CHECK (status <> 'HELD' OR (hold_id IS NOT NULL AND held_until IS NOT NULL))
    `);
    await db.query('CREATE INDEX seats_hold_id_idx ON seats (hold_id)');

    // Idempotency-Key: one row per (fan, key). The PRIMARY KEY makes a second
    // request with the same key wait for the first one, then replay its answer.
    await db.query(`
      CREATE TABLE idempotency_keys (
        fan_id        uuid        NOT NULL REFERENCES fans (id) ON DELETE CASCADE,
        key           text        NOT NULL CHECK (length(key) BETWEEN 1 AND 100),
        request_hash  text        NOT NULL,
        status_code   int,
        response_body jsonb,
        created_at    timestamptz NOT NULL DEFAULT now(),
        PRIMARY KEY (fan_id, key)
      )
    `);
  }

  async down(db: QueryRunner): Promise<void> {
    await db.query('DROP TABLE idempotency_keys');
    await db.query(`
      ALTER TABLE seats
        DROP CONSTRAINT seats_held_has_hold,
        DROP COLUMN held_until,
        DROP COLUMN hold_id
    `);
    await db.query('DROP TABLE hold_seats');
    await db.query('DROP TABLE holds');
  }
}
