/**
 * tests/config/fonts.test.ts
 * Validates that app/fonts.ts exports font configurations and fontVariables string.
 */

import { describe, it, expect, vi } from "vitest";

// Mock next/font/google — the real module requires Next.js build context
vi.mock("next/font/google", () => {
  function createMockFont(opts: { variable?: string; subsets?: string[] }) {
    return {
      className: "mock-font-class",
      style: { fontFamily: "mock-family" },
      variable: opts.variable ?? "--font-mock",
    };
  }
  return {
    Heebo: (opts: Record<string, unknown>) => createMockFont(opts as { variable?: string }),
    Tajawal: (opts: Record<string, unknown>) => createMockFont(opts as { variable?: string }),
    David_Libre: (opts: Record<string, unknown>) => createMockFont(opts as { variable?: string }),
  };
});

import { fontHeebo, fontTajawal, fontDavidLibre, fontVariables } from "@/app/fonts";

describe("fonts.ts", () => {
  // =========================================================================
  // Font exports
  // =========================================================================
  describe("font exports", () => {
    it("exports fontHeebo", () => {
      expect(fontHeebo).toBeDefined();
    });

    it("exports fontTajawal", () => {
      expect(fontTajawal).toBeDefined();
    });

    it("exports fontDavidLibre", () => {
      expect(fontDavidLibre).toBeDefined();
    });

    it("exports fontVariables string", () => {
      expect(fontVariables).toBeDefined();
      expect(typeof fontVariables).toBe("string");
    });
  });

  // =========================================================================
  // Font objects have variable property
  // =========================================================================
  describe("font CSS variables", () => {
    it("fontHeebo has a CSS variable", () => {
      expect(fontHeebo.variable).toBeDefined();
      expect(typeof fontHeebo.variable).toBe("string");
    });

    it("fontTajawal has a CSS variable", () => {
      expect(fontTajawal.variable).toBeDefined();
      expect(typeof fontTajawal.variable).toBe("string");
    });

    it("fontDavidLibre has a CSS variable", () => {
      expect(fontDavidLibre.variable).toBeDefined();
      expect(typeof fontDavidLibre.variable).toBe("string");
    });
  });

  // =========================================================================
  // fontVariables string
  // =========================================================================
  describe("fontVariables composition", () => {
    it("fontVariables contains all three font variables", () => {
      expect(fontVariables).toContain(fontHeebo.variable);
      expect(fontVariables).toContain(fontTajawal.variable);
      expect(fontVariables).toContain(fontDavidLibre.variable);
    });

    it("fontVariables is space-separated", () => {
      const parts = fontVariables.split(" ").filter(Boolean);
      expect(parts.length).toBe(3);
    });
  });

  // =========================================================================
  // Source file structure (read raw to verify config shape)
  // =========================================================================
  describe("source file structure", () => {
    it("source file imports from next/font/google", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/fonts.ts"),
        "utf-8",
      );
      expect(source).toContain('from "next/font/google"');
    });

    it("source file configures Heebo font", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/fonts.ts"),
        "utf-8",
      );
      expect(source).toContain("Heebo");
      expect(source).toContain("--font-heebo");
    });

    it("source file configures Tajawal for Arabic", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/fonts.ts"),
        "utf-8",
      );
      expect(source).toContain("Tajawal");
      expect(source).toContain("arabic");
      expect(source).toContain("--font-tajawal");
    });

    it("source file configures David Libre for Hebrew", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/fonts.ts"),
        "utf-8",
      );
      expect(source).toContain("David_Libre");
      expect(source).toContain("hebrew");
      expect(source).toContain("--font-david-libre");
    });

    it("all fonts use display swap", async () => {
      const fs = await import("fs");
      const path = await import("path");
      const source = fs.readFileSync(
        path.resolve(__dirname, "../../app/fonts.ts"),
        "utf-8",
      );
      // Count occurrences of display: "swap"
      const swapCount = (source.match(/display:\s*"swap"/g) || []).length;
      expect(swapCount).toBe(3);
    });
  });
});
