import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  createEvent,
  hold,
  logIn,
  release,
  seatStatuses,
} from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Rule 3: holding seats (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('holds 2 seats: 201 with the hold, its price and expiry; the map shows them HELD', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    const res = await hold(server, dana, eventId, {
      seats: ['B1', 'b2'],
    }).expect(201);

    expect(res.body).toMatchObject({
      eventId,
      status: 'ACTIVE',
      seats: [
        { label: 'B1', priceAgorot: 10000 },
        { label: 'B2', priceAgorot: 10000 },
      ],
      totalAgorot: 20000,
    });
    // HOLD_TTL_SECONDS defaults to 300: the hold ends 5 minutes after "now".
    const lasts =
      Date.parse(res.body.expiresAt) - Date.parse(res.body.serverNow);
    expect(Math.round(lasts / 1000)).toBe(300);

    const map = await seatStatuses(server, eventId);
    expect([map.B1, map.B2, map.B3]).toEqual(['HELD', 'HELD', 'AVAILABLE']);
  });

  it('all or nothing: B2 is taken, so asking for B1+B2+B3 holds NOTHING', async () => {
    const eventId = await createEvent(server);
    const noa = await logIn(server, 'Noa');
    const dana = await logIn(server, 'Dana');
    await hold(server, noa, eventId, { seats: ['B2'] }).expect(201);

    const res = await hold(server, dana, eventId, {
      seats: ['B1', 'B2', 'B3'],
    }).expect(409);

    expect(res.body).toMatchObject({
      code: 'SEAT_TAKEN',
      message: 'Someone just took B2.',
      details: { seats: ['B2'] },
    });
    const map = await seatStatuses(server, eventId);
    expect([map.B1, map.B2, map.B3]).toEqual([
      'AVAILABLE',
      'HELD',
      'AVAILABLE',
    ]);
  });

  it('refuses 5 seats, a seat twice, and a seat the hall does not have (400)', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    const five = await hold(server, dana, eventId, {
      seats: ['A1', 'A2', 'A3', 'A4', 'B1'],
    }).expect(400);
    const twice = await hold(server, dana, eventId, {
      seats: ['A1', 'a1'],
    }).expect(400);
    const missing = await hold(server, dana, eventId, {
      seats: ['A1', 'Z99'],
    }).expect(400);

    expect(five.body.code).toBe('INVALID_SEAT_COUNT');
    expect(twice.body.code).toBe('DUPLICATE_SEATS');
    expect(missing.body).toMatchObject({
      code: 'SEAT_NOT_FOUND',
      details: { seats: ['Z99'] },
    });
    // Nothing was held by any of them.
    expect(Object.values(await seatStatuses(server, eventId))).not.toContain(
      'HELD',
    );
  });

  it('only the fan who made a hold can release it early', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const noa = await logIn(server, 'Noa');
    const { body } = await hold(server, dana, eventId, {
      seats: ['C1', 'C2'],
    }).expect(201);

    const byNoa = await release(server, noa, body.holdId).expect(404);
    expect(byNoa.body.code).toBe('HOLD_NOT_FOUND');
    expect((await seatStatuses(server, eventId)).C1).toBe('HELD');

    await release(server, dana, body.holdId).expect(204);
    const map = await seatStatuses(server, eventId);
    expect([map.C1, map.C2]).toEqual(['AVAILABLE', 'AVAILABLE']);
  });

  it('Idempotency-Key: the same request twice makes ONE hold; a different body with the same key is refused', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    const first = await hold(
      server,
      dana,
      eventId,
      { seats: ['A1'] },
      'click-1',
    ).expect(201);
    const again = await hold(
      server,
      dana,
      eventId,
      { seats: ['a1'] },
      'click-1',
    ).expect(200);

    expect(again.body.holdId).toBe(first.body.holdId);
    expect(again.headers['idempotent-replayed']).toBe('true');
    const rows = await t.db.query<{ count: string }[]>(
      'select count(*) from holds where event_id = $1',
      [eventId],
    );
    expect(rows[0]?.count).toBe('1');

    const other = await hold(
      server,
      dana,
      eventId,
      { seats: ['A2'] },
      'click-1',
    ).expect(422);
    expect(other.body.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('a failed hold does not use up its Idempotency-Key: the fan can retry with it', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    await hold(server, dana, eventId, { seats: ['Z99'] }, 'retry-me').expect(
      400,
    );
    await hold(server, dana, eventId, { seats: ['A1'] }, 'retry-me').expect(
      201,
    );
  });

  it('rule 2: before the drop time, holding is refused with 403 SALE_NOT_OPEN', async () => {
    const eventId = await createEvent(server, { dropInMinutes: 10 });
    const dana = await logIn(server, 'Dana');

    const res = await hold(server, dana, eventId, { seats: ['A1'] }).expect(
      403,
    );

    expect(res.body.code).toBe('SALE_NOT_OPEN');
    expect(res.body.details.secondsLeft).toBeGreaterThan(500);
    expect((await seatStatuses(server, eventId)).A1).toBe('AVAILABLE');
  });

  it('needs a fan: no X-Username → 401; GET /api/me/holds lists the fan’s active holds', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    await request(server)
      .post(`/api/events/${eventId}/holds`)
      .send({ seats: ['A1'] })
      .expect(401);

    const { body } = await hold(server, dana, eventId, {
      seats: ['A1'],
    }).expect(201);
    const mine = await request(server)
      .get('/api/me/holds')
      .set('X-Username', dana)
      .expect(200);
    expect(mine.body.holds.map((h: { holdId: string }) => h.holdId)).toEqual([
      body.holdId,
    ]);
  });
});
