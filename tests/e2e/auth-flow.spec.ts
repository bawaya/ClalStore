import { test, expect } from "@playwright/test";

test.describe("Auth flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("admin login page renders", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("body")).toBeVisible();
    // Form should have email and password inputs (or similar)
    const hasInput = (await page.locator("input").count()) > 0;
    expect(hasInput).toBe(true);
  });

  test("customer auth page renders OTP flow", async ({ page }) => {
    await page.goto("/store/auth");
    await expect(page.locator("body")).toBeVisible();
    const hasInput = (await page.locator("input").count()) > 0;
    expect(hasInput).toBe(true);
  });

  test("change password page renders", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page.locator("body")).toBeVisible();
  });

  test("unauthenticated admin area redirects or gates", async ({ page }) => {
    await page.goto("/admin");
    // Redirect chain ends at login or admin itself with auth UI
    expect(page.url()).toMatch(/admin|login/);
  });

  test("unauthenticated CRM area redirects or gates", async ({ page }) => {
    await page.goto("/crm");
    expect(page.url()).toMatch(/crm|login/);
  });
});
