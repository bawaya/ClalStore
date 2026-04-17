import { defineConfig } from "vitest/config";
import path from "path";

/**
 * Vitest configuration for Layer 4 — Production smoke tests.
 * Runs against the live production site — does NOT hit jsdom.
 */
export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["tests/smoke/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    pool: "forks",
    poolOptions: { forks: { maxForks: 2 } },
  } as any,
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
