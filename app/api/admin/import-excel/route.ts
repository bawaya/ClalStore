// =====================================================
// Admin: Excel bulk import for non-mobile catalogs
// 1) POST /api/admin/import-excel?step=parse  (multipart) — parses file → JSON rows
// 2) POST /api/admin/import-excel?step=classify (json)    — Claude Haiku classifies + translates
// 3) POST /api/admin/import-excel?step=insert (json)      — bulk inserts to products
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import type { Product, ProductType, ApplianceKind, ProductSubkind, ProductVariantKind } from "@/types/database";

const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY_ADMIN ||
  process.env.ANTHROPIC_API_KEY ||
  "";

const CLAUDE_MODEL = process.env.ANTHROPIC_IMPORT_MODEL || "claude-haiku-4-5-20251001";

// ===== Excluded brand sections (mobile phones) =====
const EXCLUDED_BRAND_RE = /(iPhone|Galaxy|Xiaomi|Redmi|ZTE)/i;
// Detect duplicate "HOT Mobile supply" rows
const HOT_DUP_RE = /אספקה הוט מובייל/;

interface RawRow {
  sheet: string;
  brand_section: string; // last seen brand header
  barcode: string;
  desc: string;
  model: string;
  stock: number;
  monthly: number;
  cash: number;
  is_hot_supply: boolean;
}

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
    if (!normalized) return 0;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function parseSheetRows(wb: XLSX.WorkBook, sheetName: string): RawRow[] {
  const ws = wb.Sheets[sheetName];
  if (!ws) return [];
  const aoa = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: null });
  const rows: RawRow[] = [];
  let currentBrand = "";
  for (let i = 1; i < aoa.length; i++) {
    const r = aoa[i];
    if (!r || r.length === 0) continue;
    const barcode = r[0] != null ? String(r[0]).trim() : "";
    if (!barcode) continue;
    if (barcode.includes("◆")) {
      // brand header — extract: "◆  Apple — iPhone  ◆  (53)" → "Apple — iPhone"
      const m = barcode.match(/◆\s*([^◆]+?)\s*◆/);
      currentBrand = m ? m[1].trim() : "";
      continue;
    }
    const desc = String(r[1] || "").trim();
    const model = String(r[2] || "").trim();
    const stock = toSafeNumber(r[3]);
    const monthly = toSafeNumber(r[4]);
    const cash = toSafeNumber(r[5]);
    if (!desc) continue;
    rows.push({
      sheet: sheetName,
      brand_section: currentBrand,
      barcode,
      desc,
      model,
      stock,
      monthly,
      cash,
      is_hot_supply: HOT_DUP_RE.test(desc),
    });
  }
  return rows;
}

// ============================================================
// Step 1: PARSE — read uploaded xlsx → flat JSON rows
// ============================================================
async function handleParse(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return apiError("ملف غير صالح", 400);
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const wb = XLSX.read(buffer, { type: "buffer" });

  // We accept all sheets but skip TEST and never include mobile-phone sections
  const allSheets = wb.SheetNames.filter((n) => !/test/i.test(n));
  let rows: RawRow[] = [];
  for (const s of allSheets) rows.push(...parseSheetRows(wb, s));

  const before = rows.length;
  rows = rows.filter((r) => !EXCLUDED_BRAND_RE.test(r.brand_section));
  const afterMobile = rows.length;
  const dupCount = rows.filter((r) => r.is_hot_supply).length;
  // Keep HOT-supply rows in the response so the UI can show them and let the user toggle.

  return apiSuccess({
    rows,
    stats: {
      total: before,
      after_mobile_filter: afterMobile,
      hot_duplicates: dupCount,
      sheets: allSheets,
    },
  });
}

// ============================================================
// Step 2: CLASSIFY — send rows to Claude in batches of 12
//   Returns: { classified: ClassifiedRow[] }
// ============================================================

interface ClassifyInput {
  rows: RawRow[];
  /** Cost margin estimate (0..1). default 0.65 (cost = cash * 0.65) */
  costRatio?: number;
}

interface ClassifiedRow {
  // forwarded
  barcode: string;
  desc: string;
  model: string;
  brand_section: string;
  stock: number;
  monthly: number;
  cash: number;
  // ai-derived
  type: ProductType;
  subkind?: ProductSubkind | null;
  appliance_kind?: ApplianceKind | null;
  brand: string;
  name_ar: string;
  name_he: string;
  name_en: string;
  warranty_months: number;
  variant_kind: ProductVariantKind;
  specs: Record<string, string>;
  cost: number;
  // for grouping into variants in step 3
  group_key: string;
  variant_label: string;
  /** Suggested action: skip if true (mobile leak / unknown) */
  skip: boolean;
  skip_reason?: string;
}

