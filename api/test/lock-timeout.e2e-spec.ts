import request from 'supertest';
import type { App } from 'supertest/types.js';
import type { QueryRunner } from 'typeorm';
import { createEvent, hold, logIn, sleep } from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/**
 * A lock that is never released (a stuck transaction: a slow database, a
 * dropped connection mid-transaction, an admin's open psql session).
 *
 * Every request that needs that row waits for it, and holds one of the pool's
 * 10 database connections while it waits. Without a time limit they wait
 * forever, the pool runs out, and even requests that need no lock at all
 * (the seat map) stop answering. With a limit, the waiting request gives up,
 * returns its connection, and the fan gets "try again".
 */
describe('Lock waits have a time limit (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  });

  afterAll(async () => {
    await t.close();
  });

  /** Locks the fan's row from another connection and keeps it, like a stuck request. */
  async function lockFan(handle: string): Promise<QueryRunner> {
    const runner = t.db.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    await runner.query(
      'SELECT id FROM fans WHERE lower(handle) = lower($1) FOR UPDATE',
      [handle],
    );
    return runner;
  }

  async function unlock(runner: QueryRunner): Promise<void> {
    await runner.commitTransaction();
    await runner.release();
  }

  /** The response, or null if none came within `ms`. */
  async function within<T>(
    ms: number,
    pending: PromiseLike<T>,
  ): Promise<T | null> {
    return Promise.race([pending, sleep(ms).then(() => null)]);
  }

  it('a hold stuck behind a lock gives up with 503 BUSY_TRY_AGAIN, and the same key works once the lock is gone', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const stuck = await lockFan(dana);

    const res = await within(
      8_000,
      hold(server, dana, eventId, { seats: ['A1'] }, 'dana-1'),
    );
    await unlock(stuck);

    expect(
      res,
      'no answer after 8 s: the request is still waiting',
    ).not.toBeNull();
    expect(res?.status).toBe(503);
    expect(res?.body.code).toBe('BUSY_TRY_AGAIN');
    expect(res?.headers['retry-after']).toBe('1');

    // Nothing was saved, not even the idempotency key: the retry is a fresh hold.
    const retry = await hold(
      server,
      dana,
      eventId,
      { seats: ['A1'] },
      'dana-1',
    );
    expect(retry.status).toBe(201);
  }, 30_000);

  it('12 requests stuck behind one lock do not freeze the server: the seat map still answers', async () => {
    const eventId = await createEvent(server, { seatsPerRow: 12 });
    const dana = await logIn(server, 'Dana');
    const stuck = await lockFan(dana);

    // More stuck requests than the pool has connections (10).
    const holds = Array.from({ length: 12 }, (_, i) =>
      hold(server, dana, eventId, { seats: [`A${i + 1}`] }).then((r) => r),
    );
    await sleep(500);
    const map = await within(
      8_000,
      request(server).get(`/api/events/${eventId}/seats`),
    );
    await unlock(stuck);
    await Promise.all(holds);

    expect(map, 'the seat map did not answer within 8 s').not.toBeNull();
    expect(map?.status).toBe(200);
  }, 30_000);
});
