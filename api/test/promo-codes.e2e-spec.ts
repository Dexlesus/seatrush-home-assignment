import type { App } from 'supertest/types.js';
import {
  checkout,
  createEvent,
  hold,
  logIn,
  seatStatuses,
} from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** One zone for the whole hall, at `priceAgorot` per seat. */
function priced(priceAgorot: number) {
  return {
    rowCount: 2,
    seatsPerRow: 4,
    zones: [{ name: 'All', fromRow: 'A', toRow: 'B', priceAgorot }],
  };
}

describe('Extra credit: promo codes at checkout (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it("SAVE10, the brief's example: ₪349.35 → ₪314.41", async () => {
    const eventId = await createEvent(server, priced(34935));
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A1'],
    }).expect(201);

    const res = await checkout(server, dana, held.holdId, {
      promoCode: 'SAVE10',
    }).expect(201);

    expect(res.body).toMatchObject({
      subtotalAgorot: 34935,
      promoCode: 'SAVE10',
      discountAgorot: 3494,
      totalAgorot: 31441,
    });
  });

  it('WELCOME20 works once per fan ever; the second time → 409 and the seats stay held', async () => {
    const eventId = await createEvent(server, priced(10000));
    const dana = await logIn(server, 'Dana');
    const first = await hold(server, dana, eventId, { seats: ['A1'] });
    const second = await hold(server, dana, eventId, { seats: ['A2'] });

    const ok = await checkout(server, dana, first.body.holdId, {
      promoCode: 'WELCOME20',
    }).expect(201);
    const again = await checkout(server, dana, second.body.holdId, {
      promoCode: 'welcome20',
    }).expect(409);

    expect(ok.body.totalAgorot).toBe(8000);
    expect(again.body.code).toBe('PROMO_CODE_USED');
    expect((await seatStatuses(server, eventId)).A2).toBe('HELD');
    // Without the code, the same hold checks out fine.
    await checkout(server, dana, second.body.holdId).expect(201);
  });

  it('WELCOME20 is used up only when an order is created', async () => {
    const eventId = await createEvent(server, priced(10000));
    const dana = await logIn(server, 'Dana');
    const noa = await logIn(server, 'Noa');
    const noasHold = await hold(server, noa, eventId, { seats: ['B1'] });
    const danasHold = await hold(server, dana, eventId, { seats: ['B2'] });

    // A failed checkout (not her hold) must not burn Dana's code.
    await checkout(server, dana, noasHold.body.holdId, {
      promoCode: 'WELCOME20',
    }).expect(403);

    const res = await checkout(server, dana, danasHold.body.holdId, {
      promoCode: 'WELCOME20',
    }).expect(201);
    expect(res.body.discountAgorot).toBe(2000);
  });

  it('an unknown code → 400 PROMO_CODE_UNKNOWN, and nothing is sold', async () => {
    const eventId = await createEvent(server, priced(10000));
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A3'],
    });

    const res = await checkout(server, dana, held.holdId, {
      promoCode: 'FREE100',
    }).expect(400);

    expect(res.body.code).toBe('PROMO_CODE_UNKNOWN');
    expect((await seatStatuses(server, eventId)).A3).toBe('HELD');
  });

  it('a total never goes below 0: a ₪15 seat with WELCOME20 → ₪0', async () => {
    const eventId = await createEvent(server, priced(1500));
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A1'],
    });

    const res = await checkout(server, dana, held.holdId, {
      promoCode: 'WELCOME20',
    }).expect(201);

    expect(res.body).toMatchObject({ discountAgorot: 1500, totalAgorot: 0 });
  });

  it('two checkouts at once with WELCOME20: only one gets the discount', async () => {
    const eventId = await createEvent(server, priced(10000));
    const dana = await logIn(server, 'Dana');
    const h1 = await hold(server, dana, eventId, { seats: ['A1'] });
    const h2 = await hold(server, dana, eventId, { seats: ['B1'] });

    const results = await Promise.all(
      [h1, h2].map((h) =>
        checkout(server, dana, h.body.holdId, { promoCode: 'WELCOME20' }),
      ),
    );

    expect(results.map((r) => r.status).sort((a, b) => a - b)).toEqual([
      201, 409,
    ]);
    const used = await t.db.query<{ count: string }[]>(
      `SELECT count(*) FROM orders o JOIN fans f ON f.id = o.fan_id
        WHERE f.handle = $1 AND o.promo_code = 'WELCOME20'`,
      [dana],
    );
    expect(used[0]?.count).toBe('1');
  });

  it('checking out again returns the same order, with its discount', async () => {
    const eventId = await createEvent(server, priced(10000));
    const dana = await logIn(server, 'Dana');
    const { body: held } = await hold(server, dana, eventId, {
      seats: ['A4'],
    });

    const first = await checkout(server, dana, held.holdId, {
      promoCode: 'SAVE10',
    }).expect(201);
    const again = await checkout(server, dana, held.holdId).expect(200);

    expect(again.body).toMatchObject({
      orderId: first.body.orderId,
      promoCode: 'SAVE10',
      totalAgorot: 9000,
    });
  });
});
