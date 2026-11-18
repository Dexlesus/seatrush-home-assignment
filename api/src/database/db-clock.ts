import { Injectable } from '@nestjs/common';
import { DataSource, type EntityManager } from 'typeorm';

/**
 * "Now", from the DATABASE clock.
 *
 * Every copy of the API asks the same PostgreSQL, so all copies agree on the
 * time, even if their own machines' clocks drift. Drop time (rule 2) and hold
 * expiry (rule 5) are both decided by this one clock.
 *
 * clock_timestamp(), NOT now(): inside a transaction, now() is frozen at the
 * moment the transaction STARTED. A request that waited 3 seconds for a row
 * lock would then decide with a time 3 seconds old, and could check out a
 * hold that has already expired. So the services read the clock AFTER taking
 * their locks, and clock_timestamp() gives the real time at that moment.
 */
@Injectable()
export class DbClock {
  constructor(private readonly dataSource: DataSource) {}

  /** Pass the transaction's manager to read the clock inside a transaction. */
  async now(manager: EntityManager = this.dataSource.manager): Promise<Date> {
    const rows = await manager.query<{ now: Date }[]>(
      'SELECT clock_timestamp() AS now',
    );
    const now = rows[0]?.now;
    if (!now) {
      throw new Error('SELECT clock_timestamp() returned no row');
    }
    return now;
  }
}