const CLASSIFIER_SYSTEM = `You classify Israeli electronics catalog items written in Hebrew/English into one of these types and subkinds for a Next.js storefront.

Allowed types and subkinds:
- "tv"       (subkind: oled|qled|neo_qled|mini_led|uhd|nano|fhd|other)
- "computer" (subkind: laptop_gaming|laptop_business|laptop_2in1|desktop|printer_inkjet|printer_laser|printer_aio|other)
- "tablet"   (subkind: apple_pro|apple_air|apple_basic|kids|android|other)
- "network"  (subkind: router_mesh|wifi_extender|switch|access_point|other)
- "appliance" (use "appliance_kind" instead of "subkind"; appliance_kind is one of: robot_vacuum|air_fryer|espresso|kettle|blender|ninja_pot|coffee_maker|iron|hair_dryer|smart_speaker|food_processor|stand_mixer|stick_vacuum|hair_styler|shaver_trimmer|juicer|toaster|steam_grill|popcorn|ice_maker|ipl_hair_removal|cookware_set|fan|microwave|other)

Rules:
- If item is clearly a phone (iPhone/Galaxy/Pixel) set "skip": true with skip_reason "mobile".
- If item is unknown or ambiguous, set "skip": true with skip_reason "unknown".
- Translate the Hebrew/English product name to a clean Arabic name (keep brand & model letters in English).
- Provide a clean English name (just brand + model + key spec).
- For TVs: extract specs.screen_size_inch (number as string), specs.resolution ("4K UHD" or "FHD"), specs.smart_os if known.
- For laptops: extract specs.cpu, specs.ram_gb, specs.storage_gb, specs.gpu (when stated).
- For tablets: extract specs.chip (M2/M3/A14...), specs.screen_size_inch, specs.cellular ("WiFi" or "WiFi+Cellular").
- For appliances: extract specs.power_w if stated, specs.capacity_l if stated.
- variant_kind: "model" for everything except tablets which use "storage".
- group_key: a stable lowercase ASCII identifier that is identical for SKUs that are color/storage variants of the same model (e.g. "ipad-air-m3-11"). variant_label is the differentiator (e.g. "256GB Space Grey").
- warranty_months: usually 12 for appliances, 24 for TVs and laptops, 12 for tablets unless text says otherwise.
- Brand: one short token (LG, Samsung, Apple, Acer, HP, Lenovo, Dyson, Roborock, Magimix, ...). Default to brand_section if obvious.

Return ONLY a JSON array, one object per input row, in the SAME ORDER. No commentary.`;

function buildUserPrompt(rows: RawRow[]): string {
  return JSON.stringify(
    rows.map((r, i) => ({
      i,
      barcode: r.barcode,
      desc: r.desc,
      model: r.model,
      brand_section: r.brand_section,
    })),
  );
}

async function callClaude(rows: RawRow[]): Promise<unknown[]> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8000,
      system: CLASSIFIER_SYSTEM,
      messages: [{ role: "user", content: buildUserPrompt(rows) }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Claude HTTP ${res.status}: ${t.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = (data.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text)
    .join("\n")
    .trim();
  // Strip code-fence if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    const parsed = JSON.parse(cleaned);
    if (!Array.isArray(parsed)) throw new Error("not an array");
    return parsed;
  } catch (e) {
    throw new Error(`Claude returned non-JSON: ${cleaned.slice(0, 200)}`);
  }
}

