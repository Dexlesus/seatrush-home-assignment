import type { App } from 'supertest/types.js';
import { checkout, createEvent, hold, logIn, sleep } from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** 3 rows × 8 seats. Row A is VIP (₪300), rows B–C are Regular (₪150). */
const HALL = {
  rowCount: 3,
  seatsPerRow: 8,
  zones: [
    { name: 'VIP', fromRow: 'A', toRow: 'A', priceAgorot: 30000 },
    { name: 'Regular', fromRow: 'B', toRow: 'C', priceAgorot: 15000 },
  ],
};

function labelsOf(body: { seats: { label: string }[] }): string[] {
  return body.seats.map((s) => s.label);
}

describe('Rule 7: best available (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it("the brief's example: row A full, B4 and B5 sold, N = 2 → B2–B3", async () => {
    const eventId = await createEvent(server, HALL);
    const [f1, f2, f3, dana] = await Promise.all(
      ['One', 'Two', 'Three', 'Dana'].map((name) => logIn(server, name)),
    );
    // Row A full (2 fans × 4 seats), B4 + B5 sold.
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

    expect(labelsOf(res.body)).toEqual(['B2', 'B3']);
  });

  it('max price: skips the VIP row and picks the centre of row B', async () => {
    const eventId = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');

    const res = await hold(server, dana, eventId, {
      bestAvailable: { count: 2, maxPriceAgorot: 20000 },
    }).expect(201);

    expect(labelsOf(res.body)).toEqual(['B4', 'B5']);
    expect(res.body.totalAgorot).toBe(30000);
  });

  it('zone filter: only VIP seats', async () => {
    const eventId = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');

    const res = await hold(server, dana, eventId, {
      bestAvailable: { count: 3, zone: 'VIP' },
    }).expect(201);

    expect(labelsOf(res.body)).toEqual(['A3', 'A4', 'A5']);
  });

  it('nothing fits → 409 NO_SEATS_TOGETHER, and nothing is held', async () => {
    const eventId = await createEvent(server, { rowCount: 1, seatsPerRow: 3 });
    const noa = await logIn(server, 'Noa');
    const dana = await logIn(server, 'Dana');
    await hold(server, noa, eventId, { seats: ['A2'] }).expect(201);

    const res = await hold(server, dana, eventId, {
      bestAvailable: { count: 2 },
    }).expect(409);

    expect(res.body.code).toBe('NO_SEATS_TOGETHER');
  });

  it('the other rules still apply: before the drop → 403, over the limit → 409', async () => {
    const notYet = await createEvent(server, { ...HALL, dropInMinutes: 10 });
    const onSale = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');

    const early = await hold(server, dana, notYet, {
      bestAvailable: { count: 2 },
    }).expect(403);
    expect(early.body.code).toBe('SALE_NOT_OPEN');

    await hold(server, dana, onSale, { seats: ['C1', 'C2', 'C3'] }).expect(201);
    const over = await hold(server, dana, onSale, {
      bestAvailable: { count: 2 },
    }).expect(409);
    expect(over.body.code).toBe('FAN_LIMIT_REACHED');
  });

  it('asking for seats AND best available in one request → 400 INVALID_HOLD_REQUEST', async () => {
    const eventId = await createEvent(server, HALL);
    const dana = await logIn(server, 'Dana');

    const res = await hold(server, dana, eventId, {
      seats: ['A1'],
      bestAvailable: { count: 1 },
    }).expect(400);

    expect(res.body.code).toBe('INVALID_HOLD_REQUEST');
  });

  it('a best-available request locks only the row it picks: a hold in another row does not wait for it', async () => {
    const eventId = await createEvent(server, HALL);
    const [dana, noa] = await Promise.all(
      ['Dana', 'Noa'].map((name) => logIn(server, name)),
    );

    // A slow request (another connection) holds the lock on the LAST seat in
    // lock order (the highest id), so whoever locks seats in id order waits there.
    const slow = t.db.createQueryRunner();
    await slow.connect();
    await slow.startTransaction();
    const [last] = await slow.manager.query<{ rowIndex: number }[]>(
      `SELECT row_index AS "rowIndex" FROM seats WHERE event_id = $1
        ORDER BY id DESC LIMIT 1 FOR UPDATE`,
      [eventId],
    );

    // Dana asks for 2 together. The best block is A4–A5, in the front row.
    const danas = hold(server, dana ?? '', eventId, {
      bestAvailable: { count: 2 },
    }).then((r) => r);
    await sleep(500); // her request is inside now, taking its locks

    // Noa clicks a seat in a row that is neither Dana's (A) nor the slow seat's.
    const noaRow = [1, 2].find((row) => row !== last?.rowIndex) ?? 1;
    const noaSeat = `${'ABC'[noaRow]}1`;
    const noas = hold(server, noa ?? '', eventId, { seats: [noaSeat] }).then(
      (r) => r,
    );
    const answeredFast = await Promise.race([
      noas,
      sleep(2_000).then(() => null),
    ]);

    await slow.commitTransaction();
    await slow.release();
    const [danaRes] = await Promise.all([danas, noas]);

    expect(
      answeredFast,
      `Noa waited over 2 s for ${noaSeat}, a row Dana never asked for`,
    ).not.toBeNull();
    expect(answeredFast?.status).toBe(201);
    expect(danaRes.status).toBe(201);
    expect(labelsOf(danaRes.body)).toEqual(['A4', 'A5']);
  }, 30_000);
});
