import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

describe('App setup (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleRef.createNestApplication();
    // The same setup as main.ts, so the tests run the real app.
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health answers ok', async () => {
    await request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('an unknown route returns our error shape', async () => {
    const res = await request(app.getHttpServer()).get('/api/nope').expect(404);

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
    const res = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(res.body).toHaveProperty('openapi');
    expect(res.body).toHaveProperty(['paths', '/api/health']);
  });

  it('serves the interactive docs page at /docs', async () => {
    const res = await request(app.getHttpServer()).get('/docs').expect(200);

    expect(res.text).toContain('swagger');
  });
});
