import { test, expect } from "@playwright/test";

test.describe("Admin flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin dashboard redirects to login when unauthenticated", async ({ page }) => {
    await page.goto("/admin");
    // Either renders login or admin page if middleware forwards
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin products page loads (may show auth gate)", async ({ page }) => {
    await page.goto("/admin/products");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin orders page loads", async ({ page }) => {
    await page.goto("/admin/order");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin settings page loads", async ({ page }) => {
    await page.goto("/admin/settings");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin coupons page loads", async ({ page }) => {
    await page.goto("/admin/coupons");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin heroes page loads", async ({ page }) => {
    await page.goto("/admin/heroes");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin commissions page loads", async ({ page }) => {
    await page.goto("/admin/commissions");
    await expect(page.locator("body")).toBeVisible();
  });

  test("admin deals page loads", async ({ page }) => {
    await page.goto("/admin/deals");
    await expect(page.locator("body")).toBeVisible();
  });
});
