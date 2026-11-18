import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FanEntity } from './fan.entity.js';
import { FanGuard } from './fan.guard.js';
import { FansService } from './fans.service.js';
import { SessionController } from './session.controller.js';

/** Fan identity: log in by name or handle, and FanGuard for fan-only routes. */
@Module({
  imports: [TypeOrmModule.forFeature([FanEntity])],
  controllers: [SessionController],
  providers: [FansService, FanGuard],
  // Other modules (holds, orders) import FansModule to use FanGuard.
  exports: [FansService, FanGuard],
})
export class FansModule {}
