import { Module } from '@nestjs/common';
import { DbClock } from './db-clock.js';

/** Shared database helpers: the database clock. */
@Module({
  providers: [DbClock],
  exports: [DbClock],
})
export class DatabaseModule {}
