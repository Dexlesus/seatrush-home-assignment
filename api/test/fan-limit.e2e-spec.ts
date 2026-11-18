import type { App } from 'supertest/types.js';
import { checkout, createEvent, hold, logIn, release } from './support/api.js';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Rule 4: at most 4 seats per fan per event (e2e)', () => {
  let t: TestApp;
  let server: App;

  beforeAll(async () => {
    t = await createTestApp();
    server = t.app.getHttpServer();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('3 held + 2 more is refused with FAN_LIMIT_REACHED, saying 1 is left', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    await hold(server, dana, eventId, { seats: ['A1', 'A2', 'A3'] }).expect(
      201,
    );

    const res = await hold(server, dana, eventId, {
      seats: ['B1', 'B2'],
    }).expect(409);

    expect(res.body).toMatchObject({
      code: 'FAN_LIMIT_REACHED',
      details: { limit: 4, current: 3, remaining: 1 },
    });
    await hold(server, dana, eventId, { seats: ['B1'] }).expect(201); // exactly 4
  });

  it('bought seats count too: 2 bought + 3 more is refused', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const { body } = await hold(server, dana, eventId, {
      seats: ['A1', 'A2'],
    }).expect(201);
    await checkout(server, dana, body.holdId).expect(201);

    const res = await hold(server, dana, eventId, {
      seats: ['B1', 'B2', 'B3'],
    }).expect(409);

    expect(res.body.details).toEqual({ limit: 4, current: 2, remaining: 2 });
  });

  it('the limit is per event: 4 seats here does not block another event', async () => {
    const first = await createEvent(server);
    const second = await createEvent(server);
    const dana = await logIn(server, 'Dana');

    await hold(server, dana, first, { seats: ['A1', 'A2', 'A3', 'A4'] }).expect(
      201,
    );
    await hold(server, dana, second, { seats: ['A1'] }).expect(201);
  });

  it('released seats stop counting: release 4, hold 4 again', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const { body } = await hold(server, dana, eventId, {
      seats: ['A1', 'A2', 'A3', 'A4'],
    }).expect(201);

    await release(server, dana, body.holdId).expect(204);

    await hold(server, dana, eventId, {
      seats: ['B1', 'B2', 'B3', 'B4'],
    }).expect(201);
  });

  it('every fan has their own limit', async () => {
    const eventId = await createEvent(server);
    const dana = await logIn(server, 'Dana');
    const noa = await logIn(server, 'Noa');

    await hold(server, dana, eventId, {
      seats: ['A1', 'A2', 'A3', 'A4'],
    }).expect(201);
    await hold(server, noa, eventId, {
      seats: ['B1', 'B2', 'B3', 'B4'],
    }).expect(201);
  });
});
