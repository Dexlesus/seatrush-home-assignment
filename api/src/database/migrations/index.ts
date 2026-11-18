import type { MigrationInterface } from 'typeorm';

/**
 * Every migration, oldest first. TypeORM runs the ones the database hasn't
 * seen yet when the app starts, and remembers them in its `migrations` table.
 *
 * Listed by hand (not found by a file pattern) so it works the same in
 * TypeScript tests and in the built JavaScript.
 */
export const MIGRATIONS: (new () => MigrationInterface)[] = [];
