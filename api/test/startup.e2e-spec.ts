import { Logger } from '@nestjs/common';
import { MIGRATIONS } from '../src/database/migrations/index.js';
import { startApp, type TestApp } from './support/test-app.js';
import {
  startTestDatabase,
  type TestDatabase,
} from './support/test-database.js';

/**
 * A real deployment runs several API copies. On the first start they all find
 * an empty database at the same moment, and each one runs the migrations
 * when it starts. Only one may actually run them; the others must wait for it,
 * then find nothing left to do.
 */
describe('Several API copies start at the same moment on an empty database (e2e)', () => {
  let database: TestDatabase;
  const copies: TestApp[] = [];

  beforeAll(async () => {
    database = await startTestDatabase();
  });

  afterAll(async () => {
    await Promise.all(copies.map((copy) => copy.close()));
    await database.stop();
  });

  it('all three come up on the first try, the migrations run once, and the demo event is created once', async () => {
    // @nestjs/typeorm logs this, then retries, when starting the database failed.
    const errors = vi.spyOn(Logger.prototype, 'error');

    const results = await Promise.allSettled(
      [1, 2, 3].map(() => startApp(database, { SEED_DEMO_EVENT: 'true' })),
    );
    for (const result of results) {
      if (result.status === 'fulfilled') {
        copies.push(result.value);
      }
    }

    const failedStarts = errors.mock.calls
      .map(([message]) => String(message))
      .filter((message) =>
        message.includes('Unable to connect to the database'),
      );
    errors.mockRestore();
    expect(failedStarts).toEqual([]);
    expect(copies).toHaveLength(3);

    const db = copies[0]!.db;
    const migrations = await db.query<{ name: string; times: string }[]>(
      'SELECT name, count(*) AS times FROM migrations GROUP BY name',
    );
    expect(migrations).toHaveLength(MIGRATIONS.length);
    expect(migrations.every((row) => row.times === '1')).toBe(true);

    const events = await db.query<{ count: string }[]>(
      'SELECT count(*) FROM events',
    );
    expect(events[0]?.count).toBe('1');
  }, 120_000);
});
