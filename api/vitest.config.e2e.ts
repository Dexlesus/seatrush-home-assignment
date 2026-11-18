import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.e2e-spec.ts'],
    reporters: ['verbose'],
    setupFiles: ['reflect-metadata'],
    // Every E2E file starts its own PostgreSQL container. At most 4 files at a
    // time, so a busy machine doesn't time out while starting 13 containers.
    maxWorkers: 4,
    // Starting a container (and the first image download) can take a while.
    hookTimeout: 120_000,
  },
});
