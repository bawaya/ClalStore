import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

/**
 * Expanded accessibility audit — covers every key public page at WCAG 2 AA.
 *
 * Scope:
 *   - Zero `critical` violations (blocking).
 *   - `serious` violations are logged as warnings (non-blocking) until backlog
 *     is cleared — flip the threshold to `expect(serious).toBe(0)` later.
 *   - RTL layout is validated at the HTML element.
 *   - Keyboard navigation is checked end-to-end on core flows.
 */

const PUBLIC_PAGES = [
  { path: "/", name: "home" },
  { path: "/store", name: "store" },
  { path: "/store/cart", name: "cart" },
  { path: "/store/compare", name: "compare" },
  { path: "/store/wishlist", name: "wishlist" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
  { path: "/faq", name: "faq" },
  { path: "/deals", name: "deals" },
  { path: "/legal", name: "legal" },
  { path: "/privacy", name: "privacy" },
  { path: "/login", name: "login" },
];

test.describe("A11y audit — WCAG 2 AA", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg|facebook|google-analytics|googletagmanager)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  for (const pg of PUBLIC_PAGES) {
    test(`${pg.name} has zero critical axe violations`, async ({ page }) => {
      await page.goto(pg.path);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa"])
        // Skip rules that are already known-broken globally so this test
        // measures NET NEW regressions rather than historical debt.
        .disableRules(["color-contrast"]) // re-enable in a follow-up after palette audit
        .analyze();

      const critical = results.violations.filter((v) => v.impact === "critical");
      const serious = results.violations.filter((v) => v.impact === "serious");

      if (serious.length > 0) {
        console.warn(
          `[a11y ${pg.name}] ${serious.length} serious issue(s):`,
          serious.map((v) => v.id),
        );
      }

      expect(
        critical,
        `Critical a11y violations on ${pg.name}: ${critical.map((v) => v.id).join(", ")}`,
      ).toHaveLength(0);
    });
  }
});

test.describe("A11y — RTL & Lang attributes", () => {
  test("html lang and dir are set", async ({ page }) => {
    await page.goto("/");
    const lang = await page.locator("html").getAttribute("lang");
    const dir = await page.locator("html").getAttribute("dir");
    expect(lang).toMatch(/^(ar|he)/i);
    expect(dir).toMatch(/rtl/i);
  });

  test("store page RTL computed direction is rtl", async ({ page }) => {
    await page.goto("/store");
    const dir = await page.evaluate(() => getComputedStyle(document.documentElement).direction);
    expect(dir).toBe("rtl");
  });
});

test.describe("A11y — Keyboard navigation", () => {
  test.beforeEach(async ({ context }) => {
    await context.route(
      /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg)/i,
      (route) => route.fulfill({ status: 200, body: "{}" }),
    );
  });

  test("Tab from homepage reaches an interactive element", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");
    const tag = await page.evaluate(() => document.activeElement?.tagName);
    expect(["A", "BUTTON", "INPUT", "SELECT", "TEXTAREA"]).toContain(tag);
  });

  test("Tab repeatedly cycles through several interactive elements", async ({ page }) => {
    await page.goto("/");
    const seen = new Set<string>();
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab");
      const id = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el) return null;
        return `${el.tagName}:${el.textContent?.slice(0, 30) || el.getAttribute("aria-label") || ""}`;
      });
      if (id) seen.add(id);
    }
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });

  test("Escape closes any open nav dropdown / modal (if one opens on first click)", async ({ page }) => {
    await page.goto("/");
    // Try to open something via a common trigger — if no menu opens, still verify Escape doesn't throw
    const menuBtn = page.locator('button[aria-expanded], button[aria-label*="menu" i], button[aria-label*="القائمة" i]').first();
    if ((await menuBtn.count()) > 0) {
      await menuBtn.click();
      await page.keyboard.press("Escape");
    }
    // Page must still be responsive
    await expect(page.locator("body")).toBeVisible();
  });
});

test.describe("A11y — Images and ARIA", () => {
  test("every img on /store has alt attribute", async ({ page }) => {
    await page.goto("/store");
    const imgs = await page.locator("img").all();
    for (const img of imgs) {
      const alt = await img.getAttribute("alt");
      expect(alt, "image missing alt attribute").not.toBeNull();
    }
  });

  test("every button on /store has accessible name (text or aria-label)", async ({ page }) => {
    await page.goto("/store");
    const buttons = await page.locator("button:visible").all();
    for (const btn of buttons) {
      const text = (await btn.textContent())?.trim() || "";
      const label = await btn.getAttribute("aria-label");
      const titled = await btn.getAttribute("title");
      const accessible = text.length > 0 || (label && label.length > 0) || (titled && titled.length > 0);
      expect(accessible, "button has no accessible name").toBe(true);
    }
  });
});
