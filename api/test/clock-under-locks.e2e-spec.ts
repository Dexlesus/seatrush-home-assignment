import type { App } from 'supertest/types.js';
import type { QueryRunner } from 'typeorm';
import { checkout, createEvent, hold, logIn, sleep } from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/**
 * Rule 5 under lock waits (HOLD_TTL_SECONDS=2).
 *
 * In PostgreSQL, now() is the time the TRANSACTION STARTED, not the time of
 * the statement. A request that starts, then waits for a row lock, must still
 * decide with the time AFTER the wait. These tests hold a lock themselves (a
 * second connection, like another busy request) to control the order.
 */
describe('Rule 5: time is read after waiting for locks (e2e, HOLD_TTL_SECONDS=2)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp({ HOLD_TTL_SECONDS: '2' });
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  /** Locks the fan's row from another connection, like a busy request would. */
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

  it('a checkout that started before the expiry but waited past it fails with 410, and no order is made', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A1'],
    }).expect(201);

    const lock = await lockFan(dana);
    // The checkout starts now (before the expiry) and waits for the lock.
    const pending = checkout(server, dana, held.holdId).then((res) => res);
    await sleep(Date.parse(held.expiresAt) - Date.now() + 500); // now it has expired
    await unlock(lock);
    const res = await pending;

    expect(res.status).toBe(410);
    expect(res.body.code).toBe('HOLD_EXPIRED');
    const orders = await t.db.query<{ count: string }[]>(
      'SELECT count(*) FROM orders WHERE hold_id = $1',
      [held.holdId],
    );
    expect(orders[0]?.count).toBe('0');
  });

  it('a hold that waited for a lock still lasts the full HOLD_TTL_SECONDS from when it got its seats', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    const lock = await lockFan(dana);
    const pending = hold(server, dana, eventId, { seats: ['B1'] }).then((res) => res);
    await sleep(1_500); // the request waits all this time
    const rows = await t.db.query<{ at: Date }[]>('SELECT clock_timestamp() AS at');
    const unlockedAt = (rows[0]?.at ?? new Date()).getTime();
    await unlock(lock);
    const res = await pending;

    expect(res.status).toBe(201);
    // The fan gets the whole 2 seconds after the seats were really taken.
    expect(Date.parse(res.body.expiresAt)).toBeGreaterThanOrEqual(unlockedAt + 2_000 - 50);
    expect(Date.parse(res.body.serverNow)).toBeGreaterThanOrEqual(unlockedAt - 50);
  });

  it('replaying a lost answer after the hold expired returns the same (expired) hold, and does not take the seats back', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const noa = await logIn(server, 'Noa');
    const first = await hold(server, dana, eventId, { seats: ['C1'] }, 'dana-try-1').expect(201);

    await sleep(2_500); // Dana's hold expires; Noa takes C1
    const noas = await hold(server, noa, eventId, { seats: ['C1'] }).expect(201);
    // Dana's app never got the first answer and retries with the same key.
    const replay = await hold(server, dana, eventId, { seats: ['C1'] }, 'dana-try-1').expect(200);

    expect(replay.headers['idempotent-replayed']).toBe('true');
    expect(replay.body.holdId).toBe(first.body.holdId);
    expect(Date.parse(replay.body.expiresAt)).toBeLessThan(Date.now()); // the screen shows it ran out
    const seat = await t.db.query<{ holdId: string }[]>(
      `SELECT hold_id AS "holdId" FROM seats WHERE event_id = $1 AND label = 'C1'`,
      [eventId],
    );
    expect(seat[0]?.holdId).toBe(noas.body.holdId); // still Noa's
  });
});