async function handleClassify(req: NextRequest) {
  if (!ANTHROPIC_API_KEY) return apiError("Anthropic API key غير مفعّل", 503);
  const body = (await req.json()) as ClassifyInput;
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return apiError("لا يوجد صفوف للتصنيف", 400);
  }
  const costRatio = Math.min(0.95, Math.max(0.1, body.costRatio ?? 0.65));

  const out: ClassifiedRow[] = [];
  const BATCH = 12;
  for (let i = 0; i < body.rows.length; i += BATCH) {
    const batch = body.rows.slice(i, i + BATCH);
    let aiRes: unknown[] = [];
    try {
      aiRes = await callClaude(batch);
    } catch (e) {
      console.error("Claude classify batch failed:", e);
      // Fall back: mark these rows as skip:unknown
      aiRes = batch.map(() => ({ skip: true, skip_reason: "ai_error" }));
    }
    for (let j = 0; j < batch.length; j++) {
      const raw = batch[j];
      const ai = (aiRes[j] || {}) as Partial<ClassifiedRow>;
      const stock = toSafeNumber(raw.stock);
      const monthly = toSafeNumber(raw.monthly);
      const cash = toSafeNumber(raw.cash);
      const cost = ai.cost && ai.cost > 0 ? Number(ai.cost) : Math.round(cash * costRatio);
      out.push({
        barcode: raw.barcode,
        desc: raw.desc,
        model: raw.model,
        brand_section: raw.brand_section,
        stock,
        monthly,
        cash,
        type: (ai.type || "appliance") as ProductType,
        subkind: ai.subkind ?? null,
        appliance_kind: ai.appliance_kind ?? null,
        brand: ai.brand || raw.brand_section.split(/[—\-]/)[0].trim() || "غير معروف",
        name_ar: ai.name_ar || raw.desc,
        name_he: ai.name_he || raw.desc,
        name_en: ai.name_en || "",
        warranty_months: Number(ai.warranty_months) || 12,
        variant_kind: (ai.variant_kind || "model") as ProductVariantKind,
        specs: (ai.specs && typeof ai.specs === "object" ? (ai.specs as Record<string, string>) : {}),
        cost,
        group_key: ai.group_key || raw.barcode,
        variant_label: ai.variant_label || "",
        skip: !!ai.skip || raw.is_hot_supply,
        skip_reason: ai.skip_reason || (raw.is_hot_supply ? "hot_duplicate" : undefined),
      });
    }
  }

  return apiSuccess({ classified: out });
}

// ============================================================
// Step 3: INSERT — group classified rows into products + variants and bulk-insert
// ============================================================

interface InsertInput {
  rows: ClassifiedRow[];
  /** Stock value to use for "متوفر بالطلب" sentinel (default 999 keeps Excel value) */
  preserveStock999?: boolean;
  /** Override default cost ratio for any row missing cost */
  costRatio?: number;
}

async function handleInsert(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = (await req.json()) as InsertInput;
  if (!supabase) return apiError("supabase غير مفعّل", 503);
  if (!Array.isArray(body.rows)) return apiError("صيغة غير صالحة", 400);

  const rows = body.rows.filter((r) => !r.skip);
  const groups = new Map<string, ClassifiedRow[]>();
  for (const r of rows) {
    const key = r.group_key || r.barcode;
    const arr = groups.get(key) || [];
    arr.push(r);
    groups.set(key, arr);
  }

  const products: Array<Partial<Product>> = [];
  for (const [, members] of groups) {
    const head = members[0];
    const variants = members.map((m) => ({
      storage: m.variant_label || m.model || m.barcode.slice(-6),
      price: Math.round(toSafeNumber(m.cash)),
      monthly_price: toSafeNumber(m.monthly) > 0 ? Math.round(toSafeNumber(m.monthly)) : undefined,
      cost: Math.round(m.cost),
      stock: Math.max(0, Math.round(toSafeNumber(m.stock))),
    }));
    const minPrice = Math.min(...variants.map((v) => v.price).filter((p) => p > 0));
    products.push({
      type: head.type,
      brand: head.brand,
      name_ar: head.name_ar,
      name_he: head.name_he,
      name_en: head.name_en || undefined,
      price: minPrice > 0 && minPrice < Infinity ? minPrice : Math.round(toSafeNumber(head.cash)),
      cost: Math.round(head.cost),
      stock: variants.reduce((s, v) => s + v.stock, 0),
      sold: 0,
      image_url: undefined,
      gallery: [],
      colors: [],
      storage_options: variants.map((v) => v.storage),
      variants,
      specs: head.specs,
      active: true,
      featured: false,
      warranty_months: head.warranty_months,
      model_number: head.model || head.barcode,
      variant_kind: head.variant_kind,
      appliance_kind: head.type === "appliance" ? head.appliance_kind : null,
      subkind: head.type !== "appliance" ? (head.subkind ?? null) : null,
    });
  }

  // Bulk insert in chunks of 50
  let inserted = 0;
  const errors: string[] = [];
  const CHUNK = 50;
  for (let i = 0; i < products.length; i += CHUNK) {
    const slice = products.slice(i, i + CHUNK);
    const { data, error } = await supabase.from("products").insert(slice as never[]).select("id");
    if (error) {
      console.error("Insert error:", error);
      errors.push(error.message);
      continue;
    }
    inserted += data?.length || 0;
  }

  return apiSuccess({ inserted, total_groups: products.length, errors });
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const step = url.searchParams.get("step");
  try {
    if (step === "parse") return await handleParse(req);
    if (step === "classify") return await handleClassify(req);
    if (step === "insert") return await handleInsert(req);
    return apiError("step غير معروف (parse | classify | insert)", 400);
  } catch (err: unknown) {
    console.error("import-excel error:", err);
    const msg = err instanceof Error ? err.message : "خطأ غير متوقع";
    return apiError(msg, 500);
  }
}
