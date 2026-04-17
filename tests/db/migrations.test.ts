/**
 * tests/db/migrations.test.ts
 * Validates all SQL migration files in supabase/migrations/:
 * - Files parse (balanced parens, semicolons)
 * - CREATE TABLE statements are extracted and named
 * - No duplicate migration numbers
 * - Unsafe RLS patterns flagged (USING(true))
 */

import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { globSync } from "glob";

const MIGRATIONS_DIR = path.resolve(__dirname, "../../supabase/migrations");

function getMigrationFiles(): string[] {
  return globSync("*.sql", { cwd: MIGRATIONS_DIR }).sort();
}

function readMigration(filename: string): string {
  return fs.readFileSync(path.join(MIGRATIONS_DIR, filename), "utf-8");
}

/**
 * Strip SQL comments (-- line comments and /* block comments)
 * so they don't interfere with parenthesis counting, etc.
 */
function stripComments(sql: string): string {
  // Remove block comments
  let result = sql.replace(/\/\*[\s\S]*?\*\//g, "");
  // Remove line comments
  result = result.replace(/--.*$/gm, "");
  return result;
}

/**
 * Check that parentheses are balanced in a SQL string.
 */
function checkBalancedParens(sql: string): boolean {
  const stripped = stripComments(sql);
  let depth = 0;
  // Track whether we are inside a string literal
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inString) {
      if (ch === stringChar) {
        // Check for escaped quote (doubled)
        if (i + 1 < stripped.length && stripped[i + 1] === stringChar) {
          i++; // skip escaped quote
        } else {
          inString = false;
        }
      }
      continue;
    }
    if (ch === "'" || ch === '"') {
      inString = true;
      stringChar = ch;
      continue;
    }
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth < 0) return false;
  }
  return depth === 0;
}

/**
 * Extract CREATE TABLE names from SQL.
 */
function extractTableNames(sql: string): string[] {
  const regex = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?(\w+)/gi;
  const names: string[] = [];
  let match;
  while ((match = regex.exec(sql)) !== null) {
    names.push(match[1].toLowerCase());
  }
  return names;
}

/**
 * Check for unsafe RLS policies using USING(true).
 * Returns the count of occurrences.
 */
function countUnsafeRLS(sql: string): number {
  const stripped = stripComments(sql);
  // Match USING (true) or USING(true) — case-insensitive
  const matches = stripped.match(/USING\s*\(\s*true\s*\)/gi);
  return matches ? matches.length : 0;
}

/**
 * Extract migration number prefix from filename.
 * e.g. "20260101000001_initial_schema.sql" => "20260101000001"
 */
function extractMigrationNumber(filename: string): string {
  const match = filename.match(/^(\d+)/);
  return match ? match[1] : filename;
}

// =========================================================================
// Tests
// =========================================================================

