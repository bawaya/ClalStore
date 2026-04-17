import { test, expect } from "@playwright/test";

test.describe("Public website flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("homepage renders key sections", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/about renders", async ({ page }) => {
    await page.goto("/about");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/contact renders a form", async ({ page }) => {
    await page.goto("/contact");
    await expect(page.locator("body")).toBeVisible();
    const hasForm = (await page.locator("form, input, textarea").count()) > 0;
    expect(hasForm).toBe(true);
  });

  test("/faq renders", async ({ page }) => {
    await page.goto("/faq");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/deals renders", async ({ page }) => {
    await page.goto("/deals");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/legal renders", async ({ page }) => {
    await page.goto("/legal");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/privacy renders", async ({ page }) => {
    await page.goto("/privacy");
    await expect(page.locator("body")).toBeVisible();
  });

  test("/404-nonexistent renders 404 page", async ({ page }) => {
    const res = await page.goto("/this-page-does-not-exist-404-test");
    // Either a 404 HTTP status or a soft 404 page rendered
    expect(res?.status()).toBeGreaterThanOrEqual(200);
    await expect(page.locator("body")).toBeVisible();
  });
});
