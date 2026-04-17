/**
 * tests/i18n/translations.test.ts
 * Validates that ar.json and he.json locale files are structurally consistent,
 * fully populated, and free of missing or empty translations.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const LOCALES_DIR = path.resolve(__dirname, "../../locales");

function loadLocale(lang: string): Record<string, unknown> {
  const raw = fs.readFileSync(path.join(LOCALES_DIR, `${lang}.json`), "utf-8");
  return JSON.parse(raw);
}

/**
 * Recursively collect all leaf-key paths from a nested object.
 * Example: { a: { b: "x", c: "y" } } => ["a.b", "a.c"]
 */
function collectKeys(obj: Record<string, unknown>, prefix = ""): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v as Record<string, unknown>, fullKey));
    } else {
      keys.push(fullKey);
    }
  }
  return keys.sort();
}

/**
 * Recursively check for empty string values.
 * Returns array of dot-paths that are empty strings.
 */
function findEmptyValues(obj: Record<string, unknown>, prefix = ""): string[] {
  const empties: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      empties.push(...findEmptyValues(v as Record<string, unknown>, fullKey));
    } else if (typeof v === "string" && v.trim() === "") {
      empties.push(fullKey);
    }
  }
  return empties;
}

describe("i18n translations", () => {
  // =========================================================================
  // JSON parsing
  // =========================================================================
  describe("JSON validity", () => {
    it("ar.json parses as valid JSON", () => {
      expect(() => loadLocale("ar")).not.toThrow();
    });

    it("he.json parses as valid JSON", () => {
      expect(() => loadLocale("he")).not.toThrow();
    });

    it("ar.json is a non-empty object", () => {
      const ar = loadLocale("ar");
      expect(typeof ar).toBe("object");
      expect(Object.keys(ar).length).toBeGreaterThan(0);
    });

    it("he.json is a non-empty object", () => {
      const he = loadLocale("he");
      expect(typeof he).toBe("object");
      expect(Object.keys(he).length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Top-level key parity
  // =========================================================================
  describe("top-level key parity", () => {
    it("ar and he have the same top-level keys", () => {
      const ar = loadLocale("ar");
      const he = loadLocale("he");
      const arKeys = Object.keys(ar).sort();
      const heKeys = Object.keys(he).sort();
      expect(arKeys).toEqual(heKeys);
    });
  });

  // =========================================================================
  // Deep / nested key parity
  // =========================================================================
  describe("nested key parity", () => {
    it("all leaf keys in ar exist in he", () => {
      const ar = loadLocale("ar");
      const he = loadLocale("he");
      const arKeys = collectKeys(ar);
      const heKeys = new Set(collectKeys(he));

      const missingInHe = arKeys.filter((k) => !heKeys.has(k));
      expect(missingInHe).toEqual([]);
    });

    it("all leaf keys in he exist in ar", () => {
      const ar = loadLocale("ar");
      const he = loadLocale("he");
      const heKeys = collectKeys(he);
      const arKeys = new Set(collectKeys(ar));

      const missingInAr = heKeys.filter((k) => !arKeys.has(k));
      expect(missingInAr).toEqual([]);
    });

    it("ar and he have identical leaf key sets", () => {
      const ar = loadLocale("ar");
      const he = loadLocale("he");
      expect(collectKeys(ar)).toEqual(collectKeys(he));
    });
  });

  // =========================================================================
  // No empty values
  // =========================================================================
  describe("no empty string values", () => {
    it("ar.json has no empty string values", () => {
      const ar = loadLocale("ar");
      const empties = findEmptyValues(ar);
      expect(empties).toEqual([]);
    });

    it("he.json has no empty string values", () => {
      const he = loadLocale("he");
      const empties = findEmptyValues(he);
      expect(empties).toEqual([]);
    });
  });

  // =========================================================================
  // Known sections exist
  // =========================================================================
  describe("expected sections", () => {
    const expectedSections = [
      "nav", "hero", "stats", "store", "footer", "contact",
      "about", "chat", "cookie", "features", "faq", "plans",
      "cta", "products", "detail", "errors", "common", "pwa",
      "compare", "wishlist", "auth", "store2", "cartBar", "account",
    ];

    it.each(expectedSections)("ar.json contains section '%s'", (section) => {
      const ar = loadLocale("ar");
      expect(ar).toHaveProperty(section);
      expect(typeof ar[section]).toBe("object");
    });

    it.each(expectedSections)("he.json contains section '%s'", (section) => {
      const he = loadLocale("he");
      expect(he).toHaveProperty(section);
      expect(typeof he[section]).toBe("object");
    });
  });

  // =========================================================================
  // Type safety — all values are strings (no numbers, booleans, nulls at leaves)
  // =========================================================================
  describe("leaf value types", () => {
    it("all leaf values in ar.json are strings", () => {
      const ar = loadLocale("ar");
      const keys = collectKeys(ar);
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = ar;
        for (const p of parts) val = (val as Record<string, unknown>)[p];
        expect(typeof val).toBe("string");
      }
    });

    it("all leaf values in he.json are strings", () => {
      const he = loadLocale("he");
      const keys = collectKeys(he);
      for (const key of keys) {
        const parts = key.split(".");
        let val: unknown = he;
        for (const p of parts) val = (val as Record<string, unknown>)[p];
        expect(typeof val).toBe("string");
      }
    });
  });
});
