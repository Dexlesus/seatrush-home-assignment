import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

export interface TestDatabase {
  /** Everything a client needs to connect: host, port, user, password, database. */
  connection: {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
  };
  /** Stops the container and deletes it, with all its data. */
  stop: () => Promise<void>;
}

/**
 * Starts a brand-new, empty PostgreSQL in Docker, just for one test file.
 * Same version as docker-compose.yml, so tests run on what production runs.
 * Docker gives it a random free port, so it never touches the dev database.
 */
export async function startTestDatabase(): Promise<TestDatabase> {
  const container: StartedPostgreSqlContainer = await new PostgreSqlContainer(
    'postgres:17-alpine',
  ).start();

  return {
    connection: {
      host: container.getHost(),
      port: container.getPort(),
      user: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    },
    stop: async () => {
      await container.stop();
    },
  };
}
