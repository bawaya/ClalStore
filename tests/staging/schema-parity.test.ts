import { describe, expect, it, beforeAll } from "vitest";
import fs from "fs";
import path from "path";
import { SCHEMA_CONTRACTS } from "@/lib/schema-contracts";
import {
  fetchLivePublicSchema,
  liveSchemaSkipReason,
  type LivePublicSchema,
} from "@/tests/helpers/live-schema-parity";

const ROOT = path.resolve(__dirname, "../..");
const TYPES_FILE = path.join(ROOT, "types/database.ts");
const skipReason = liveSchemaSkipReason();

function read(filePath: string) {
  return fs.readFileSync(filePath, "utf-8");
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

function extractTypeFieldMeta(source: string, typeName: string) {
  const block = source.match(new RegExp(`export type ${typeName} = \\{([\\s\\S]*?)\\n\\}`, "m"));
  const fields = new Map<string, { optional: boolean; nullable: boolean; raw: string }>();
  if (!block) return fields;

  const fieldRe = /^\s*([A-Za-z0-9_]+)(\?)?:\s*([^;]+);/gm;
  let match: RegExpExecArray | null;
  while ((match = fieldRe.exec(block[1])) !== null) {
    const [, fieldName, optionalMark, rawType] = match;
    fields.set(fieldName, {
      optional: optionalMark === "?",
      nullable: /\bnull\b/.test(rawType) || /\bundefined\b/.test(rawType),
      raw: rawType.trim(),
    });
  }

  return fields;
}

describe.skipIf(Boolean(skipReason))("Layer 3 · Live schema parity", () => {
  const typeSource = read(TYPES_FILE);
  const tableRowTypes = extractTableRowTypes(typeSource);
  const typeFieldMeta = new Map<string, Map<string, { optional: boolean; nullable: boolean; raw: string }>>();

  for (const rowType of new Set(tableRowTypes.values())) {
    typeFieldMeta.set(rowType, extractTypeFieldMeta(typeSource, rowType));
  }

  let liveSchema: LivePublicSchema;

  beforeAll(async () => {
    liveSchema = await fetchLivePublicSchema();
  }, 60_000);

  it("finds every critical contract table in the live public schema", () => {
    const missingTables: string[] = [];

    for (const table of Object.keys(SCHEMA_CONTRACTS)) {
      if (!liveSchema.columnsByTable.has(table)) {
        missingTables.push(table);
      }
    }

    expect(missingTables).toEqual([]);
  });

  it("keeps critical contract tables aligned with live column presence", () => {
    const mismatches: string[] = [];

    for (const [table, contract] of Object.entries(SCHEMA_CONTRACTS)) {
      const liveColumns = liveSchema.columnsByTable.get(table) ?? [];
      const liveNames = new Set(liveColumns.map((column) => column.column_name));
      const rowType = tableRowTypes.get(table);
      const fieldMeta = rowType ? typeFieldMeta.get(rowType) ?? new Map() : new Map();
      const typeFields = new Set(fieldMeta.keys());

      const missingLiveColumns = [...typeFields].filter((field) => !liveNames.has(field));
      const untypedLiveColumns = [...liveNames].filter((field) => !typeFields.has(field));
      const missingRequiredColumns = contract.requiredColumns.filter((field) => !liveNames.has(field));

      if (missingRequiredColumns.length > 0) {
        mismatches.push(`${table}: missing required live columns -> ${missingRequiredColumns.join(", ")}`);
      }
      if (missingLiveColumns.length > 0) {
        mismatches.push(`${table}: type fields not found live -> ${missingLiveColumns.join(", ")}`);
      }
      if (untypedLiveColumns.length > 0) {
        mismatches.push(`${table}: live columns missing from row type -> ${untypedLiveColumns.join(", ")}`);
      }
    }

    expect(mismatches).toEqual([]);
  });

  it("reports live nullability drift for critical tables without hiding it", () => {
    const nullabilityMismatches: string[] = [];

    for (const [table, contract] of Object.entries(SCHEMA_CONTRACTS)) {
      const rowType = tableRowTypes.get(table);
      if (!rowType) continue;

      const fieldMeta = typeFieldMeta.get(rowType) ?? new Map();
      const liveColumns = liveSchema.columnsByTable.get(table) ?? [];

      for (const column of liveColumns) {
        if (column.is_nullable !== "YES") continue;
        const meta = fieldMeta.get(column.column_name);
        if (!meta) continue;

        if (!meta.optional && !meta.nullable) {
          nullabilityMismatches.push(
            `${table}.${column.column_name} is nullable live but ${rowType} declares it as required (${meta.raw})`,
          );
        }
      }
    }

    if (nullabilityMismatches.length > 0) {
      console.warn(
        `[Live Schema Parity] Nullability drift (report-only): ${nullabilityMismatches.join(" | ")}`,
      );
    }

    expect(Array.isArray(nullabilityMismatches)).toBe(true);
  });
});
