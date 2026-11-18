import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { validateEnv } from './config/env.validation.js';
import { typeOrmOptions } from './database/typeorm.config.js';
import { EventsModule } from './events/events.module.js';
import { FansModule } from './fans/fans.module.js';
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
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: typeOrmOptions,
    }),
    EventsModule,
    FansModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
