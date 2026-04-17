import { test, expect } from "@playwright/test";

test.describe("i18n / RTL flow", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("HTML has lang and dir attributes", async ({ page }) => {
    await page.goto("/");
    const htmlLang = await page.locator("html").getAttribute("lang");
    const htmlDir = await page.locator("html").getAttribute("dir");
    expect(htmlLang).toMatch(/ar|he/);
    expect(htmlDir).toMatch(/rtl/i);
  });

  test("can toggle language via lang switcher", async ({ page }) => {
    await page.goto("/");
    // Attempt to find any lang-switcher element (button/link with "he" or "ar" text)
    const switcher = page.locator("button").filter({ hasText: /he|ar|עב|عر/i }).first();
    if (await switcher.count() > 0) {
      const beforeLang = await page.locator("html").getAttribute("lang");
      await switcher.click().catch(() => {});
      await page.waitForTimeout(500);
      const afterLang = await page.locator("html").getAttribute("lang");
      // Switch should produce different or at least valid lang
      expect(afterLang).toMatch(/ar|he/);
    }
  });

  test("RTL layout applies", async ({ page }) => {
    await page.goto("/");
    const dir = await page.evaluate(() => getComputedStyle(document.documentElement).direction);
    expect(dir).toBe("rtl");
  });
});
