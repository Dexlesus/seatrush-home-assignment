import type { App } from 'supertest/types.js';
import {
  checkout,
  createEvent,
  hold,
  logIn,
  release,
  seatStatuses,
  sleep,
} from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/**
 * HOLD_TTL_SECONDS=2: Dana holds B1+B2, and we wait until the hold has run
 * out. There is NO cleanup job: everything below must work just because time
 * has passed.
 */
describe('Rule 5: expiry (e2e, HOLD_TTL_SECONDS=2)', () => {
  let t: TestApp;
  let server: App;
  let eventId: string;
  let dana: string;
  let noa: string;
  let danasHoldId: string;

  beforeAll(async () => {
    t = await createTestApp({ HOLD_TTL_SECONDS: '2' });
    server = t.app.getHttpServer();
    eventId = await createEvent(server);
    dana = await logIn(server, 'Dana');
    noa = await logIn(server, 'Noa');

    const res = await hold(server, dana, eventId, {
      seats: ['B1', 'B2'],
    }).expect(201);
    danasHoldId = res.body.holdId;
    const lasts =
      Date.parse(res.body.expiresAt) - Date.parse(res.body.serverNow);
    expect(Math.round(lasts / 1000)).toBe(2);

    await sleep(2_500); // the hold has now expired
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('the seats are back on sale in the seat map, with no cleanup run', async () => {
    const map = await seatStatuses(server, eventId);

    expect([map.B1, map.B2]).toEqual(['AVAILABLE', 'AVAILABLE']);
  });

  it('checkout of the expired hold fails with 410 HOLD_EXPIRED, and no order is created', async () => {
    const res = await checkout(server, dana, danasHoldId).expect(410);

    expect(res.body.code).toBe('HOLD_EXPIRED');
    const orders = await t.db.query<{ count: string }[]>(
      'select count(*) from orders',
    );
    expect(orders[0]?.count).toBe('0');
  });

  it('another fan can now hold the same seats', async () => {
    await hold(server, noa, eventId, { seats: ['B1', 'B2'] }).expect(201);
  });

  it("the old hold can't touch the new holder: releasing or checking it out leaves Noa's seats alone", async () => {
    await release(server, dana, danasHoldId).expect(204); // nothing to release
    await checkout(server, dana, danasHoldId).expect(410);

    const map = await seatStatuses(server, eventId);
    expect([map.B1, map.B2]).toEqual(['HELD', 'HELD']); // still Noa's
  });

  it("an expired hold no longer counts toward Dana's limit", async () => {
    await hold(server, dana, eventId, {
      seats: ['A1', 'A2', 'A3', 'A4'],
    }).expect(201);
  });
});
