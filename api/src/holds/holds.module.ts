import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { FansModule } from '../fans/fans.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { HoldsController } from './holds.controller.js';
import { HoldsService } from './holds.service.js';

/** Rules 2–7: holding and releasing seats. */
@Module({
  imports: [DatabaseModule, FansModule, IdempotencyModule],
  controllers: [HoldsController],
  providers: [HoldsService],
})
export class HoldsModule {}
