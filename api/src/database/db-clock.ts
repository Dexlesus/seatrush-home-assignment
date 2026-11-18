import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

/**
 * "Now", from the DATABASE clock.
 *
 * Every copy of the API asks the same PostgreSQL, so all copies agree on the
 * time, even if their own machines' clocks drift. Drop time (rule 2) and hold
 * expiry (rule 5) are both decided by this one clock.
 */
@Injectable()
export class DbClock {
  constructor(private readonly dataSource: DataSource) {}

  /** Pass the transaction's manager to read the clock inside a transaction. */
  async now(manager: EntityManager = this.dataSource.manager): Promise<Date> {
    const rows = await manager.query<{ now: Date }[]>('SELECT now() AS now');
    const now = rows[0]?.now;
    if (!now) {
      throw new Error('SELECT now() returned no row');
    }
    return now;
  }
}
