import { test, expect } from "@playwright/test";

/**
 * Visual regression — pixel-diff snapshots for key pages.
 *
 * Tagged `@visual` so the default Playwright run does NOT execute these.
 * They run only in the dedicated `visual-regression.yml` workflow, which:
 *   - generates baselines on `workflow_dispatch` with input `mode=update`
 *   - compares against baselines on every PR
 *
 * Baselines MUST be regenerated in CI (Linux chromium) — local baselines
 * from macOS/Windows will always differ in anti-aliasing and fail CI.
 *
 * To regenerate baselines locally for debugging:
 *   npx playwright test visual-regression --update-snapshots
 *
 * Coverage: 20 pages × 3 viewports × 2 languages ≈ 120 snapshots.
 */

// ─── viewport presets (chromium-only — no defaultBrowserType in describe) ───
const VIEWPORTS = [
  { name: "desktop", viewport: { width: 1440, height: 900 } },
  { name: "tablet", viewport: { width: 768, height: 1024 }, hasTouch: true, isMobile: true },
  { name: "mobile", viewport: { width: 412, height: 732 }, hasTouch: true, isMobile: true, deviceScaleFactor: 2 },
];

const LANGS = ["ar", "he"] as const;

// ─── pages to snapshot ───────────────────────────────────────────
const PAGES: { path: string; name: string; waitFor?: string }[] = [
  { path: "/", name: "home" },
  { path: "/about", name: "about" },
  { path: "/contact", name: "contact" },
  { path: "/faq", name: "faq" },
  { path: "/deals", name: "deals" },
  { path: "/legal", name: "legal" },
  { path: "/privacy", name: "privacy" },
  { path: "/store", name: "store" },
  { path: "/store/cart", name: "cart" },
  { path: "/store/compare", name: "compare" },
  { path: "/store/wishlist", name: "wishlist" },
  { path: "/store/track", name: "track" },
  { path: "/store/auth", name: "store-auth" },
  { path: "/store/account", name: "store-account" },
  { path: "/store/checkout/success", name: "checkout-success" },
  { path: "/store/checkout/failed", name: "checkout-failed" },
  { path: "/login", name: "login" },
  { path: "/change-password", name: "change-password" },
  { path: "/sales-pwa", name: "sales-pwa" },
  { path: "/m/inbox", name: "mobile-inbox" },
];

async function setLang(page: any, lang: string) {
  // Persist language choice before hitting the page so the lang provider
  // reads it on first render.
  await page.addInitScript((l: string) => {
    try { localStorage.setItem("clal_lang", l); } catch {}
  }, lang);
}

async function blockExternal(context: any) {
  await context.route(
    /(anthropic|googleapis|ycloud|icredit|upay|twilio|sendgrid|resend|pexels|remove\.bg|facebook|google-analytics|googletagmanager|gstatic|fonts\.googleapis)/i,
    (route: any) => route.fulfill({ status: 200, body: "" }),
  );
}

for (const viewport of VIEWPORTS) {
  test.describe(`@visual ${viewport.name}`, () => {
    test.use({ ...(viewport as any) });

    for (const lang of LANGS) {
      for (const pg of PAGES) {
        test(`${pg.name} [${lang}]`, async ({ page, context }) => {
          await blockExternal(context);
          await setLang(page, lang);

          await page.goto(pg.path, { waitUntil: "networkidle" });
          // Small settle to let fonts / images decode
          await page.waitForTimeout(500);
          // Mask obviously dynamic bits — timestamps, live counts, dates
          await expect(page).toHaveScreenshot(`${pg.name}-${lang}-${viewport.name}.png`, {
            fullPage: true,
            maxDiffPixelRatio: 0.01, // allow up to 1% drift (anti-aliasing, font hints)
            animations: "disabled",
            caret: "hide",
          });
        });
      }
    }
  });
}
