import { beforeAll, describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA_CONTRACTS } from "@/lib/schema-contracts";
import { runSql } from "@/lib/supabase-management";
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

function quoteIdentifier(identifier: string) {
  return `"${identifier.replace(/"/g, "\"\"")}"`;
}

async function countNullRows(table: string, column: string) {
  const query = `
    SELECT
      COUNT(*)::int AS total_rows,
      COUNT(*) FILTER (WHERE ${quoteIdentifier(column)} IS NULL)::int AS null_rows
    FROM ${quoteIdentifier(table)};
  `;
  const { data, error } = await runSql(query);
  if (error) {
    throw new Error(`Failed counting ${table}.${column}: ${error}`);
  }

  const rows = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "result" in data && Array.isArray((data as { result?: unknown[] }).result)
      ? ((data as { result: unknown[] }).result as Array<Record<string, unknown>>)
      : [];

  const row = rows[0] ?? {};
  return {
    totalRows: Number(row.total_rows ?? 0),
    nullRows: Number(row.null_rows ?? 0),
  };
}

describe.skipIf(Boolean(skipReason))("Layer 3 · Live data parity", () => {
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

  it(
    "confirms live rows do not currently violate required-type fields even when the DB still allows nulls",
    async () => {
      const violations: string[] = [];

      for (const table of Object.keys(SCHEMA_CONTRACTS)) {
        const rowType = tableRowTypes.get(table);
        if (!rowType) continue;

        const fieldMeta = typeFieldMeta.get(rowType) ?? new Map();
        const liveColumns = liveSchema.columnsByTable.get(table) ?? [];

        for (const column of liveColumns) {
          if (column.is_nullable !== "YES") continue;
          const meta = fieldMeta.get(column.column_name);
          if (!meta) continue;
          if (meta.optional || meta.nullable) continue;

          const counts = await countNullRows(table, column.column_name);
          if (counts.nullRows > 0) {
            violations.push(
              `${table}.${column.column_name} has ${counts.nullRows} null rows out of ${counts.totalRows} but ${rowType} expects ${meta.raw}`,
            );
          }
        }
      }

      expect(violations).toEqual([]);
    },
    120_000,
  );
});
