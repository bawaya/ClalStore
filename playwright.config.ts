import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright configuration for ClalMobile E2E tests.
 *
 * IMPORTANT: This config assumes the dev server is already running at
 * http://localhost:3000. To run against a running dev server:
 *   npx playwright test
 *
 * To auto-start the dev server, uncomment the `webServer` block below.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [["html", { open: "never" }], ["list"]],
  timeout: 30_000,

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ar-IL",
    timezoneId: "Asia/Jerusalem",
    // CRITICAL: block all external network in E2E — no real API calls
    extraHTTPHeaders: { "x-test-mode": "e2e" },
  },

  projects: [
    { name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "chromium-mobile", use: { ...devices["Pixel 5"] } },
    { name: "tablet", use: { ...devices["iPad Mini"] } },
    { name: "webkit-desktop", use: { ...devices["Desktop Safari"] } },
  ],

  // webServer: {
  //   command: "npm run dev",
  //   url: "http://localhost:3000",
  //   reuseExistingServer: !process.env.CI,
  //   timeout: 120_000,
  // },
});
