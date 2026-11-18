import { DataSource, type DataSourceOptions } from 'typeorm';

/** Any fixed number, the same in every API copy. (The demo seeder uses 424242.) */
const MIGRATIONS_LOCK = 424241;

/**
 * Connects to the database, then runs the pending migrations ONE COPY AT A TIME.
 *
 * TypeORM's own `migrationsRun` has no lock: three copies starting on an empty
 * database all see "no tables yet", all run CREATE TABLE, and two of them
 * crash ("duplicate key ... pg_class_relname_nsp_index").
 *
 * Here every copy first takes the same PostgreSQL advisory lock. The first one
 * runs the migrations; the others wait, then find none left to run. The lock
 * belongs to the transaction, so it is released even if a migration fails.
 */
export async function connectAndMigrate(
  options?: DataSourceOptions,
): Promise<DataSource> {
  if (!options) {
    throw new Error('connectAndMigrate needs the TypeORM options');
  }
  const dataSource = await new DataSource(options).initialize();
  try {
    await dataSource.transaction(async (manager) => {
      // Waiting for another copy is expected here: allow longer than requests.
      await manager.query(`SET LOCAL lock_timeout = '60s'`);
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        MIGRATIONS_LOCK,
      ]);
      // Runs on its own connection, each migration in its own transaction.
      await dataSource.runMigrations({ transaction: 'each' });
    });
  } catch (error) {
    await dataSource.destroy(); // don't leave a pool open behind a failed start
    throw error;
  }
  return dataSource;
}
