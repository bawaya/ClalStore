/* eslint-disable @typescript-eslint/no-explicit-any */
import dotenv from "dotenv";
import postgres from "postgres";
import { runSql } from "@/lib/supabase-management";

dotenv.config({ path: ".env.local" });

export interface LiveSchemaColumn {
  table_name: string;
  column_name: string;
  is_nullable: "YES" | "NO";
  data_type: string;
  udt_name: string;
  column_default: string | null;
  ordinal_position: number;
}

export interface LivePublicSchema {
  source: "database_url" | "management_api";
  columns: LiveSchemaColumn[];
  columnsByTable: Map<string, LiveSchemaColumn[]>;
}

function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL?.trim());
}

function hasManagementApiAccess() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const token = process.env.SUPABASE_ACCESS_TOKEN;
  const projectRef = process.env.SUPABASE_PROJECT_REF;

  return Boolean((url || projectRef) && token);
}

export function liveSchemaSkipReason(): string | null {
  if (hasDatabaseUrl()) return null;
  if (hasManagementApiAccess()) return null;
  return "DATABASE_URL أو (SUPABASE_ACCESS_TOKEN + NEXT_PUBLIC_SUPABASE_URL/SUPABASE_PROJECT_REF) غير متوفرين";
}

function normalizeRows(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload as Record<string, unknown>[];
  if (!payload || typeof payload !== "object") return [];

  const candidate = payload as Record<string, unknown>;
  const possibleKeys = ["result", "rows", "data"];

  for (const key of possibleKeys) {
    const value = candidate[key];
    if (Array.isArray(value)) return value as Record<string, unknown>[];
  }

  return [];
}

function toColumns(rows: Record<string, unknown>[]): LiveSchemaColumn[] {
  return rows
    .map((row) => ({
      table_name: String(row.table_name ?? ""),
      column_name: String(row.column_name ?? ""),
      is_nullable: (String(row.is_nullable ?? "NO").toUpperCase() === "YES" ? "YES" : "NO") as
        | "YES"
        | "NO",
      data_type: String(row.data_type ?? ""),
      udt_name: String(row.udt_name ?? ""),
      column_default:
        row.column_default === null || row.column_default === undefined
          ? null
          : String(row.column_default),
      ordinal_position: Number(row.ordinal_position ?? 0),
    }))
    .filter((row) => row.table_name && row.column_name)
    .sort((a, b) => {
      if (a.table_name !== b.table_name) return a.table_name.localeCompare(b.table_name);
      return a.ordinal_position - b.ordinal_position;
    });
}

function buildColumnsByTable(columns: LiveSchemaColumn[]) {
  const map = new Map<string, LiveSchemaColumn[]>();
  for (const column of columns) {
    const bucket = map.get(column.table_name) ?? [];
    bucket.push(column);
    map.set(column.table_name, bucket);
  }
  return map;
}

const PUBLIC_SCHEMA_COLUMNS_SQL = `
  SELECT
    c.table_name,
    c.column_name,
    c.is_nullable,
    c.data_type,
    c.udt_name,
    c.column_default,
    c.ordinal_position
  FROM information_schema.columns c
  JOIN information_schema.tables t
    ON t.table_schema = c.table_schema
   AND t.table_name = c.table_name
  WHERE c.table_schema = 'public'
    AND t.table_type = 'BASE TABLE'
  ORDER BY c.table_name, c.ordinal_position;
`;

async function fetchViaDatabaseUrl(): Promise<LivePublicSchema> {
  const sql = postgres(process.env.DATABASE_URL!.trim(), { ssl: "require" });

  try {
    const rows = (await sql.unsafe(PUBLIC_SCHEMA_COLUMNS_SQL)) as Record<string, unknown>[];
    const columns = toColumns(rows);
    return {
      source: "database_url",
      columns,
      columnsByTable: buildColumnsByTable(columns),
    };
  } finally {
    await sql.end();
  }
}

async function fetchViaManagementApi(): Promise<LivePublicSchema> {
  const { data, error } = await runSql(PUBLIC_SCHEMA_COLUMNS_SQL);
  if (error) {
    throw new Error(`Supabase management API schema query failed: ${error}`);
  }

  const columns = toColumns(normalizeRows(data));
  return {
    source: "management_api",
    columns,
    columnsByTable: buildColumnsByTable(columns),
  };
}

export async function fetchLivePublicSchema(): Promise<LivePublicSchema> {
  if (hasDatabaseUrl()) {
    return fetchViaDatabaseUrl();
  }

  if (hasManagementApiAccess()) {
    return fetchViaManagementApi();
  }

  throw new Error(liveSchemaSkipReason() || "Live schema credentials are not configured");
}
