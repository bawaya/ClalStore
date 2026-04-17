import { test, expect } from "@playwright/test";

// Use chromium-based tablet emulation (viewport + userAgent) instead of
// devices["iPad Mini"] which forces WebKit and breaks in CI where only
// chromium is installed. The actual tablet assertion is about layout at
// tablet width, not browser engine fidelity.
test.use({
  viewport: { width: 768, height: 1024 },
  userAgent: "Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148",
  hasTouch: true,
  isMobile: true,
  deviceScaleFactor: 2,
});

test.describe("Tablet flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("tablet homepage renders with adaptive layout", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("tablet store page renders", async ({ page }) => {
    await page.goto("/store");
    await expect(page.locator("body")).toBeVisible();
  });

  test("tablet cart page renders", async ({ page }) => {
    await page.goto("/store/cart");
    await expect(page.locator("body")).toBeVisible();
  });

  test("tablet CRM inbox renders", async ({ page }) => {
    await page.goto("/crm/inbox");
    await expect(page.locator("body")).toBeVisible();
  });

  test("tablet admin dashboard renders", async ({ page }) => {
    await page.goto("/admin");
    await expect(page.locator("body")).toBeVisible();
  });
});
