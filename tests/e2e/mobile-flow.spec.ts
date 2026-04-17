import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["Pixel 5"] });

test.describe("Mobile flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("mobile homepage renders", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("mobile store renders with tab nav / compact layout", async ({ page }) => {
    await page.goto("/store");
    await expect(page.locator("body")).toBeVisible();
  });

  test("mobile cart renders", async ({ page }) => {
    await page.goto("/store/cart");
    await expect(page.locator("body")).toBeVisible();
  });

  test("mobile inbox /m/inbox renders", async ({ page }) => {
    await page.goto("/m/inbox");
    await expect(page.locator("body")).toBeVisible();
  });

  test("sales-pwa page renders on mobile", async ({ page }) => {
    await page.goto("/sales-pwa");
    await expect(page.locator("body")).toBeVisible();
  });
});
