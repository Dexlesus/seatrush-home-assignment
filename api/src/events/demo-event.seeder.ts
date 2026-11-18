import {
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import type { EnvironmentVariables } from '../config/env.validation.js';
import { EventsService } from './events.service.js';

const DAY = 24 * 60 * 60 * 1000;

/**
 * The brief: `docker compose up` on a fresh clone creates the database and one
 * demo event that is already on sale. Runs after the migrations, once, and
 * only when there are no events yet (so a restart never adds a second one).
 */
@Injectable()
export class DemoEventSeeder implements OnApplicationBootstrap {
  private readonly logger = new Logger(DemoEventSeeder.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly events: EventsService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (!this.config.get('SEED_DEMO_EVENT', { infer: true })) {
      return;
    }

    await this.dataSource.transaction(async (manager) => {
      // If several API copies start at once, only one seeds: the others wait
      // for this lock, then see that an event already exists. Waiting here is
      // expected, so this transaction gets a longer lock limit than requests.
      await manager.query(`SET LOCAL lock_timeout = '30s'`);
      await manager.query('SELECT pg_advisory_xact_lock(424242)');
      const rows = await manager.query<{ count: string }[]>(
        'SELECT count(*) FROM events',
      );
      if (Number(rows[0]?.count) > 0) {
        return;
      }

      const event = await this.events.create({
        name: 'SeatRush Live: Opening Night',
        venue: 'Menora Mivtachim Arena, Tel Aviv',
        startsAt: new Date(Date.now() + 30 * DAY).toISOString(),
        dropAt: new Date(Date.now() - 60 * 1000).toISOString(), // on sale now
        rowCount: 10,
        seatsPerRow: 16,
        zones: [
          { name: 'VIP', fromRow: 'A', toRow: 'B', priceAgorot: 45000 },
          { name: 'Floor', fromRow: 'C', toRow: 'F', priceAgorot: 28000 },
          { name: 'Balcony', fromRow: 'G', toRow: 'J', priceAgorot: 14900 },
        ],
      });
      this.logger.log(`Created the demo event "${event.name}" (${event.id})`);
    });
  }
}
