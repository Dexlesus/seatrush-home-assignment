import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Extra credit: promo codes. An order now keeps its subtotal, the code used
 * and the discount, and the database checks that they add up.
 *
 * orders_welcome20_once_per_fan is the database's own guarantee that a fan
 * uses WELCOME20 only once, even if two checkouts ran at the same moment.
 * (A partial unique index: it only covers rows WHERE promo_code = 'WELCOME20'.)
 */
export class AddPromoCodesToOrders1763424400000 implements MigrationInterface {
  async up(db: QueryRunner): Promise<void> {
    await db.query(`
      ALTER TABLE orders
        ADD COLUMN subtotal_agorot int,
        ADD COLUMN discount_agorot int NOT NULL DEFAULT 0
          CHECK (discount_agorot >= 0),
        ADD COLUMN promo_code text
    `);
    // Orders made before this migration had no discount.
    await db.query('UPDATE orders SET subtotal_agorot = total_agorot');
    await db.query(`
      ALTER TABLE orders
        ALTER COLUMN subtotal_agorot SET NOT NULL,
        ADD CONSTRAINT orders_total_adds_up
          CHECK (total_agorot = subtotal_agorot - discount_agorot)
    `);
    await db.query(`
      CREATE UNIQUE INDEX orders_welcome20_once_per_fan
        ON orders (fan_id) WHERE promo_code = 'WELCOME20'
    `);
  }

  async down(db: QueryRunner): Promise<void> {
    await db.query('DROP INDEX orders_welcome20_once_per_fan');
    await db.query(`
      ALTER TABLE orders
        DROP CONSTRAINT orders_total_adds_up,
        DROP COLUMN promo_code,
        DROP COLUMN discount_agorot,
        DROP COLUMN subtotal_agorot
    `);
  }
}
