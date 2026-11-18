import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

const MINUTE = 60 * 1000;

/** An event whose tickets go on sale `dropInMinutes` from now (negative = already on sale). */
function eventDroppingIn(dropInMinutes: number, name: string) {
  return {
    name,
    venue: 'Barby',
    startsAt: new Date(Date.now() + 7 * 24 * 60 * MINUTE).toISOString(),
    dropAt: new Date(Date.now() + dropInMinutes * MINUTE).toISOString(),
    rowCount: 3,
    seatsPerRow: 4,
    zones: [{ name: 'All', fromRow: 'A', toRow: 'C', priceAgorot: 10000 }],
  };
}

describe('Rule 2: drop time (e2e)', () => {
  let t: TestApp;
  let notYetId: string;
  let onSaleId: string;

  beforeAll(async () => {
    t = await createTestApp();
    const server = t.app.getHttpServer();
    notYetId = (
      await request(server)
        .post('/api/events')
        .send(eventDroppingIn(10, 'Not yet'))
        .expect(201)
    ).body.id;
    onSaleId = (
      await request(server)
        .post('/api/events')
        .send(eventDroppingIn(-10, 'On sale'))
        .expect(201)
    ).body.id;
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('lists events with "is the sale open?" and the server time, for the countdown', async () => {
    const res = await request(t.app.getHttpServer())
      .get('/api/events')
      .expect(200);

    const events: { id: string; saleOpen: boolean }[] = res.body.events;
    expect(events.find((e) => e.id === notYetId)?.saleOpen).toBe(false);
    expect(events.find((e) => e.id === onSaleId)?.saleOpen).toBe(true);

    // The server's clock, so the screen can count down without trusting the
    // fan's computer clock. It must be close to "now".
    const serverNow = Date.parse(res.body.serverNow);
    expect(Math.abs(serverNow - Date.now())).toBeLessThan(MINUTE);
  });

  it('lets anyone view an event before the drop, without logging in', async () => {
    const res = await request(t.app.getHttpServer())
      .get(`/api/events/${notYetId}`) // no X-Username header
      .expect(200);

    expect(res.body).toMatchObject({ id: notYetId, saleOpen: false });
    expect(res.body).toHaveProperty('serverNow');
  });

  it('lets anyone see the seat map before the drop, without logging in', async () => {
    const res = await request(t.app.getHttpServer())
      .get(`/api/events/${notYetId}/seats`)
      .expect(200);

    expect(res.body.seats).toHaveLength(12);
    expect(res.body).toHaveProperty('serverNow');
  });

  it('marks an event whose drop time has passed as open', async () => {
    const res = await request(t.app.getHttpServer())
      .get(`/api/events/${onSaleId}`)
      .expect(200);

    expect(res.body.saleOpen).toBe(true);
  });
});
