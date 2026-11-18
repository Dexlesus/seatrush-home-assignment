import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DatabaseModule } from '../database/database.module.js';
import { EventEntity } from './entities/event.entity.js';
import { SeatEntity } from './entities/seat.entity.js';
import { ZoneEntity } from './entities/zone.entity.js';
import { DemoEventSeeder } from './demo-event.seeder.js';
import { EventsController } from './events.controller.js';
import { EventsService } from './events.service.js';

/** Rule 1: events, their zones and their seat map. */
@Module({
  imports: [
    TypeOrmModule.forFeature([EventEntity, ZoneEntity, SeatEntity]),
    DatabaseModule,
  ],
  controllers: [EventsController],
  providers: [EventsService, DemoEventSeeder],
  exports: [EventsService],
})
export class EventsModule {}
