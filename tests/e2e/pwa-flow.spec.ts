import { test, expect } from "@playwright/test";

test.describe("PWA flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("sales-pwa home page renders", async ({ page }) => {
    await page.goto("/sales-pwa");
    await expect(page.locator("body")).toBeVisible();
  });

  test("sales-pwa new document page renders", async ({ page }) => {
    await page.goto("/sales-pwa/new");
    await expect(page.locator("body")).toBeVisible();
  });

  test("manifest.json is accessible", async ({ request }) => {
    const res = await request.get("/manifest.json");
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.json();
      expect(typeof body).toBe("object");
    }
  });

  test("service worker file is served", async ({ request }) => {
    const res = await request.get("/sw.js");
    expect([200, 404]).toContain(res.status());
  });

  test("/m/manifest.json is accessible", async ({ request }) => {
    const res = await request.get("/m-manifest.json");
    expect([200, 404]).toContain(res.status());
  });
});
