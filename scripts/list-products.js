const { loadEnvConfig } = require("@next/env");
const { createClient } = require("@supabase/supabase-js");

loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const db = createClient(supabaseUrl, supabaseKey);

async function main() {
  const { data, error } = await db
    .from("products")
    .select("id, name_en, name_ar, price, variants, type")
    .eq("type", "device")
    .order("name_en");

  if (error) { console.error(error); return; }

  for (const p of data) {
    const storages = (p.variants || []).map(v => `${v.storage}:₪${v.price}`).join(", ");
    console.log(`${p.id} | ${(p.name_en || p.name_ar || "").padEnd(45)} | base:₪${p.price} | ${storages}`);
  }
  console.log(`\nTotal: ${data.length} products`);
}
main();
