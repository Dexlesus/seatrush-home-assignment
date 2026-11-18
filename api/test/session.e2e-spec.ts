import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('Fan identity: dana#4821 (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  /** POST /api/session { name } → the answer. */
  function logIn(name: string) {
    return request(t.app.getHttpServer()).post('/api/session').send({ name });
  }

  it('gives two people named Dana two different handles', async () => {
    const first = await logIn('Dana').expect(201);
    const second = await logIn('Dana').expect(201);

    expect(first.body.displayName).toBe('Dana');
    expect(first.body.handle).toMatch(/^dana#\d{4}$/);
    expect(second.body.handle).toMatch(/^dana#\d{4}$/);
    expect(first.body.handle).not.toBe(second.body.handle);

    const rows = await t.db.query<{ count: string }[]>(
      "select count(*) from fans where display_name = 'Dana'",
    );
    expect(rows[0]?.count).toBe('2');
  });

  it('logs an existing fan back in with their handle (any case): 200, same fan', async () => {
    const created = await logIn('Noa').expect(201);
    const handle: string = created.body.handle;

    const again = await logIn(handle.toUpperCase()).expect(200);

    expect(again.body).toMatchObject({ handle, displayName: 'Noa' });
  });

  it('answers 404 FAN_NOT_FOUND for a handle nobody has', async () => {
    const res = await logIn('ghost#0000').expect(404);

    expect(res.body.code).toBe('FAN_NOT_FOUND');
  });

  it('answers 400 INVALID_NAME for a name that is too short or has symbols', async () => {
    expect((await logIn('D').expect(400)).body.code).toBe('INVALID_NAME');
    expect((await logIn('<b>Dana</b>').expect(400)).body.code).toBe(
      'INVALID_NAME',
    );
  });

  it('GET /api/me knows the fan from the X-Username header, and answers 401 otherwise', async () => {
    const { body: dana } = await logIn('Dana').expect(201);
    const server = t.app.getHttpServer();

    const me = await request(server)
      .get('/api/me')
      .set('X-Username', dana.handle)
      .expect(200);
    expect(me.body).toMatchObject({
      handle: dana.handle,
      displayName: 'Dana',
    });

    const noHeader = await request(server).get('/api/me').expect(401);
    expect(noHeader.body.code).toBe('IDENTITY_REQUIRED');

    const unknown = await request(server)
      .get('/api/me')
      .set('X-Username', 'ghost#0000')
      .expect(401);
    expect(unknown.body.code).toBe('UNKNOWN_FAN');
  });
});
