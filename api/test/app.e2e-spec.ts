import request from 'supertest';
import { createTestApp, type TestApp } from './support/test-app.js';

describe('App setup (e2e)', () => {
  let t: TestApp;

  beforeAll(async () => {
    t = await createTestApp();
  }, 120_000);

  afterAll(async () => {
    await t.close();
  });

  it('GET /api/health answers ok', async () => {
    await request(t.app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('an unknown route returns our error shape', async () => {
    const res = await request(t.app.getHttpServer())
      .get('/api/nope')
      .expect(404);

    expect(res.body).toMatchObject({
      statusCode: 404,
      code: 'NOT_FOUND',
      path: '/api/nope',
      details: {},
    });
    expect(res.body).toHaveProperty('message');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('serves the OpenAPI JSON at /docs-json, including our routes', async () => {
    const res = await request(t.app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(res.body).toHaveProperty('openapi');
    expect(res.body).toHaveProperty(['paths', '/api/health']);
  });

  it('serves the interactive docs page at /docs', async () => {
    const res = await request(t.app.getHttpServer()).get('/docs').expect(200);

    expect(res.text).toContain('swagger');
  });
});
