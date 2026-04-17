/**
 * tests/types/homepage-types.test.ts
 * Validates that app/admin/homepage/types.ts exports the expected types and constants.
 */

import { describe, it, expect } from "vitest";
import { SECTIONS } from "@/app/admin/homepage/types";
import type { EditorProps } from "@/app/admin/homepage/types";

describe("homepage types", () => {
  describe("SECTIONS constant", () => {
    it("is exported and is an array", () => {
      expect(SECTIONS).toBeInstanceOf(Array);
    });

    it("has at least 5 sections", () => {
      expect(SECTIONS.length).toBeGreaterThanOrEqual(5);
    });

    it("each section has key, icon, label, and desc", () => {
      for (const section of SECTIONS) {
        expect(section).toHaveProperty("key");
        expect(section).toHaveProperty("icon");
        expect(section).toHaveProperty("label");
        expect(section).toHaveProperty("desc");
        expect(typeof section.key).toBe("string");
        expect(typeof section.icon).toBe("string");
        expect(typeof section.label).toBe("string");
        expect(typeof section.desc).toBe("string");
      }
    });

    it("includes hero section", () => {
      const hero = SECTIONS.find((s) => s.key === "hero");
      expect(hero).toBeDefined();
    });

    it("includes header section", () => {
      const header = SECTIONS.find((s) => s.key === "header");
      expect(header).toBeDefined();
    });

    it("includes footer section", () => {
      const footer = SECTIONS.find((s) => s.key === "footer");
      expect(footer).toBeDefined();
    });

    it("includes banners section", () => {
      const banners = SECTIONS.find((s) => s.key === "banners");
      expect(banners).toBeDefined();
    });

    it("includes faq section", () => {
      const faq = SECTIONS.find((s) => s.key === "faq");
      expect(faq).toBeDefined();
    });

    it("includes subpages section", () => {
      const subpages = SECTIONS.find((s) => s.key === "subpages");
      expect(subpages).toBeDefined();
    });

    it("has unique keys", () => {
      const keys = SECTIONS.map((s) => s.key);
      const uniqueKeys = new Set(keys);
      expect(uniqueKeys.size).toBe(keys.length);
    });
  });

  describe("EditorProps type", () => {
    it("exists as a type (compile-time check)", () => {
      // If this compiles, the type exists
      const props: Partial<EditorProps> = {
        saving: false,
      };
      expect(props.saving).toBe(false);
    });
  });
});
