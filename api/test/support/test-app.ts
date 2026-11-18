import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { App } from 'supertest/types.js';
import { DataSource } from 'typeorm';
import { startTestDatabase, type TestDatabase } from './test-database.js';

export interface TestApp {
  /** The running app. Pass app.getHttpServer() to supertest. */
  app: INestApplication<App>;
  /** Direct access to the database, to check what was (or wasn't) saved. */
  db: DataSource;
  /** Stops the app and deletes its database. */
  close: () => Promise<void>;
}

/**
 * Starts the real SeatRush API on a throwaway PostgreSQL:
 * 1. a fresh database in Docker (Testcontainers),
 * 2. the app, configured exactly like main.ts, with all migrations run.
 *
 * `env` overrides settings for this test file, e.g. { HOLD_TTL_SECONDS: '2' }.
 */
export async function createTestApp(
  env: Record<string, string> = {},
): Promise<TestApp> {
  const database = await startTestDatabase();
  const started = await startApp(database, env);
  return {
    ...started,
    close: async () => {
      await started.close();
      await database.stop();
    },
  };
}

/**
 * Starts one copy of the API on an existing database. Call it several times
 * with the same database to run several copies, like a real deployment.
 * `close` stops only this copy; the database stays.
 */
export async function startApp(
  database: TestDatabase,
  env: Record<string, string> = {},
): Promise<TestApp> {
  // The config is read when AppModule is first imported, so the settings
  // must be in place BEFORE that import. That's why the imports below are
  // dynamic (await import) and not at the top of the file.
  Object.assign(process.env, {
    DB_HOST: database.connection.host,
    DB_PORT: String(database.connection.port),
    DB_USER: database.connection.user,
    DB_PASSWORD: database.connection.password,
    DB_NAME: database.connection.database,
    // Tests create their own events; the demo event would only get in the way.
    SEED_DEMO_EVENT: 'false',
    ...env,
  });
  const { AppModule } = await import('../../src/app.module.js');
  const { configureApp } = await import('../../src/app.setup.js');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app);
  await app.init();

  return {
    app,
    db: app.get(DataSource),
    close: async () => {
      await app.close();
    },
  };
}
