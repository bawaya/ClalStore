export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError } from "@/lib/api-response";

// POST /api/cron/backup — Lightweight data snapshot & health check
export async function POST(req: NextRequest) {
  // Verify cron secret
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return apiError("CRON_SECRET not configured", 503);

  const auth = req.headers.get("authorization") || req.headers.get("x-cron-secret");
  if (auth !== `Bearer ${cronSecret}` && auth !== cronSecret) return apiError("Unauthorized", 401);

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("DB unavailable", 500);

  // Collect record counts from key tables
  const tables = ["orders", "customers", "products", "order_items", "users", "bot_conversations", "settings"];
  const counts: Record<string, number> = {};

  await Promise.all(
    tables.map(async (table) => {
      try {
        const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
        counts[table] = count ?? 0;
      } catch {
        counts[table] = -1; // indicates query failure
      }
    })
  );

  // Get recent activity (orders in last 24h)
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: recentOrders } = await supabase
    .from("orders")
    .select("id", { count: "exact", head: true })
    .gte("created_at", yesterday);

  const snapshot = {
    timestamp: new Date().toISOString(),
    counts,
    recentOrders: recentOrders ?? 0,
    note: "Lightweight snapshot. Full backups are managed via Supabase automatic daily backups.",
  };

  console.log("[Backup] Snapshot:", JSON.stringify(snapshot));

  return apiSuccess(snapshot);
}
