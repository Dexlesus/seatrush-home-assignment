import type { App } from 'supertest/types.js';
import { createEvent, hold, logIn } from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Rule 4: the limit comes from MAX_SEATS_PER_USER (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp({ MAX_SEATS_PER_USER: '2' });
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('with MAX_SEATS_PER_USER=2, 3 seats are refused and 2 are fine', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    const tooMany = await hold(server, dana, eventId, {
      seats: ['A1', 'A2', 'A3'],
    }).expect(409);
    expect(tooMany.body.details).toEqual({
      limit: 2,
      current: 0,
      remaining: 2,
    });

    await hold(server, dana, eventId, { seats: ['A1', 'A2'] }).expect(201);
  });
});
