import { Client } from 'pg';
import {
  startTestDatabase,
  type TestDatabase,
} from './support/test-database.js';

describe('Test database (Testcontainers)', () => {
  let db: TestDatabase;
  let client: Client;

  // Runs once, before all the tests in this file.
  beforeAll(async () => {
    db = await startTestDatabase();
    client = new Client(db.connection);
    await client.connect();
  }, 60_000); // the first run downloads the image, so allow up to 60 seconds

  // Runs once, after all the tests in this file.
  afterAll(async () => {
    await client.end();
    await db.stop();
  });

  it('starts a real PostgreSQL 17 that answers queries', async () => {
    const result = await client.query<{ version: string }>('select version()');

    expect(result.rows[0]?.version).toContain('PostgreSQL 17');
  });

  it('starts empty: no tables at all', async () => {
    const result = await client.query<{ count: string }>(
      `select count(*) from information_schema.tables
       where table_schema = 'public'`,
    );

    // PostgreSQL sends count(*) as text, "0", not the number 0.
    expect(result.rows[0]?.count).toBe('0');
  });

  it('uses its own port, never the dev database on 55432', () => {
    expect(db.connection.port).not.toBe(55432);
  });
});
