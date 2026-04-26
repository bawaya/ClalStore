import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { SCHEMA_CONTRACTS } from "@/lib/schema-contracts";
import { runSql } from "@/lib/supabase-management";
import { fetchLivePublicSchema } from "@/tests/helpers/live-schema-parity";

dotenv.config({ path: ".env.local" });

type TypeFieldMeta = {
  optional: boolean;
  nullable: boolean;
  raw: string;
};

type DriftRecord = {
  table: string;
  column: string;
  rowType: string;
  type: string;
  totalRows: number;
  nullRows: number;
  nullRatio: number;
};

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
  const fields = new Map<string, TypeFieldMeta>();
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

async function queryCount(table: string, column: string) {
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

async function main() {
  const root = process.cwd();
  const typesPath = path.join(root, "types", "database.ts");
  const typeSource = await fs.readFile(typesPath, "utf8");
  const tableRowTypes = extractTableRowTypes(typeSource);
  const liveSchema = await fetchLivePublicSchema();

  const driftRecords: DriftRecord[] = [];

  for (const table of Object.keys(SCHEMA_CONTRACTS)) {
    const rowType = tableRowTypes.get(table);
    if (!rowType) continue;

    const typeFieldMeta = extractTypeFieldMeta(typeSource, rowType);
    const liveColumns = liveSchema.columnsByTable.get(table) ?? [];

    for (const column of liveColumns) {
      if (column.is_nullable !== "YES") continue;
      const meta = typeFieldMeta.get(column.column_name);
      if (!meta) continue;
      if (meta.optional || meta.nullable) continue;

      const { totalRows, nullRows } = await queryCount(table, column.column_name);
      driftRecords.push({
        table,
        column: column.column_name,
        rowType,
        type: meta.raw,
        totalRows,
        nullRows,
        nullRatio: totalRows === 0 ? 0 : Number((nullRows / totalRows).toFixed(6)),
      });
    }
  }

  const reportDir = path.join(root, ".tmp", "schema-audits");
  await fs.mkdir(reportDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const reportPath = path.join(reportDir, `nullability-drift-${timestamp}.json`);
  await fs.writeFile(reportPath, JSON.stringify({ generatedAt: new Date().toISOString(), driftRecords }, null, 2));

  console.log(`Wrote nullability drift audit to ${reportPath}`);
  for (const record of driftRecords) {
    console.log(
      `${record.table}.${record.column} -> nullRows=${record.nullRows}/${record.totalRows} (${(
        record.nullRatio * 100
      ).toFixed(2)}%), type=${record.type}`,
    );
  }
}

main().catch((error) => {
  console.error("Failed to audit live nullability drift.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
