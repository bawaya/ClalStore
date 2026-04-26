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
    "20260426000002_nullability_hardening_phase1.sql"
  );

  const sql = await fs.readFile(migrationPath, "utf8");
  const { error } = await runSql(sql);

  if (error) {
    throw new Error(error);
  }

  console.log("Applied nullability hardening phase 1 successfully.");
}

main().catch((error) => {
  console.error("Failed to apply nullability hardening phase 1.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
