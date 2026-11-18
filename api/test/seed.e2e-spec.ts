import request from 'supertest';
import type { App } from 'supertest/types.js';
import { createTestApp, type TestApp } from './support/test-app.js';

/** The brief: a fresh start creates the database and ONE demo event already on sale. */
describe('Demo event on a fresh start (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp({ SEED_DEMO_EVENT: 'true' });
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('creates exactly one demo event, already on sale', async () => {
    const res = await request(server).get('/api/events').expect(200);

    expect(res.body.events).toHaveLength(1);
    expect(res.body.events[0].saleOpen).toBe(true);
  });

  it('the demo event has a seat map with several zones, all seats available', async () => {
    const list = await request(server).get('/api/events').expect(200);
    const eventId: string = list.body.events[0].id;

    const res = await request(server)
      .get(`/api/events/${eventId}/seats`)
      .expect(200);

    const seats = res.body.seats as { zone: string; status: string }[];
    expect(new Set(seats.map((s) => s.zone)).size).toBeGreaterThan(1);
    expect(seats.every((s) => s.status === 'AVAILABLE')).toBe(true);
  });

  it('GET /api/health checks the database too', async () => {
    await request(server)
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok', database: 'up' });
  });
});
