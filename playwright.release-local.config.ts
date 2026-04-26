import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || "http://127.0.0.1:3101";
const parsedBaseUrl = new URL(baseURL);
const hostname = parsedBaseUrl.hostname || "127.0.0.1";
const port = parsedBaseUrl.port || "3101";

export default defineConfig({
  testDir: "./tests/release",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["html", { open: "never", outputFolder: "playwright-report/release-local" }], ["list"]],
  timeout: 60_000,
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ar-IL",
    timezoneId: "Asia/Jerusalem",
  },
  projects: [{ name: "chromium-desktop", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `npm run start -- --hostname ${hostname} --port ${port}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
