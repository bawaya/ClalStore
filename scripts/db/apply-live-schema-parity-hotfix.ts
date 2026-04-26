import dotenv from "dotenv";
import fs from "node:fs/promises";
import path from "node:path";
import { runSql } from "@/lib/supabase-management";

dotenv.config({ path: ".env.local" });

async function main() {
  const migrationPath = path.join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260426000001_live_schema_parity_hotfix.sql"
  );

  const sql = await fs.readFile(migrationPath, "utf8");
  const { error } = await runSql(sql);

  if (error) {
    throw new Error(error);
  }

  console.log("Applied live schema parity hotfix successfully.");
}

main().catch((error) => {
  console.error("Failed to apply live schema parity hotfix.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
