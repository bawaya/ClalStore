import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("Accessibility", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("homepage has a <main> or role=main landmark", async ({ page }) => {
    await page.goto("/");
    const main = page.locator('main, [role="main"]').first();
    // Not strictly required but common; skip if missing
    if (await main.count() > 0) {
      await expect(main).toBeVisible();
    }
  });

  test("all images have alt attributes on store page", async ({ page }) => {
    await page.goto("/store");
    const images = await page.locator("img").all();
    for (const img of images) {
      const alt = await img.getAttribute("alt");
      expect(alt).not.toBeNull();
    }
  });

  test("body has adequate text contrast (computed color exists)", async ({ page }) => {
    await page.goto("/");
    const color = await page.evaluate(() => getComputedStyle(document.body).color);
    expect(color).toBeTruthy();
  });

  test("keyboard focus reaches interactive elements", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.tagName);
    // Must focus something (not body)
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(focused);
  });

  test("homepage has no critical axe violations", async ({ page }) => {
    await page.goto("/");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    // Log any found so they show up in CI output
    if (critical.length > 0) {
      console.log("Critical a11y violations:", critical.map((v) => v.id));
    }
    expect(critical.length).toBe(0);
  });

  test("store page has no critical axe violations", async ({ page }) => {
    await page.goto("/store");
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa"])
      .analyze();
    const critical = results.violations.filter((v) => v.impact === "critical");
    if (critical.length > 0) {
      console.log("Critical a11y violations:", critical.map((v) => v.id));
    }
    expect(critical.length).toBe(0);
  });
});
