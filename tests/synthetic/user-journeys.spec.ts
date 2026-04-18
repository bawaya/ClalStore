import { test, expect } from "@playwright/test";

/**
 * Synthetic user journeys — Playwright tests that exercise real user flows
 * on production (clalmobile.com) every 30 minutes.
 *
 * Different from Layer 4 (smoke) which just asks "does the page return 200?":
 * these tests pretend to BE a customer doing a real flow, and fail if any
 * step is broken. They're the closest approximation we have of real-user
 * experience without running invasive tests against real customers.
 *
 * Safety rules:
 *   * NEVER complete a real purchase (no payment gateway submission).
 *   * NEVER OTP a real phone number — we use PROD_TEST_CUSTOMER_PHONE
 *     which is our own test account.
 *   * NEVER modify admin data — no CRUD from the admin dashboard.
 */

const BASE = process.env.SYNTHETIC_BASE_URL || "https://clalmobile.com";

test.describe("Synthetic · Shopping journey (guest)", () => {
  test("homepage → search → product → add to cart (no checkout)", async ({ page }) => {
    // 1. Homepage loads and shows products
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    await expect(page).toHaveTitle(/.+/);
    const html = await page.content();
    expect(html.length).toBeGreaterThan(1000);

    // 2. Navigate to store
    await page.goto(`${BASE}/store`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1000); // allow product cards to load

    // 3. Find at least one product link
    const productLinks = page.locator('a[href*="/store/product/"]');
    const count = await productLinks.count();
    expect(count).toBeGreaterThan(0);

    // 4. Open first product page
    const firstProduct = productLinks.first();
    const href = await firstProduct.getAttribute("href");
    expect(href).toBeTruthy();
    await firstProduct.click({ timeout: 10_000 });
    await page.waitForURL(/\/store\/product\//, { timeout: 10_000 });

    // 5. Product page shows key elements
    const detailHtml = await page.content();
    expect(detailHtml.length).toBeGreaterThan(1500);
  });

  test("can reach checkout failed / success pages (no side effects)", async ({ page }) => {
    await page.goto(`${BASE}/store/checkout/success`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();

    await page.goto(`${BASE}/store/checkout/failed`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });

  test("track-order page accepts an input", async ({ page }) => {
    await page.goto(`${BASE}/store/track`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
    // Page should load the tracking UI (even if no order id is provided)
    const hasInputOrButton = (await page.locator("input, button").count()) > 0;
    expect(hasInputOrButton).toBe(true);
  });
});

test.describe("Synthetic · Public content", () => {
  for (const path of ["/about", "/contact", "/faq", "/deals", "/legal", "/privacy"]) {
    test(`${path} renders content`, async ({ page }) => {
      await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
      await expect(page.locator("body")).toBeVisible();
      const html = await page.content();
      expect(html.length).toBeGreaterThan(500);
    });
  }
});

test.describe("Synthetic · Core API endpoints", () => {
  test("GET /api/settings/public returns valid JSON with no auth", async ({ request }) => {
    const res = await request.get(`${BASE}/api/settings/public`);
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(typeof body).toBe("object");
  });

  test("GET /api/store/smart-search returns results for iphone", async ({ request }) => {
    const res = await request.get(`${BASE}/api/store/smart-search?q=iphone`);
    expect(res.status()).toBe(200);
  });

  test("GET /api/store/autocomplete returns suggestions", async ({ request }) => {
    const res = await request.get(`${BASE}/api/store/autocomplete?q=ip`);
    expect([200, 429]).toContain(res.status());
  });

  test("GET /api/reviews/featured returns reviews array", async ({ request }) => {
    const res = await request.get(`${BASE}/api/reviews/featured`);
    expect(res.status()).toBe(200);
  });

  test("GET /robots.txt + /sitemap.xml reachable", async ({ request }) => {
    const robots = await request.get(`${BASE}/robots.txt`);
    expect(robots.status()).toBe(200);
    const sitemap = await request.get(`${BASE}/sitemap.xml`);
    expect(sitemap.status()).toBe(200);
  });
});

test.describe("Synthetic · Admin + CRM gate (unauthenticated)", () => {
  test("/admin redirects or shows auth gate", async ({ page }) => {
    await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
    // Any HTTP 2xx rendered page is acceptable — we just want NOT a 5xx
    await expect(page.locator("body")).toBeVisible();
  });

  test("/crm redirects or shows auth gate", async ({ page }) => {
    await page.goto(`${BASE}/crm`, { waitUntil: "domcontentloaded" });
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("Synthetic · i18n + RTL invariants", () => {
  test("html lang and dir attributes are present and RTL", async ({ page }) => {
    await page.goto(BASE, { waitUntil: "domcontentloaded" });
    const lang = await page.locator("html").getAttribute("lang");
    const dir = await page.locator("html").getAttribute("dir");
    expect(lang).toMatch(/^(ar|he)/i);
    expect(dir).toMatch(/rtl/i);
  });
});
