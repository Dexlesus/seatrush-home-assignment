import type { MigrationInterface, QueryRunner } from 'typeorm';

/** Fans: identified by a unique handle like "dana#4821". No passwords. */
export class CreateFans1763424100000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      CREATE TABLE fans (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        display_name text        NOT NULL CHECK (length(display_name) BETWEEN 2 AND 20),
        -- The referee for handles: two fans can never get the same one,
        -- even when they sign up at the same moment.
        handle       text        NOT NULL CONSTRAINT fans_handle_unique UNIQUE,
        created_at   timestamptz NOT NULL DEFAULT now()
      )
    `);
  }

  async down(db: QueryRunner): Promise<void> {
    await db.query('DROP TABLE fans');
  }
}
