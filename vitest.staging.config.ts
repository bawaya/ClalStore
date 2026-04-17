import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/staging/**/*.test.ts'],
    testTimeout: 30000,
    hookTimeout: 60000,
    pool: 'forks',
    poolOptions: { forks: { maxForks: 1 } }, // serial — no parallel against shared DB
  } as any,
  resolve: { alias: { '@': path.resolve(__dirname, '.') } },
});
