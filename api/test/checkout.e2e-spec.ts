import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  checkout,
  createEvent,
  hold,
  logIn,
  release,
  seatStatuses,
} from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Rule 8: checkout (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('the fan who holds the seats checks out: 201, an order, and the seats are SOLD', async () => {
    const eventId = await createEvent(server, { name: 'Coldplay' });
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A1', 'A2'],
    }).expect(201);

    const res = await checkout(server, dana, held.holdId).expect(201);

    expect(res.body).toMatchObject({
      holdId: held.holdId,
      eventId,
      eventName: 'Coldplay',
      seats: [{ label: 'A1' }, { label: 'A2' }],
      totalAgorot: 20000,
    });
    expect(res.body).toHaveProperty('orderId');
    const map = await seatStatuses(server, eventId);
    expect([map.A1, map.A2]).toEqual(['SOLD', 'SOLD']);
  });

  it('one order per hold: checking out again returns the SAME order (200)', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['B1'],
    }).expect(201);

    const first = await checkout(server, dana, held.holdId).expect(201);
    const again = await checkout(server, dana, held.holdId).expect(200);

    expect(again.body.orderId).toBe(first.body.orderId);
    const orders = await t.db.query<{ count: string }[]>(
      'select count(*) from orders where hold_id = $1',
      [held.holdId],
    );
    expect(orders[0]?.count).toBe('1');
  });

  it("another fan can't check out Dana's hold: 403 NOT_YOUR_HOLD, seats stay held", async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const noa = await logIn(server, 'Noa');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['C1'],
    }).expect(201);

    const res = await checkout(server, noa, held.holdId).expect(403);

    expect(res.body.code).toBe('NOT_YOUR_HOLD');
    expect((await seatStatuses(server, eventId)).C1).toBe('HELD');
  });

  it('a released hold cannot be checked out (409), and an unknown hold is 404', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['C2'],
    }).expect(201);
    await release(server, dana, held.holdId).expect(204);

    const released = await checkout(server, dana, held.holdId).expect(409);
    const unknown = await checkout(
      server,
      dana,
      '00000000-0000-4000-8000-000000000000',
    ).expect(404);

    expect(released.body.code).toBe('HOLD_RELEASED');
    expect(unknown.body.code).toBe('HOLD_NOT_FOUND');
  });

  it('"My tickets": GET /api/me/orders lists the fan\'s orders with the event and seats', async () => {
    const eventId = await createEvent(server, { name: 'Radiohead' });
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A3', 'A4'],
    }).expect(201);
    const { body: order } = await checkout(server, dana, held.holdId).expect(
      201,
    );

    const res = await request(server)
      .get('/api/me/orders')
      .set('X-Username', dana)
      .expect(200);

    expect(res.body.orders).toEqual([
      expect.objectContaining({
        orderId: order.orderId,
        eventName: 'Radiohead',
        seats: [
          expect.objectContaining({ label: 'A3' }),
          expect.objectContaining({ label: 'A4' }),
        ],
      }),
    ]);
  });
});
