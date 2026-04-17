/**
 * tests/config/vitest-config.test.ts
 * Validates vitest.config.ts settings: environment, setup files, path aliases.
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

// We read the raw config file and parse key settings,
// since vitest.config.ts is the active config we're running under.
const configPath = path.resolve(__dirname, "../../vitest.config.ts");
const configSource = fs.readFileSync(configPath, "utf-8");

describe("vitest.config.ts", () => {
  it("file exists", () => {
    expect(fs.existsSync(configPath)).toBe(true);
  });

  // =========================================================================
  // Environment
  // =========================================================================
  describe("environment", () => {
    it("uses jsdom environment", () => {
      expect(configSource).toContain("environment: 'jsdom'");
    });
  });

  // =========================================================================
  // Setup files
  // =========================================================================
  describe("setup files", () => {
    it("references tests/setup.ts as a setup file", () => {
      expect(configSource).toContain("./tests/setup.ts");
    });

    it("setup file exists on disk", () => {
      const setupPath = path.resolve(__dirname, "../setup.ts");
      expect(fs.existsSync(setupPath)).toBe(true);
    });
  });

  // =========================================================================
  // Test includes
  // =========================================================================
  describe("test includes", () => {
    it("includes tests/**/*.test.{ts,tsx}", () => {
      expect(configSource).toContain("tests/**/*.test.{ts,tsx}");
    });
  });

  // =========================================================================
  // Path aliases
  // =========================================================================
  describe("path aliases", () => {
    it("defines @ alias", () => {
      expect(configSource).toContain("'@'");
    });

    it("maps @ to project root via path.resolve", () => {
      expect(configSource).toContain("path.resolve(__dirname, '.')");
    });
  });

  // =========================================================================
  // Globals
  // =========================================================================
  describe("globals", () => {
    it("enables globals mode", () => {
      expect(configSource).toContain("globals: true");
    });
  });

  // =========================================================================
  // Plugins
  // =========================================================================
  describe("plugins", () => {
    it("uses @vitejs/plugin-react", () => {
      expect(configSource).toContain("@vitejs/plugin-react");
    });
  });

  // =========================================================================
  // Coverage
  // =========================================================================
  describe("coverage", () => {
    it("configures coverage reporters", () => {
      expect(configSource).toContain("reporter:");
      expect(configSource).toContain("'text'");
      expect(configSource).toContain("'json'");
      expect(configSource).toContain("'html'");
    });
  });
});
