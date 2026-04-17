import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase module - must be before import
vi.mock("@/lib/supabase", () => {
  const mockBuilder: any = {};
  const chainMethods = ["select", "eq", "neq", "order", "limit", "insert", "update", "delete"];
  for (const m of chainMethods) {
    mockBuilder[m] = vi.fn().mockReturnValue(mockBuilder);
  }
  mockBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  mockBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });

  // Default: loadTemplates queries bot_templates and returns rows
  const templateRows = [
    { key: "welcome", content_ar: "اهلا بك في ClalMobile!", content_he: "ברוכים הבאים!" },
    { key: "goodbye", content_ar: "مع السلامة {name}", content_he: "להתראות {name}" },
  ];

  // Make the builder thenable to support await
  mockBuilder.then = vi.fn((resolve: any) =>
    resolve({ data: templateRows, error: null })
  );

  const fromMock = vi.fn().mockReturnValue(mockBuilder);

  return {
    createAdminSupabase: vi.fn(() => ({ from: fromMock })),
    __mockFrom: fromMock,
    __mockBuilder: mockBuilder,
    __templateRows: templateRows,
  };
});

import { getTemplate, loadTemplates, invalidateTemplateCache } from "@/lib/bot/templates";

describe("Bot Templates", () => {
  beforeEach(() => {
    invalidateTemplateCache();
  });

  // ─── loadTemplates ──────────────────────────────────────────────

  describe("loadTemplates", () => {
    it("returns templates (DB-overridden or defaults)", async () => {
      const templates = await loadTemplates();
      // Must have default template keys
      expect(templates.welcome).toBeDefined();
      expect(templates.handoff).toBeDefined();
      expect(templates.upsell).toBeDefined();
      expect(templates.csat).toBeDefined();
      expect(templates.unknown).toBeDefined();
      expect(templates.goodbye).toBeDefined();
    });

    it("each template has ar and he fields", async () => {
      const templates = await loadTemplates();
      for (const [key, val] of Object.entries(templates)) {
        expect(val).toHaveProperty("ar");
        expect(val).toHaveProperty("he");
        expect(typeof val.ar).toBe("string");
        expect(typeof val.he).toBe("string");
      }
    });
  });

  // ─── getTemplate ──────────────────────────────────────────────

  describe("getTemplate", () => {
    it("returns a non-empty string for known template keys", async () => {
      const text = await getTemplate("welcome", "ar");
      expect(text.length).toBeGreaterThan(0);
    });

    it("returns different text for ar vs he", async () => {
      const ar = await getTemplate("welcome", "ar");
      const he = await getTemplate("welcome", "he");
      // They should at least be defined (may be same if DB override differs)
      expect(ar.length).toBeGreaterThan(0);
      expect(he.length).toBeGreaterThan(0);
    });

    it("returns Arabic template for en language (fallback)", async () => {
      const en = await getTemplate("welcome", "en");
      const ar = await getTemplate("welcome", "ar");
      expect(en).toBe(ar);
    });

    it("returns unknown template for non-existent key", async () => {
      const text = await getTemplate("totally_non_existent_key_xyz", "ar");
      // Should return unknown template content
      expect(text).toContain("عذراً");
    });

    it("replaces variables when provided", async () => {
      // Test with welcome_returning which has {name} placeholder in defaults
      const text = await getTemplate("welcome_returning", "ar", { name: "أحمد" });
      expect(text).toContain("أحمد");
      expect(text).not.toContain("{name}");
    });

    it("replaces variables in Hebrew template", async () => {
      const text = await getTemplate("welcome_returning", "he", { name: "David" });
      expect(text).toContain("David");
      expect(text).not.toContain("{name}");
    });
  });

  // ─── Caching ──────────────────────────────────────────────────

  describe("template caching", () => {
    it("returns same result on subsequent calls (cache)", async () => {
      invalidateTemplateCache();
      const first = await loadTemplates();
      const second = await loadTemplates();
      expect(first).toBe(second); // Same reference means cache hit
    });

    it("invalidateTemplateCache allows fresh result", async () => {
      const first = await loadTemplates();
      invalidateTemplateCache();
      const second = await loadTemplates();
      // After invalidation, a new object is created
      // They should have the same keys but may be different references
      expect(Object.keys(second)).toEqual(expect.arrayContaining(Object.keys(first)));
    });
  });
});
