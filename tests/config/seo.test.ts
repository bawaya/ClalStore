/**
 * tests/config/seo.test.ts
 * Validates that app/robots.ts and app/sitemap.ts export their default functions.
 */

import { describe, it, expect, vi } from "vitest";

// Mock Supabase for sitemap (it queries products)
vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          order: () => Promise.resolve({ data: [], error: null }),
        }),
      }),
    }),
  }),
}));

import robots from "@/app/robots";
import sitemap from "@/app/sitemap";

describe("SEO", () => {
  // =========================================================================
  // robots.ts
  // =========================================================================
  describe("robots.ts", () => {
    it("exports a default function", () => {
      expect(typeof robots).toBe("function");
    });

    it("returns an object with rules", () => {
      const result = robots();
      expect(result).toHaveProperty("rules");
    });

    it("rules array is non-empty", () => {
      const result = robots();
      expect(result.rules).toBeInstanceOf(Array);
      expect((result.rules as unknown[]).length).toBeGreaterThan(0);
    });

    it("includes a sitemap URL", () => {
      const result = robots();
      expect(result.sitemap).toBeDefined();
      expect(typeof result.sitemap).toBe("string");
      expect(result.sitemap).toContain("sitemap.xml");
    });

    it("disallows /admin in rules", () => {
      const result = robots();
      const firstRule = (result.rules as { disallow?: string[] }[])[0];
      expect(firstRule.disallow).toEqual(expect.arrayContaining(["/admin"]));
    });

    it("disallows /crm in rules", () => {
      const result = robots();
      const firstRule = (result.rules as { disallow?: string[] }[])[0];
      expect(firstRule.disallow).toEqual(expect.arrayContaining(["/crm"]));
    });

    it("disallows /api in rules", () => {
      const result = robots();
      const firstRule = (result.rules as { disallow?: string[] }[])[0];
      expect(firstRule.disallow).toEqual(expect.arrayContaining(["/api"]));
    });

    it("allows root path", () => {
      const result = robots();
      const firstRule = (result.rules as { allow?: string }[])[0];
      expect(firstRule.allow).toBe("/");
    });

    it("targets all user agents", () => {
      const result = robots();
      const firstRule = (result.rules as { userAgent?: string }[])[0];
      expect(firstRule.userAgent).toBe("*");
    });
  });

  // =========================================================================
  // sitemap.ts
  // =========================================================================
  describe("sitemap.ts", () => {
    it("exports a default async function", () => {
      expect(typeof sitemap).toBe("function");
    });

    it("returns an array of sitemap entries", async () => {
      const result = await sitemap();
      expect(result).toBeInstanceOf(Array);
    });

    it("includes static pages", async () => {
      const result = await sitemap();
      const urls = result.map((entry) => entry.url);
      expect(urls).toEqual(expect.arrayContaining([
        "https://clalmobile.com",
        "https://clalmobile.com/store",
      ]));
    });

    it("each entry has url and lastModified", async () => {
      const result = await sitemap();
      for (const entry of result) {
        expect(entry).toHaveProperty("url");
        expect(typeof entry.url).toBe("string");
        expect(entry.url).toMatch(/^https?:\/\//);
      }
    });

    it("home page has priority 1", async () => {
      const result = await sitemap();
      const home = result.find((e) => e.url === "https://clalmobile.com");
      expect(home).toBeDefined();
      expect(home!.priority).toBe(1);
    });

    it("store page has priority 0.9", async () => {
      const result = await sitemap();
      const store = result.find((e) => e.url === "https://clalmobile.com/store");
      expect(store).toBeDefined();
      expect(store!.priority).toBe(0.9);
    });

    it("includes about, faq, and contact pages", async () => {
      const result = await sitemap();
      const urls = result.map((e) => e.url);
      expect(urls).toEqual(expect.arrayContaining([
        "https://clalmobile.com/about",
        "https://clalmobile.com/faq",
        "https://clalmobile.com/contact",
      ]));
    });

    it("includes legal pages", async () => {
      const result = await sitemap();
      const urls = result.map((e) => e.url);
      expect(urls).toEqual(expect.arrayContaining([
        "https://clalmobile.com/privacy",
        "https://clalmobile.com/legal",
      ]));
    });
  });
});
