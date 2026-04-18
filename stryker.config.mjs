// @ts-check
/**
 * Stryker — mutation testing for ClalMobile.
 *
 * Runs ONLY against the high-value pure logic files we've invested in
 * covering with unit tests. The goal is to catch tests that are
 * "technically covered" but don't actually assert meaningful behavior.
 *
 * To run locally:
 *   npx stryker run
 *
 * To test a single file quickly:
 *   npx stryker run --mutate lib/validators.ts
 */

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  packageManager: "npm",
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  reporters: ["html", "clear-text", "progress", "dashboard"],

  // Mutate ONLY the files with unit tests that claim ≥90% coverage.
  // Adding more files is easy — just expand this list.
  mutate: [
    "lib/validators.ts",
    "lib/utils.ts",
    "lib/loyalty.ts",
    "lib/commissions/calculator.ts",
    "lib/commissions/ledger.ts",
    "lib/commissions/sync-orders.ts",
    "lib/admin/auth.ts",
    "lib/crm/sentiment.ts",
    "lib/crm/customer-timeline.ts",
    "lib/bot/intents.ts",
    "lib/bot/guardrails.ts",
    "lib/bot/playbook.ts",
    "lib/payment-gateway.ts",
    "lib/rate-limit.ts",
    "lib/webhook-verify.ts",
    "lib/cities.ts",
    "lib/brand-config.ts",
    "lib/pwa/customer-linking.ts",
    "lib/pwa/validators.ts",
    "lib/supabase.ts",
  ],

  // Skip files that are hard to mutation-test (HOC wrappers, decorators, etc)
  ignorePatterns: [
    "tests/**",
    "app/**",
    "components/**",
    ".next/**",
    ".open-next/**",
    "coverage/**",
    "playwright-report/**",
    "node_modules/**",
  ],

  // Thresholds — build fails if mutation score drops below these
  thresholds: {
    high: 80,
    low: 60,
    break: 50, // CI fails when below 50%
  },

  timeoutMS: 60000,
  timeoutFactor: 2,
  concurrency: 4,

  // Disable mutators that generate noisy, non-informative mutations
  disableTypeChecks: true,
  checkers: [],

  // File to track dashboard state (ignored by git)
  tempDirName: ".stryker-tmp",
};
