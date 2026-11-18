import type { App } from 'supertest/types.js';
import {
  checkout,
  createEvent,
  hold,
  logIn,
  logInMany,
} from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** Statuses of many parallel responses, e.g. { 201: 1, 409: 49 }. */
function countStatuses(
  responses: { status: number }[],
): Record<number, number> {
  const counts: Record<number, number> = {};
  for (const { status } of responses) {
    counts[status] = (counts[status] ?? 0) + 1;
  }
  return counts;
}

describe('Rule 6: never sell a seat twice, under real concurrency (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('50 fans click the same seat at the same moment: exactly one wins', async () => {
    const eventId = await createEvent(server);
    const fans = await logInMany(server, 50);

    const responses = await Promise.all(
      fans.map((fan) => hold(server, fan, eventId, { seats: ['B2'] })),
    );

    expect(countStatuses(responses)).toEqual({ 201: 1, 409: 49 });
    const losers = responses.filter((r) => r.status === 409);
    expect(losers.every((r) => r.body.code === 'SEAT_TAKEN')).toBe(true);
    const rows = await t.db.query<{ count: string }[]>(
      `select count(*) from hold_seats hs
         join seats s on s.id = hs.seat_id
        where s.event_id = $1 and s.label = 'B2'`,
      [eventId],
    );
    expect(rows[0]?.count).toBe('1');
  }, 60_000);

  it('one fan sends 10 holds at once: the 4-seat limit still holds', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const labels = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2'];

    const responses = await Promise.all(
      labels.map((label) => hold(server, dana, eventId, { seats: [label] })),
    );

    expect(countStatuses(responses)).toEqual({ 201: 4, 409: 6 });
    const held = await t.db.query<{ count: string }[]>(
      `select count(*) from hold_seats hs
         join holds h on h.id = hs.hold_id
        where h.event_id = $1`,
      [eventId],
    );
    expect(held[0]?.count).toBe('4');
  }, 60_000);

  it('opposite orders (A1+A2 vs A2+A1) never deadlock: 20 pairs finish fast, one winner each', async () => {
    const eventId = await createEvent(server, { rowCount: 20, seatsPerRow: 2 });
    const fans = await logInMany(server, 40);
    const rows = Array.from({ length: 20 }, (_, i) =>
      String.fromCharCode(65 + i),
    );
    const started = Date.now();

    const responses = await Promise.all(
      rows.flatMap((row, i) => [
        hold(server, fans[2 * i] ?? '', eventId, {
          seats: [`${row}1`, `${row}2`],
        }),
        hold(server, fans[2 * i + 1] ?? '', eventId, {
          seats: [`${row}2`, `${row}1`],
        }),
      ]),
    );

    expect(Date.now() - started).toBeLessThan(10_000);
    expect(countStatuses(responses)).toEqual({ 201: 20, 409: 20 });
  }, 60_000);

  it('the same Idempotency-Key sent 10 times at once makes exactly one hold', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        hold(server, dana, eventId, { seats: ['C3'] }, 'double-click'),
      ),
    );

    expect(countStatuses(responses)).toEqual({ 201: 1, 200: 9 });
    const holdIds = new Set(responses.map((r) => r.body.holdId as string));
    expect(holdIds.size).toBe(1);
  }, 60_000);

  it('20 fans ask for "2 together" at once: every winner gets different seats', async () => {
    const eventId = await createEvent(server, { rowCount: 5, seatsPerRow: 8 });
    const fans = await logInMany(server, 20);

    const responses = await Promise.all(
      fans.map((fan) =>
        hold(server, fan, eventId, { bestAvailable: { count: 2 } }),
      ),
    );

    // Each row of 8 fits only 3 pairs: the most central pair first (4–5),
    // then 2–3, then 6–7, which leaves seats 1 and 8 alone. 5 rows × 3 = 15
    // winners; the other 5 fans correctly get NO_SEATS_TOGETHER.
    expect(countStatuses(responses)).toEqual({ 201: 15, 409: 5 });
    const losers = responses.filter((r) => r.status === 409);
    expect(losers.every((r) => r.body.code === 'NO_SEATS_TOGETHER')).toBe(true);

    const labels = responses
      .filter((r) => r.status === 201)
      .flatMap((r) =>
        (r.body.seats as { label: string }[]).map((s) => s.label),
      );
    expect(labels).toHaveLength(30);
    expect(new Set(labels).size).toBe(30); // no seat was given twice
  }, 60_000);

  it('10 checkouts of the same hold at once create exactly one order', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const { body } = await hold(server, dana, eventId, {
      seats: ['A1', 'A2'],
    }).expect(201);

    const responses = await Promise.all(
      Array.from({ length: 10 }, () => checkout(server, dana, body.holdId)),
    );

    expect(countStatuses(responses)).toEqual({ 201: 1, 200: 9 });
    expect(new Set(responses.map((r) => r.body.orderId as string)).size).toBe(
      1,
    );
    const orders = await t.db.query<{ count: string }[]>(
      'select count(*) from orders where hold_id = $1',
      [body.holdId],
    );
    expect(orders[0]?.count).toBe('1');
  }, 60_000);
});
