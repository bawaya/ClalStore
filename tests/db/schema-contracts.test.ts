import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { globSync } from "glob";
import * as factories from "@/tests/helpers/factories";
import { SCHEMA_CONTRACTS } from "@/lib/schema-contracts";

const ROOT = path.resolve(__dirname, "../..");
const TYPES_FILE = path.join(ROOT, "types/database.ts");
const DATABASE_DOC_FILE = path.join(ROOT, "docs/DATABASE.md");
const MIGRATIONS_DIR = path.join(ROOT, "supabase/migrations");

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
}

function stripComments(source: string) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

function extractTableRowTypes(source: string) {
  const map = new Map<string, string>();
  const re = /^\s+([a-z0-9_]+):\s*\{\s*\r?\n\s+Row:\s*([A-Za-z0-9_]+)/gm;
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    map.set(match[1], match[2]);
  }
  return map;
}

function extractTypeFields(source: string, typeName: string) {
  const block = source.match(new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\}`, "m"));
  if (!block) return new Set<string>();
  const fields = new Set<string>();
  const fieldRe = /^\s*([A-Za-z0-9_]+)\??:\s/gm;
  let match: RegExpExecArray | null;
  while ((match = fieldRe.exec(block[1])) !== null) {
    fields.add(match[1]);
  }
  return fields;
}

function loadMigrationCorpus() {
  return globSync("*.sql", { cwd: MIGRATIONS_DIR })
    .sort()
    .map((file) => read(path.join(MIGRATIONS_DIR, file)))
    .join("\n\n");
}

function loadSourceFiles() {
  const files = [
    ...globSync("app/**/*.{ts,tsx}", { cwd: ROOT, absolute: true }),
    ...globSync("lib/**/*.{ts,tsx}", { cwd: ROOT, absolute: true }),
  ];

  return files.filter((file) => !file.includes(`${path.sep}.next${path.sep}`));
}

function extractBareColumns(selectClause: string) {
  const tokens: string[] = [];
  let current = "";
  let depth = 0;

  for (const char of selectClause) {
    if (char === "(") depth += 1;
    if (char === ")") depth = Math.max(0, depth - 1);

    if (char === "," && depth === 0) {
      if (current.trim()) tokens.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  if (current.trim()) tokens.push(current.trim());

  return tokens.filter((token) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(token));
}

describe("schema contracts", () => {
  const typeSource = read(TYPES_FILE);
  const docsSource = read(DATABASE_DOC_FILE);
  const migrationCorpus = loadMigrationCorpus();
  const tableRowTypes = extractTableRowTypes(typeSource);
  const typeFieldsByRowType = new Map<string, Set<string>>();

  for (const rowType of new Set(tableRowTypes.values())) {
    typeFieldsByRowType.set(rowType, extractTypeFields(typeSource, rowType));
  }

  it("keeps critical tables aligned across types, factories, migrations, and docs", () => {
    const mismatches: string[] = [];

    for (const [table, contract] of Object.entries(SCHEMA_CONTRACTS)) {
      const mappedRowType = tableRowTypes.get(table);
      if (mappedRowType !== contract.rowType) {
        mismatches.push(`Table "${table}" maps to "${mappedRowType ?? "missing"}" instead of "${contract.rowType}".`);
      }

      const typeFields = typeFieldsByRowType.get(contract.rowType) ?? new Set<string>();
      const missingTypeFields = contract.requiredColumns.filter((column) => !typeFields.has(column));
      if (missingTypeFields.length > 0) {
        mismatches.push(`Type "${contract.rowType}" is missing columns: ${missingTypeFields.join(", ")}.`);
      }

      const factory = (factories as Record<string, () => Record<string, unknown>>)[contract.factory];
      if (!factory) {
        mismatches.push(`Factory "${contract.factory}" is missing for table "${table}".`);
      } else {
        const sample = factory();
        const missingFactoryFields = contract.requiredColumns.filter((column) => !(column in sample));
        if (missingFactoryFields.length > 0) {
          mismatches.push(`Factory "${contract.factory}" is missing fields: ${missingFactoryFields.join(", ")}.`);
        }
      }

      for (const snippet of contract.migrationSnippets) {
        if (!migrationCorpus.includes(snippet)) {
          mismatches.push(`Migration evidence missing for table "${table}": ${snippet}`);
        }
      }

      for (const snippet of contract.documentationSnippets) {
        if (!docsSource.includes(snippet)) {
          mismatches.push(`Documentation evidence missing for table "${table}": ${snippet}`);
        }
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("app/lib source files only query declared public tables", () => {
    const tableNames = new Set(tableRowTypes.keys());
    const unknownTables = new Set<string>();
    const fromRe = /\.from\((["'`])([A-Za-z0-9_]+)\1\)/g;

    for (const file of loadSourceFiles()) {
      const source = stripComments(read(file));
      let match: RegExpExecArray | null;
      while ((match = fromRe.exec(source)) !== null) {
        const table = match[2];
        if (!tableNames.has(table)) {
          unknownTables.add(`${path.relative(ROOT, file)} -> ${table}`);
        }
      }
    }

    expect(Array.from(unknownTables).sort()).toEqual([]);
  });

  it("simple select clauses only reference declared columns", () => {
    const problems = new Set<string>();
    const queryRe = /\.from\((["'`])([A-Za-z0-9_]+)\1\)\s*\.select\((["'`])([\s\S]*?)\3\)/g;

    for (const file of loadSourceFiles()) {
      const source = stripComments(read(file));
      let match: RegExpExecArray | null;
      while ((match = queryRe.exec(source)) !== null) {
        const table = match[2];
        const rowType = tableRowTypes.get(table);
        if (!rowType) continue;

        const declaredFields = typeFieldsByRowType.get(rowType) ?? new Set<string>();
        const bareColumns = extractBareColumns(match[4]);
        const missingColumns = bareColumns.filter((column) => !declaredFields.has(column));
        if (missingColumns.length > 0) {
          problems.add(
            `${path.relative(ROOT, file)} -> ${table}: ${missingColumns.join(", ")}`,
          );
        }
      }
    }

    expect(Array.from(problems).sort()).toEqual([]);
  });
});
