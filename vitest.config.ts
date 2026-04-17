import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
    // Exclude Playwright E2E specs, smoke tests, staging tests, monitoring —
    // they have their own configs / runners.
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      'tests/e2e/**',
      'tests/smoke/**',
      'tests/staging/**',
      'tests/monitor/**',
    ],
    // Fork pool with isolated workers avoids the single-worker heap blow-up
    // once the test count is large (2500+ tests). Each fork gets its own
    // memory budget; tests run in parallel across forks.
    pool: 'forks',
    poolOptions: {
      forks: {
        maxForks: 4,
        minForks: 1,
        execArgv: ['--max-old-space-size=2048'],
      },
    },
    isolate: true,
    fileParallelism: true,
    testTimeout: 10_000,
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'tests/**',
        '.next/**',
        '.open-next/**',
        'node_modules/**',
        '**/*.config.*',
      ],
    },
  } as any,
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});
