import type { ConfigService } from '@nestjs/config';
import type { TypeOrmModuleOptions } from '@nestjs/typeorm';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { MIGRATIONS } from './migrations/index.js';

/** How the app connects to PostgreSQL. The values come from the validated config. */
export function typeOrmOptions(
  config: ConfigService<EnvironmentVariables, true>,
): TypeOrmModuleOptions {
  return {
    type: 'postgres',
    host: config.get('DB_HOST', { infer: true }),
    port: config.get('DB_PORT', { infer: true }),
    username: config.get('DB_USER', { infer: true }),
    password: config.get('DB_PASSWORD', { infer: true }),
    database: config.get('DB_NAME', { infer: true }),

    // Time limits for every connection (PostgreSQL's default is "wait forever").
    // A request waiting for a lock holds one of the pool's 10 connections; if
    // the lock is stuck, 10 such requests freeze the whole API, even the seat
    // map. Normally a lock wait is a few milliseconds, so 3 s means "stuck":
    // the request gives up, frees its connection, and the fan gets
    // 503 BUSY_TRY_AGAIN (see postgres-errors.ts). Nothing was saved, so the
    // retry with the same Idempotency-Key is safe.
    extra: {
      options: '-c lock_timeout=3000 -c statement_timeout=10000',
    },

    // Entities register themselves through TypeOrmModule.forFeature().
    autoLoadEntities: true,

    // The schema changes ONLY through migrations, never automatically:
    // `synchronize` could drop a column with real orders in it.
    synchronize: false,
    migrations: MIGRATIONS,
    // New migrations run when the app starts, so a fresh clone gets its
    // tables with no manual step. Not through TypeORM's `migrationsRun`: that
    // has no lock between API copies. connectAndMigrate (run-migrations.ts)
    // runs them one copy at a time.
    migrationsRun: false,
    migrationsTransactionMode: 'each',
  };
}
