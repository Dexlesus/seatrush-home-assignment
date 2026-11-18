import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { validateEnv } from './config/env.validation.js';
import { HealthController } from './health/health.controller.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true, // any module can inject ConfigService without importing it
      cache: true, // read the values once, not on every get()
      // A .env file is optional. When the API runs from /api, it looks in /api
      // first, then in the repo root, where .env.example lives.
      envFilePath: ['.env', '../.env'],
      validate: validateEnv, // fail fast on bad config
    }),
  ],
  controllers: [HealthController],
})
export class AppModule {}
