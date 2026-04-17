// Run a SQL migration file against Supabase via direct Postgres connection
// Usage: npx tsx scripts/run-migration.ts [migration-file]
// Default: supabase/migrations/028_commission_employees.sql
// Requires DATABASE_URL in .env.local

import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import postgres from "postgres";

dotenv.config({ path: ".env.local" });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error(
    "❌ DATABASE_URL مش موجود في .env.local\n" +
      "➡ أضفه من Supabase Dashboard → Settings → Database → Connection string (URI)\n" +
      "   مثال: postgresql://postgres.[REF]:[PASSWORD]@aws-0-us-east-1.pooler.supabase.com:6543/postgres"
  );
  process.exit(1);
}

const defaultFile = "supabase/migrations/028_commission_employees.sql";
const migrationFile = process.argv[2] || defaultFile;
const sqlPath = path.resolve(migrationFile);

if (!fs.existsSync(sqlPath)) {
  console.error(`❌ الملف غير موجود: ${sqlPath}`);
  process.exit(1);
}

async function runMigration() {
  const sql = fs.readFileSync(sqlPath, "utf-8");
  console.log(`📄 Migration: ${migrationFile}`);
  console.log(`📝 SQL Preview:\n${sql.substring(0, 500)}...\n`);

  const db = postgres(DATABASE_URL!, { ssl: "require" });

  try {
    console.log("⏳ Connecting to database...");
    await db.unsafe(sql);
    console.log("✅ Migration executed successfully!");

    // Verify the table was created
    const tables = await db`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'commission_employees'
    `;
    if (tables.length > 0) {
      console.log("✅ Table commission_employees exists");
    }

    // Check if employee_name column was added
    const cols = await db`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'commission_sales' AND column_name = 'employee_name'
    `;
    if (cols.length > 0) {
      console.log("✅ Column commission_sales.employee_name exists");
    }
  } catch (err) {
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

runMigration();
