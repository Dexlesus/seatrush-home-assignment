import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Rule 8: orders. Two UNIQUE constraints are the database's own guarantee,
 * even if application code had a bug:
 * - orders_one_per_hold:       one order per hold;
 * - order_items_seat_sold_once: a seat can be sold only once (rule 6).
 */
export class CreateOrders1763424300000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      CREATE TABLE orders (
        id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
        hold_id      uuid        NOT NULL REFERENCES holds (id) ON DELETE CASCADE,
        fan_id       uuid        NOT NULL REFERENCES fans (id) ON DELETE CASCADE,
        event_id     uuid        NOT NULL REFERENCES events (id) ON DELETE CASCADE,
        total_agorot int         NOT NULL CHECK (total_agorot >= 0),
        created_at   timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT orders_one_per_hold UNIQUE (hold_id)
      )
    `);
    await db.query(
      'CREATE INDEX orders_fan_event_idx ON orders (fan_id, event_id)',
    );

    await db.query(`
      CREATE TABLE order_items (
        order_id     uuid NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
        seat_id      uuid NOT NULL REFERENCES seats (id) ON DELETE CASCADE,
        price_agorot int  NOT NULL CHECK (price_agorot >= 0),
        PRIMARY KEY (order_id, seat_id),
        CONSTRAINT order_items_seat_sold_once UNIQUE (seat_id)
      )
    `);
  }

  async down(db: QueryRunner): Promise<void> {
    await db.query('DROP TABLE order_items');
    await db.query('DROP TABLE orders');
  }
}
