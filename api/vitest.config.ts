import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Resolves the path aliases declared in tsconfig.json, including the ones
  // added by `nest g library`. Requires Vite 8, which ships this option.
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['**/*.spec.ts'],
    // Decorators like @Type() read metadata through `reflect-metadata`. In the
    // real app NestJS loads it; in unit tests there is no Nest, so we load it.
    setupFiles: ['reflect-metadata'],
  },
});
