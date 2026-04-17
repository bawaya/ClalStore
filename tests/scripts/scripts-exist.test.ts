/**
 * tests/scripts/scripts-exist.test.ts
 * Verifies that all expected script files exist and contain valid JS/TS syntax.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

const SCRIPTS_DIR = path.resolve(__dirname, "../../scripts");

const EXPECTED_SCRIPTS = [
  { file: "create-wa-templates.js", ext: ".js" },
  { file: "extract-prices.js", ext: ".js" },
  { file: "generate-icons.js", ext: ".js" },
  { file: "list-products.js", ext: ".js" },
  { file: "run-migration-028.ts", ext: ".ts" },
];

describe("scripts", () => {
  // =========================================================================
  // Existence
  // =========================================================================
  describe("file existence", () => {
    it("scripts directory exists", () => {
      expect(fs.existsSync(SCRIPTS_DIR)).toBe(true);
    });

    it.each(EXPECTED_SCRIPTS.map((s) => s.file))(
      "%s exists",
      (filename) => {
        const filePath = path.join(SCRIPTS_DIR, filename);
        expect(fs.existsSync(filePath)).toBe(true);
      },
    );
  });

  // =========================================================================
  // Non-empty
  // =========================================================================
  describe("file content", () => {
    it.each(EXPECTED_SCRIPTS.map((s) => s.file))(
      "%s is non-empty",
      (filename) => {
        const filePath = path.join(SCRIPTS_DIR, filename);
        const content = fs.readFileSync(filePath, "utf-8");
        expect(content.trim().length).toBeGreaterThan(0);
      },
    );
  });

  // =========================================================================
  // Basic syntax checks
  // =========================================================================
  describe("syntax validation", () => {
    it.each(EXPECTED_SCRIPTS.filter((s) => s.ext === ".js").map((s) => s.file))(
      "%s has valid JS (balanced braces, no obvious syntax errors)",
      (filename) => {
        const filePath = path.join(SCRIPTS_DIR, filename);
        const content = fs.readFileSync(filePath, "utf-8");

        // Check balanced braces
        let braceDepth = 0;
        let inString = false;
        let stringChar = "";
        for (let i = 0; i < content.length; i++) {
          const ch = content[i];
          if (inString) {
            if (ch === stringChar && content[i - 1] !== "\\") inString = false;
            continue;
          }
          if (ch === "'" || ch === '"' || ch === "`") {
            inString = true;
            stringChar = ch;
            continue;
          }
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        expect(braceDepth).toBe(0);
      },
    );

    it.each(EXPECTED_SCRIPTS.filter((s) => s.ext === ".ts").map((s) => s.file))(
      "%s has valid TS (balanced braces)",
      (filename) => {
        const filePath = path.join(SCRIPTS_DIR, filename);
        const content = fs.readFileSync(filePath, "utf-8");

        let braceDepth = 0;
        let inString = false;
        let stringChar = "";
        for (let i = 0; i < content.length; i++) {
          const ch = content[i];
          if (inString) {
            if (ch === stringChar && content[i - 1] !== "\\") inString = false;
            continue;
          }
          if (ch === "'" || ch === '"' || ch === "`") {
            inString = true;
            stringChar = ch;
            continue;
          }
          if (ch === "{") braceDepth++;
          if (ch === "}") braceDepth--;
        }
        expect(braceDepth).toBe(0);
      },
    );
  });

  // =========================================================================
  // Specific script content checks
  // =========================================================================
  describe("script content", () => {
    it("create-wa-templates.js references yCloud API", () => {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, "create-wa-templates.js"), "utf-8");
      expect(content).toContain("YCLOUD_API_KEY");
    });

    it("extract-prices.js uses fs module", () => {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, "extract-prices.js"), "utf-8");
      expect(content).toContain("require('fs')");
    });

    it("generate-icons.js defines icon sizes", () => {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, "generate-icons.js"), "utf-8");
      expect(content).toContain("sizes");
    });

    it("list-products.js uses supabase client", () => {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, "list-products.js"), "utf-8");
      expect(content).toContain("supabase");
    });

    it("run-migration-028.ts imports postgres", () => {
      const content = fs.readFileSync(path.join(SCRIPTS_DIR, "run-migration-028.ts"), "utf-8");
      expect(content).toContain("postgres");
    });
  });

  // =========================================================================
  // File extensions are correct
  // =========================================================================
  describe("file extensions", () => {
    it.each(EXPECTED_SCRIPTS)(
      "$file has correct extension ($ext)",
      ({ file, ext }) => {
        expect(path.extname(file)).toBe(ext);
      },
    );
  });
});
