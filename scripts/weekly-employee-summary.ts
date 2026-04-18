#!/usr/bin/env node
/**
 * scripts/weekly-employee-summary.ts
 *
 * Sends a weekly WhatsApp summary to every active non-customer user who
 * has a phone on file. Ships in dry-run mode by default — set
 * WEEKLY_SUMMARY_DRY_RUN=false in the workflow env to actually send.
 *
 * Runs out-of-process (GitHub Actions), so it creates its own
 * service-role Supabase client directly rather than going through
 * createAdminSupabase (which reaches for Next.js-specific env helpers).
 *
 * Usage (local):
 *   SUPABASE_SERVICE_ROLE_KEY=... NEXT_PUBLIC_SUPABASE_URL=... \
 *     npx tsx scripts/weekly-employee-summary.ts
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  calcMonthlySummary,
  calcLoyaltyBonus,
} from "../lib/commissions/calculator";
import { lastDayOfMonth, getCommissionTarget } from "../lib/commissions/ledger";
import { countWorkingDays } from "../lib/commissions/date-utils";

const YCLOUD_ENDPOINT = "https://api.ycloud.com/v2/whatsapp/messages/sendDirectly";

type User = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
};

function getEnv(name: string, required = true): string {
  const value = process.env[name];
  if (!value && required) {
    console.error(`[weekly-summary] missing env: ${name}`);
    process.exit(1);
  }
  return value || "";
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfIsoWeek(d: Date): Date {
  // Monday as start of week (ISO-8601).
  const copy = new Date(d.getTime());
  const day = copy.getUTCDay();
  const diff = (day === 0 ? -6 : 1 - day);
  copy.setUTCDate(copy.getUTCDate() + diff);
  copy.setUTCHours(0, 0, 0, 0);
  return copy;
}

async function fetchRecipients(db: SupabaseClient): Promise<User[]> {
  const { data, error } = await db
    .from("users")
    .select("id, name, phone, role, status")
    .eq("status", "active")
    .neq("role", "customer");
  if (error) throw new Error(`fetchRecipients failed: ${error.message}`);
  return ((data || []) as User[]).filter((u) => u.phone && u.phone.trim().length >= 9);
}

async function buildSummary(db: SupabaseClient, user: User) {
  const now = new Date();
  const weekStart = startOfIsoWeek(now);
  const weekEnd = new Date(weekStart.getTime());
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);

  const monthStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const monthStart = `${monthStr}-01`;
  const monthEnd = lastDayOfMonth(monthStr);

  const [weekRes, monthRes, sanctionsRes, target] = await Promise.all([
    db
      .from("commission_sales")
      .select("id, commission_amount, package_price, device_sale_amount, sale_type")
      .eq("employee_id", user.id)
      .is("deleted_at", null)
      .gte("sale_date", isoDate(weekStart))
      .lte("sale_date", isoDate(weekEnd)),
    db
      .from("commission_sales")
      .select("sale_type, commission_amount, package_price, device_sale_amount, source, loyalty_start_date, loyalty_status")
      .eq("employee_id", user.id)
      .is("deleted_at", null)
      .gte("sale_date", monthStart)
      .lte("sale_date", monthEnd),
    db
      .from("commission_sanctions")
      .select("amount")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .gte("sanction_date", monthStart)
      .lte("sanction_date", monthEnd),
    getCommissionTarget(db, monthStr, [user.id]),
  ]);

  if (weekRes.error) throw weekRes.error;
  if (monthRes.error) throw monthRes.error;
  if (sanctionsRes.error) throw sanctionsRes.error;

  const weekSales = weekRes.data || [];
  const monthSales = (monthRes.data || []) as Array<{
    sale_type: string;
    commission_amount: number | null;
    package_price: number | null;
    device_sale_amount: number | null;
    source: string | null;
    loyalty_start_date: string | null;
    loyalty_status: string | null;
  }>;

  const saleAmount = (s: { sale_type: string; package_price: number | null; device_sale_amount: number | null }) =>
    s.sale_type === "line" ? Number(s.package_price || 0) : Number(s.device_sale_amount || 0);

  const weekCount = weekSales.length;
  const weekAmount = weekSales.reduce((sum, s) => sum + saleAmount(s), 0);
  const weekCommission = weekSales.reduce(
    (sum, s) => sum + Number(s.commission_amount || 0),
    0,
  );

  const monthAmount = monthSales.reduce((sum, s) => sum + saleAmount(s), 0);
  const loyaltyBonuses = monthSales
    .filter((s) => s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active")
    .reduce((sum, line) => sum + calcLoyaltyBonus(line.loyalty_start_date!).earnedSoFar, 0);

  const summary = calcMonthlySummary(
    monthSales.map((s) => ({
      sale_type: s.sale_type,
      commission_amount: Number(s.commission_amount || 0),
      source: s.source || "",
      device_sale_amount: Number(s.device_sale_amount || 0),
    })),
    (sanctionsRes.data || []).map((s) => ({ amount: Number(s.amount || 0) })),
    loyaltyBonuses,
    target as { target_total: number } | null,
  );

  const targetTotal = Number((target as { target_total?: number } | null)?.target_total || 0);
  const progress = targetTotal > 0 ? Math.min(100, Math.round((monthAmount / targetTotal) * 100)) : 0;

  const endOfMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
  const todayUtcStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const workingDaysLeft = countWorkingDays(todayUtcStart, endOfMonth);
  const remaining = Math.max(0, targetTotal - monthAmount);
  const dailyRequired = workingDaysLeft > 0 ? Math.ceil(remaining / workingDaysLeft) : remaining;

  return {
    weekStart: isoDate(weekStart),
    weekEnd: isoDate(weekEnd),
    weekCount,
    weekAmount,
    weekCommission,
    monthAmount,
    targetTotal,
    progress,
    dailyRequired,
    netCommission: summary.netCommission,
  };
}

function formatMessage(user: User, s: Awaited<ReturnType<typeof buildSummary>>): string {
  const fmt = (n: number) => n.toLocaleString("he-IL", { maximumFractionDigits: 0 });
  const lines = [
    "📊 סיכום שבועי — ClalMobile",
    `שבוע ${s.weekStart} – ${s.weekEnd}`,
    "",
    `💰 מכירות: ${fmt(s.weekAmount)}₪ (${s.weekCount} עסקאות)`,
    `📈 עמלה: ${fmt(s.weekCommission)}₪`,
    `🎯 יעד חודשי: ${s.progress}% (${fmt(s.monthAmount)} / ${fmt(s.targetTotal)}₪)`,
    `📅 נדרש ליום: ${fmt(s.dailyRequired)}₪`,
    "",
    "בהצלחה! 💪",
    "",
    `— ${user.name || "عزيزي الموظف"}`,
    "(النسخة العربية قيد التطوير)",
  ];
  return lines.join("\n");
}

async function sendWhatsApp(to: string, body: string, apiKey: string, fromPhone: string) {
  const resp = await fetch(YCLOUD_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    },
    body: JSON.stringify({
      from: fromPhone,
      to,
      type: "text",
      text: { body },
    }),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`yCloud ${resp.status}: ${text.slice(0, 200)}`);
  }
  return text;
}

async function main() {
  const supabaseUrl = getEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceKey = getEnv("SUPABASE_SERVICE_ROLE_KEY");
  const yCloudKey = process.env.YCLOUD_API_KEY || "";
  const fromPhone = process.env.WHATSAPP_PHONE_ID || "";
  // DRY_RUN parsing: only the exact string "false" (case-insensitive, trimmed)
  // flips to live mode. Typos like "flase" or anything unexpected are surfaced
  // via warning and fall back to dry-run (safe default).
  const dryRunRaw = (process.env.WEEKLY_SUMMARY_DRY_RUN ?? "").trim().toLowerCase();
  if (dryRunRaw && dryRunRaw !== "true" && dryRunRaw !== "false") {
    console.warn(
      `[weekly-summary] WARNING: WEEKLY_SUMMARY_DRY_RUN="${process.env.WEEKLY_SUMMARY_DRY_RUN}" is not "true" or "false" — defaulting to dry-run mode`,
    );
  }
  const dryRun = dryRunRaw !== "false";

  if (!dryRun && (!yCloudKey || !fromPhone)) {
    console.error("[weekly-summary] dry-run=false but YCLOUD_API_KEY or WHATSAPP_PHONE_ID missing — aborting");
    process.exit(1);
  }

  console.log(`[weekly-summary] starting (dryRun=${dryRun})`);

  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const recipients = await fetchRecipients(db);
  console.log(`[weekly-summary] ${recipients.length} recipient(s) found`);

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  for (const user of recipients) {
    try {
      const summary = await buildSummary(db, user);
      if (summary.weekCount === 0 && summary.monthAmount === 0) {
        console.log(`[weekly-summary] skip ${user.name} (${user.phone}) — no activity`);
        skipped++;
        continue;
      }
      const body = formatMessage(user, summary);
      if (dryRun) {
        console.log(`[weekly-summary] DRY-RUN would send to ${user.phone} (${user.name}):`);
        console.log(body);
        console.log("---");
        sent++;
      } else {
        await sendWhatsApp(user.phone!, body, yCloudKey, fromPhone);
        console.log(`[weekly-summary] sent to ${user.phone} (${user.name})`);
        sent++;
      }
    } catch (err) {
      console.error(
        `[weekly-summary] failed for ${user.name} (${user.phone}):`,
        err instanceof Error ? err.message : err,
      );
      failed++;
    }
  }

  console.log(
    `[weekly-summary] done — sent=${sent} skipped=${skipped} failed=${failed} dryRun=${dryRun}`,
  );
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("[weekly-summary] fatal:", err);
  process.exit(1);
});
