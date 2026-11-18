import type { App } from 'supertest/types.js';
import {
  checkout,
  createEvent,
  hold,
  logIn,
  seatStatuses,
} from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** 3 rows × 8 seats, like the brief's example. */
const HALL = { rowCount: 3, seatsPerRow: 8 };

describe('Extra credit: no lone seats (e2e, NO_LONE_SEATS=true)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp({ NO_LONE_SEATS: 'true' });
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it("the brief's example: every pair in row B leaves a lone seat, so → C4–C5", async () => {
    const eventId = await createEvent(server, HALL);
    const [f1, f2, f3, dana] = await Promise.all(
      ['One', 'Two', 'Three', 'Dana'].map((name) => logIn(server, name)),
    );
    await hold(server, f1 ?? '', eventId, {
      seats: ['A1', 'A2', 'A3', 'A4'],
    }).expect(201);
    await hold(server, f2 ?? '', eventId, {
      seats: ['A5', 'A6', 'A7', 'A8'],
    }).expect(201);
    const sold = await hold(server, f3 ?? '', eventId, {
      seats: ['B4', 'B5'],
    }).expect(201);
    await checkout(server, f3 ?? '', sold.body.holdId).expect(201);

    const res = await hold(server, dana ?? '', eventId, {
      bestAvailable: { count: 2 },
    }).expect(201);

    expect(res.body.seats.map((s: { label: string }) => s.label)).toEqual([
      'C4',
      'C5',
    ]);
  });

  it('a hold that would leave one seat alone → 409 LONE_SEAT, and nothing is held', async () => {
    const eventId = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');

    const res = await hold(server, dana, eventId, {
      seats: ['B2', 'B3'],
    }).expect(409);

    expect(res.body.code).toBe('LONE_SEAT');
    expect(res.body.details).toEqual({ seats: ['B1'] });
    const map = await seatStatuses(server, eventId);
    expect([map.B2, map.B3]).toEqual(['AVAILABLE', 'AVAILABLE']);
  });

  it('leaving 2 or more seats together is fine', async () => {
    const eventId = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');

    await hold(server, dana, eventId, { seats: ['B3', 'B4'] }).expect(201);
  });

  it('a seat that was already alone does not block the hold', async () => {
    const eventId = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');
    // B2 is sold, so B1 is already stuck between the wall and B2.
    await t.db.query(
      `UPDATE seats SET status = 'SOLD' WHERE event_id = $1 AND label = 'B2'`,
      [eventId],
    );

    await hold(server, dana, eventId, { seats: ['B3', 'B4'] }).expect(201);
  });

  it('two fans at once cannot leave a lone seat together: A1 and A3 of a 3-seat row → one wins', async () => {
    const eventId = await createEvent(server, { rowCount: 1, seatsPerRow: 3 });
    const dana = await logIn(server, 'Dana');
    const noa = await logIn(server, 'Noa');

    // Each hold alone is fine, but both together would leave A2 alone.
    // The whole row is locked, so the second one sees the first.
    const results = await Promise.all([
      hold(server, dana, eventId, { seats: ['A1'] }),
      hold(server, noa, eventId, { seats: ['A3'] }),
    ]);

    const statuses = results.map((r) => r.status).sort();
    expect(statuses).toEqual([201, 409]);
    const loser = results.find((r) => r.status === 409);
    expect(loser?.body.code).toBe('LONE_SEAT');
  });
});