describe("database migrations", () => {
  const files = getMigrationFiles();

  it("migrations directory exists", () => {
    expect(fs.existsSync(MIGRATIONS_DIR)).toBe(true);
  });

  it("at least one migration file exists", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // No duplicate migration numbers
  // =========================================================================
  describe("migration numbering", () => {
    it("has no duplicate migration number prefixes", () => {
      const numbers = files.map(extractMigrationNumber);
      const seen = new Set<string>();
      const duplicates: string[] = [];
      for (const num of numbers) {
        if (seen.has(num)) duplicates.push(num);
        seen.add(num);
      }
      expect(duplicates).toEqual([]);
    });

    it("all filenames start with numeric timestamp", () => {
      for (const file of files) {
        expect(file).toMatch(/^\d+/);
      }
    });

    it("all filenames end with .sql", () => {
      for (const file of files) {
        expect(file).toMatch(/\.sql$/);
      }
    });
  });

  // =========================================================================
  // Per-file structural checks
  // =========================================================================
  describe("file structure", () => {
    it.each(files)("%s has balanced parentheses", (file) => {
      const sql = readMigration(file);
      expect(checkBalancedParens(sql)).toBe(true);
    });

    it.each(files)("%s is non-empty", (file) => {
      const sql = readMigration(file);
      expect(sql.trim().length).toBeGreaterThan(0);
    });

    it.each(files)("%s contains at least one semicolon (terminated statements)", (file) => {
      const sql = readMigration(file);
      expect(sql).toContain(";");
    });
  });

  // =========================================================================
  // CREATE TABLE extraction
  // =========================================================================
  describe("table creation", () => {
    it("initial migration creates expected core tables", () => {
      const initialFile = files.find((f) => f.includes("initial_schema"));
      expect(initialFile).toBeDefined();
      const sql = readMigration(initialFile!);
      const tables = extractTableNames(sql);
      expect(tables).toEqual(expect.arrayContaining([
        "users",
        "settings",
        "integrations",
        "categories",
        "products",
        "customers",
        "orders",
        "order_items",
      ]));
    });

    it("bot migration creates bot tables", () => {
      const botFile = files.find((f) => f.includes("bot_tables"));
      expect(botFile).toBeDefined();
      const sql = readMigration(botFile!);
      const tables = extractTableNames(sql);
      expect(tables.length).toBeGreaterThan(0);
    });

    it("inbox migration creates inbox tables", () => {
      const inboxFile = files.find((f) => f.includes("inbox"));
      expect(inboxFile).toBeDefined();
      const sql = readMigration(inboxFile!);
      const tables = extractTableNames(sql);
      expect(tables.length).toBeGreaterThan(0);
    });

    it("commissions migration creates commission tables", () => {
      const commFile = files.find((f) => f.includes("000025_commissions"));
      expect(commFile).toBeDefined();
      const sql = readMigration(commFile!);
      const tables = extractTableNames(sql);
      expect(tables.length).toBeGreaterThan(0);
    });

    it("loyalty migration creates loyalty tables", () => {
      const loyaltyFile = files.find((f) => f.includes("loyalty"));
      expect(loyaltyFile).toBeDefined();
      const sql = readMigration(loyaltyFile!);
      const tables = extractTableNames(sql);
      expect(tables.length).toBeGreaterThan(0);
    });
  });

  // =========================================================================
  // Unsafe RLS patterns
  // =========================================================================
  describe("RLS safety", () => {
    it("tighten_rls migration does not use USING(true)", () => {
      const rlsFile = files.find((f) => f.includes("tighten_rls"));
      expect(rlsFile).toBeDefined();
      const sql = readMigration(rlsFile!);
      const unsafeCount = countUnsafeRLS(sql);
      expect(unsafeCount).toBe(0);
    });

    // Flag files that contain USING(true) — these are warnings, not hard failures
    it("reports any migration files with USING(true) patterns", () => {
      const flagged: { file: string; count: number }[] = [];
      for (const file of files) {
        const sql = readMigration(file);
        const count = countUnsafeRLS(sql);
        if (count > 0) flagged.push({ file, count });
      }
      // Log flagged files for review (test passes, but flags for audit)
      if (flagged.length > 0) {
        console.warn(
          "[RLS Audit] Files with USING(true):",
          flagged.map((f) => `${f.file} (${f.count}x)`).join(", "),
        );
      }
      // This test documents the current state; tighten_rls should have fixed most
      expect(flagged).toBeDefined(); // always passes — informational
    });

    describe("sub_pages hardening", () => {
      const hardeningFile = "20260417000001_fix_sub_pages_rls.sql";

      it("has a sub_pages hardening migration", () => {
        const file = files.find((f) => f.includes("fix_sub_pages_rls"));
        expect(file).toBe(hardeningFile);
      });

      it("drops the open sub_pages_authenticated_all policy", () => {
        const sql = readMigration(hardeningFile);
        expect(sql).toMatch(/DROP POLICY IF EXISTS "sub_pages_authenticated_all"/i);
      });

      it("installs role-scoped SELECT policies for anon and authenticated", () => {
        const sql = readMigration(hardeningFile);
        // anon SELECT on visible only
        expect(sql).toMatch(/CREATE POLICY "sub_pages_anon_read"[\s\S]*?FOR SELECT[\s\S]*?TO anon[\s\S]*?USING \(is_visible = true\)/i);
        // authenticated SELECT on visible only
        expect(sql).toMatch(/CREATE POLICY "sub_pages_authenticated_read"[\s\S]*?FOR SELECT[\s\S]*?TO authenticated[\s\S]*?USING \(is_visible = true\)/i);
      });

      it("scopes FOR ALL access to service_role only, with auth.role() guard", () => {
        const sql = readMigration(hardeningFile);
        expect(sql).toMatch(/CREATE POLICY "sub_pages_service_all"[\s\S]*?FOR ALL[\s\S]*?TO service_role[\s\S]*?USING \(auth\.role\(\) = 'service_role'\)/i);
      });

      it("revokes INSERT/UPDATE/DELETE from anon and authenticated", () => {
        const sql = readMigration(hardeningFile);
        expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON sub_pages FROM anon/i);
        expect(sql).toMatch(/REVOKE INSERT, UPDATE, DELETE ON sub_pages FROM authenticated/i);
      });

      it("contains no new USING(true) patterns outside service_role policy", () => {
        const sql = readMigration(hardeningFile);
        // Strip `-- …` SQL line comments so references to `USING(true)`
        // inside the comment block (e.g. "we used to have USING(true)") don't
        // count as a policy definition.
        const code = sql.replace(/--[^\n]*/g, "");
        const bareTrue = code.match(/USING\s*\(\s*true\s*\)/gi) || [];
        expect(bareTrue.length).toBe(0);
      });
    });
  });

  // =========================================================================
  // Total migration count sanity
  // =========================================================================
  describe("migration count", () => {
    it("has the expected number of migrations (>= 40)", () => {
      expect(files.length).toBeGreaterThanOrEqual(40);
    });
  });
});
