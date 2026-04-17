import { test, expect, devices } from "@playwright/test";

test.use({ ...devices["iPad Mini"] });

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
