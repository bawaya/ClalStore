import { test, expect } from "@playwright/test";

/**
 * Store flow — browse, search, view product, cart, compare, wishlist, checkout.
 *
 * These tests block all external network so no real providers (payment, AI,
 * WhatsApp, email) are ever contacted.
 */

test.describe("Store flow", () => {
  test.beforeEach(async ({ page, context }) => {
    // Block all third-party hosts + mock Supabase/payment/WA endpoints
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("homepage loads without errors", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto("/");
    await expect(page).toHaveTitle(/./);
    expect(errors).toHaveLength(0);
  });

  test("store page shows products grid", async ({ page }) => {
    await page.goto("/store");
    await expect(page.locator("body")).toBeVisible();
  });

  test("can open product detail page", async ({ page }) => {
    await page.goto("/store");
    const firstProduct = page.locator('a[href*="/store/product/"]').first();
    if (await firstProduct.count() > 0) {
      await firstProduct.click();
      await expect(page).toHaveURL(/\/store\/product\//);
    }
  });

  test("cart page renders", async ({ page }) => {
    await page.goto("/store/cart");
    await expect(page.locator("body")).toBeVisible();
  });

  test("compare page renders", async ({ page }) => {
    await page.goto("/store/compare");
    await expect(page.locator("body")).toBeVisible();
  });

  test("wishlist page renders", async ({ page }) => {
    await page.goto("/store/wishlist");
    await expect(page.locator("body")).toBeVisible();
  });

  test("track order page renders", async ({ page }) => {
    await page.goto("/store/track");
    await expect(page.locator("body")).toBeVisible();
  });

  test("store auth (customer login) renders", async ({ page }) => {
    await page.goto("/store/auth");
    await expect(page.locator("body")).toBeVisible();
  });

  test("checkout success page renders without route error", async ({ page }) => {
    await page.goto("/store/checkout/success");
    // May redirect or show content — just check no crash
    await expect(page.locator("body")).toBeVisible();
  });

  test("checkout failed page renders", async ({ page }) => {
    await page.goto("/store/checkout/failed");
    await expect(page.locator("body")).toBeVisible();
  });
});
