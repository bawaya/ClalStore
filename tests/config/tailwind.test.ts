/**
 * tests/config/tailwind.test.ts
 * Validates tailwind.config.ts has the correct design-system setup:
 * fonts, colors, content paths, and responsive breakpoints.
 */

import { describe, it, expect } from "vitest";

// We import the default export from the TS config file
import config from "@/tailwind.config";

describe("tailwind.config.ts", () => {
  // =========================================================================
  // Content paths
  // =========================================================================
  describe("content", () => {
    it("includes app directory", () => {
      expect(config.content).toEqual(
        expect.arrayContaining([expect.stringContaining("./app/**")]),
      );
    });

    it("includes components directory", () => {
      expect(config.content).toEqual(
        expect.arrayContaining([expect.stringContaining("./components/**")]),
      );
    });

    it("includes lib directory", () => {
      expect(config.content).toEqual(
        expect.arrayContaining([expect.stringContaining("./lib/**")]),
      );
    });

    it("scans .ts and .tsx files", () => {
      for (const pattern of config.content as string[]) {
        expect(pattern).toMatch(/\{ts,tsx\}/);
      }
    });
  });

  // =========================================================================
  // Custom fonts
  // =========================================================================
  describe("fonts", () => {
    const fonts = config.theme?.extend?.fontFamily as Record<string, string[]>;

    it("defines font-arabic with Tajawal", () => {
      expect(fonts.arabic).toBeDefined();
      expect(fonts.arabic.join(" ")).toContain("--font-tajawal");
    });

    it("defines font-hebrew with David Libre", () => {
      expect(fonts.hebrew).toBeDefined();
      expect(fonts.hebrew.join(" ")).toContain("--font-david-libre");
    });

    it("font-arabic includes Heebo fallback", () => {
      expect(fonts.arabic.join(" ")).toContain("--font-heebo");
    });

    it("font-hebrew includes Heebo fallback", () => {
      expect(fonts.hebrew.join(" ")).toContain("--font-heebo");
    });
  });

  // =========================================================================
  // Custom colors
  // =========================================================================
  describe("colors", () => {
    const colors = config.theme?.extend?.colors as Record<string, unknown>;

    it("defines brand color", () => {
      expect(colors.brand).toBeDefined();
    });

    it("brand.DEFAULT is the ClalMobile red", () => {
      const brand = colors.brand as Record<string, string>;
      expect(brand.DEFAULT).toBe("#c41040");
    });

    it("defines surface colors", () => {
      expect(colors.surface).toBeDefined();
      const surface = colors.surface as Record<string, string>;
      expect(surface.bg).toBeDefined();
      expect(surface.card).toBeDefined();
      expect(surface.elevated).toBeDefined();
      expect(surface.border).toBeDefined();
    });

    it("defines state colors", () => {
      expect(colors.state).toBeDefined();
      const state = colors.state as Record<string, string>;
      expect(state.success).toBeDefined();
      expect(state.warning).toBeDefined();
      expect(state.error).toBeDefined();
      expect(state.info).toBeDefined();
    });

    it("defines muted color", () => {
      expect(colors.muted).toBeDefined();
    });
  });

  // =========================================================================
  // Border radius
  // =========================================================================
  describe("border radius", () => {
    const radii = config.theme?.extend?.borderRadius as Record<string, string>;

    it("defines card border radius", () => {
      expect(radii.card).toBe("14px");
    });

    it("defines button border radius", () => {
      expect(radii.button).toBe("10px");
    });

    it("defines chip border radius", () => {
      expect(radii.chip).toBe("8px");
    });
  });

  // =========================================================================
  // Responsive breakpoints
  // =========================================================================
  describe("screens", () => {
    const screens = config.theme?.extend?.screens as Record<string, unknown>;

    it("defines mobile breakpoint", () => {
      expect(screens.mobile).toBeDefined();
    });

    it("defines tablet breakpoint", () => {
      expect(screens.tablet).toBeDefined();
    });

    it("defines desktop breakpoint", () => {
      expect(screens.desktop).toBeDefined();
    });
  });

  // =========================================================================
  // Plugins
  // =========================================================================
  describe("plugins", () => {
    it("plugins array exists", () => {
      expect(config.plugins).toBeInstanceOf(Array);
    });
  });
});
