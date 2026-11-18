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

    // Entities register themselves through TypeOrmModule.forFeature().
    autoLoadEntities: true,

    // The schema changes ONLY through migrations, never automatically:
    // `synchronize` could drop a column with real orders in it.
    synchronize: false,
    migrations: MIGRATIONS,
    // Run new migrations when the app starts, so a fresh clone gets its
    // tables with no manual step. Each migration runs in its own transaction.
    migrationsRun: true,
    migrationsTransactionMode: 'each',
  };
}
