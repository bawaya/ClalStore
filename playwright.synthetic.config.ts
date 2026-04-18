import { defineConfig, devices } from "@playwright/test";

/**
 * Dedicated Playwright config for synthetic user journeys that run on
 * production (clalmobile.com) every 30 minutes.
 *
 * Separate from playwright.config.ts so it:
 *   - Only runs tests/synthetic/ (not tests/e2e/)
 *   - Has generous per-test timeout (production can be slow)
 *   - Retries flakes up to 3× before alerting
 */
export default defineConfig({
  testDir: "./tests/synthetic",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 3,
  workers: 2,
  reporter: [
    ["html", { outputFolder: "synthetic-report", open: "never" }],
    ["list"],
    ["json", { outputFile: "synthetic-results.json" }],
  ],
  timeout: 45_000,

  use: {
    baseURL: process.env.SYNTHETIC_BASE_URL || "https://clalmobile.com",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ar-IL",
    timezoneId: "Asia/Jerusalem",
    ignoreHTTPSErrors: false, // SSL must be valid
  },

  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
  ],
});
