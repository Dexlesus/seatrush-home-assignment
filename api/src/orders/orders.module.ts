import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { FansModule } from '../fans/fans.module.js';
import { IdempotencyModule } from '../idempotency/idempotency.module.js';
import { OrdersController } from './orders.controller.js';
import { OrdersService } from './orders.service.js';

/** Rule 8: checkout and "My tickets". */
@Module({
  imports: [DatabaseModule, FansModule, IdempotencyModule],
  controllers: [OrdersController],
  providers: [OrdersService],
})
export class OrdersModule {}
