import type { MigrationInterface } from 'typeorm';
import { CreateEventsZonesSeats1763424000000 } from './1763424000000-create-events-zones-seats.js';
import { CreateFans1763424100000 } from './1763424100000-create-fans.js';

/**
 * Every migration, oldest first. TypeORM runs the ones the database hasn't
 * seen yet when the app starts, and remembers them in its `migrations` table.
 *
 * Listed by hand (not found by a file pattern) so it works the same in
 * TypeScript tests and in the built JavaScript.
 */
export const MIGRATIONS: (new () => MigrationInterface)[] = [
  CreateEventsZonesSeats1763424000000,
  CreateFans1763424100000,
];
