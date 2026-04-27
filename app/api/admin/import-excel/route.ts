// =====================================================
// Admin: Excel bulk import for non-mobile catalogs
// 1) POST /api/admin/import-excel?step=parse     (multipart) -> parses file -> JSON rows
// 2) POST /api/admin/import-excel?step=classify  (json)      -> AI classifies + translates
// 3) POST /api/admin/import-excel?step=insert    (json)      -> bulk inserts to products
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { requireAdmin } from "@/lib/admin/auth";
import { callClaude } from "@/lib/ai/claude";
import { callGemini } from "@/lib/ai/gemini";
import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import type {
  ApplianceKind,
  Product,
  ProductSubkind,
  ProductType,
  ProductVariantKind,
} from "@/types/database";

type AiProvider = "Google Gemini" | "Anthropic Claude";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const GEMINI_MODEL = "gemini-1.5-flash-latest";
const ANTHROPIC_API_KEY =
  process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || "";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

const EXCLUDED_BRAND_RE = /(iphone|galaxy|xiaomi|redmi|zte)/i;
const HOT_DUP_RE = /אספקה הוט מובייל/i;

interface RawRow {
  sheet: string;
  brand_section: string;
  barcode: string;
  desc: string;
  model: string;
  stock: number;
  monthly: number;
  cash: number;
  is_hot_supply: boolean;
}

interface ClassifyInput {
  rows: RawRow[];
  costRatio?: number;
}

interface ClassifiedRow {
  barcode: string;
  desc: string;
  model: string;
  brand_section: string;
  stock: number;
  monthly: number;
  cash: number;
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
  group_key: string;
  variant_label: string;
  skip: boolean;
  skip_reason?: string;
}

interface InsertInput {
  rows: ClassifiedRow[];
  preserveStock999?: boolean;
  costRatio?: number;
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

function isLikelyMobileRow(row: RawRow): boolean {
  return EXCLUDED_BRAND_RE.test(
    `${row.brand_section} ${row.desc} ${row.model}`.replace(/\s+/g, " ").trim()
  );
}

function parseSheetRows(workbook: XLSX.WorkBook, sheetName: string): RawRow[] {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];

  const rowsMatrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: null,
  });

  const rows: RawRow[] = [];
  let currentBrand = "";

  for (let index = 1; index < rowsMatrix.length; index += 1) {
    const row = rowsMatrix[index];
    if (!row || row.length === 0) continue;

    const barcode = row[0] != null ? String(row[0]).trim() : "";
    if (!barcode) continue;

    if (barcode.includes("◆")) {
      const match = barcode.match(/◆\s*([^◆]+?)\s*◆/);
      currentBrand = match ? match[1].trim() : "";
      continue;
    }

    const desc = String(row[1] || "").trim();
    const model = String(row[2] || "").trim();
    const stock = toSafeNumber(row[3]);
    const monthly = toSafeNumber(row[4]);
    const cash = toSafeNumber(row[5]);

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

async function handleParse(req: NextRequest) {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return apiError("ملف غير صالح", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetNames = workbook.SheetNames.filter((name) => !/test/i.test(name));

  let rows: RawRow[] = [];
  for (const sheetName of sheetNames) {
    rows.push(...parseSheetRows(workbook, sheetName));
  }

  const total = rows.length;
  rows = rows.filter((row) => !isLikelyMobileRow(row));
  const afterMobileFilter = rows.length;
  const hotDuplicates = rows.filter((row) => row.is_hot_supply).length;

  return apiSuccess({
    rows,
    stats: {
      total,
      after_mobile_filter: afterMobileFilter,
      hot_duplicates: hotDuplicates,
      sheets: sheetNames,
    },
  });
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
    rows.map((row, index) => ({
      i: index,
      barcode: row.barcode,
      desc: row.desc,
      model: row.model,
      brand_section: row.brand_section,
    }))
  );
}

function parseClassifierArray(payload: string, provider: AiProvider): unknown[] {
  const cleaned = payload.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const parsed = JSON.parse(cleaned);

  if (!Array.isArray(parsed)) {
    throw new Error(`${provider} returned a non-array payload`);
  }

  return parsed;
}

async function callGeminiClassifier(
  rows: RawRow[],
  apiKey: string,
  model: string
): Promise<unknown[]> {
  const response = await callGemini({
    apiKey,
    model,
    systemPrompt: CLASSIFIER_SYSTEM,
    messages: [{ role: "user", content: buildUserPrompt(rows) }],
    maxTokens: 8000,
    temperature: 0,
    timeout: 120_000,
  });

  const text = response?.text?.trim();
  if (!text) {
    throw new Error("Google Gemini returned an empty response");
  }

  return parseClassifierArray(text, "Google Gemini");
}

async function callClaudeClassifier(
  rows: RawRow[],
  apiKey: string,
  model: string
): Promise<unknown[]> {
  const response = await callClaude({
    apiKey,
    model,
    systemPrompt: CLASSIFIER_SYSTEM,
    messages: [{ role: "user", content: buildUserPrompt(rows) }],
    maxTokens: 8000,
    temperature: 0,
    timeout: 120_000,
  });

  const text = response?.text?.trim();
  if (!text) {
    throw new Error("Anthropic Claude returned an empty response");
  }

  return parseClassifierArray(text, "Anthropic Claude");
}

async function resolveClassifierConfig(): Promise<{
  provider: AiProvider;
  apiKey: string;
  model: string;
}> {
  const { integration, config } = await getIntegrationByTypeWithSecrets("ai_chat");
  const activeProvider =
    integration?.status === "active" && integration.provider === "Google Gemini"
      ? "Google Gemini"
      : integration?.status === "active" && integration.provider === "Anthropic Claude"
        ? "Anthropic Claude"
        : null;

  const provider: AiProvider =
    activeProvider || (GEMINI_API_KEY ? "Google Gemini" : "Anthropic Claude");

  if (provider === "Google Gemini") {
    return {
      provider,
      apiKey: String(config.api_key || GEMINI_API_KEY).trim(),
      model: String(config.model || GEMINI_MODEL).trim(),
    };
  }

  return {
    provider,
    apiKey: String(config.api_key || ANTHROPIC_API_KEY).trim(),
    model: String(config.model || ANTHROPIC_MODEL).trim(),
  };
}

async function handleClassify(req: NextRequest) {
  const classifier = await resolveClassifierConfig();

  if (!classifier.apiKey) {
    return apiError(`مفتاح ${classifier.provider} غير مفعّل`, 503);
  }

  const body = (await req.json()) as ClassifyInput;
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return apiError("لا يوجد صفوف للتصنيف", 400);
  }

  const out: ClassifiedRow[] = [];
  const batchSize = 12;

  for (let index = 0; index < body.rows.length; index += batchSize) {
    const batch = body.rows.slice(index, index + batchSize);
    let aiRes: unknown[] = [];

    try {
      aiRes =
        classifier.provider === "Google Gemini"
          ? await callGeminiClassifier(batch, classifier.apiKey, classifier.model)
          : await callClaudeClassifier(batch, classifier.apiKey, classifier.model);
    } catch (error) {
      console.error(`${classifier.provider} classify batch failed:`, error);
      aiRes = batch.map(() => ({ skip: true, skip_reason: "ai_error" }));
    }

    for (let rowIndex = 0; rowIndex < batch.length; rowIndex += 1) {
      const raw = batch[rowIndex];
      const ai = (aiRes[rowIndex] || {}) as Partial<ClassifiedRow>;
      const stock = toSafeNumber(raw.stock);
      const monthly = toSafeNumber(raw.monthly);
      const cash = toSafeNumber(raw.cash);
      // Cost is not used in this commission-based business model — kept at 0
      // so margin/profit displays in the admin stay neutral.
      const cost = 0;

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
        brand: ai.brand || raw.brand_section.split(/[—-]/)[0].trim() || "غير معروف",
        name_ar: ai.name_ar || raw.desc,
        name_he: ai.name_he || raw.desc,
        name_en: ai.name_en || "",
        warranty_months: Number(ai.warranty_months) || 12,
        variant_kind: (ai.variant_kind || "model") as ProductVariantKind,
        specs:
          ai.specs && typeof ai.specs === "object"
            ? (ai.specs as Record<string, string>)
            : {},
        cost,
        group_key: ai.group_key || raw.barcode,
        variant_label: ai.variant_label || "",
        skip: !!ai.skip || raw.is_hot_supply,
        skip_reason: ai.skip_reason || (raw.is_hot_supply ? "hot_duplicate" : undefined),
      });
    }
  }

  return apiSuccess({
    classified: out,
    provider: classifier.provider,
    model: classifier.model,
  });
}

async function handleInsert(req: NextRequest) {
  const supabase = createAdminSupabase();
  const body = (await req.json()) as InsertInput;

  if (!supabase) return apiError("supabase غير مفعّل", 503);
  if (!Array.isArray(body.rows)) return apiError("صيغة غير صالحة", 400);

  const rows = body.rows.filter((row) => !row.skip);
  const groups = new Map<string, ClassifiedRow[]>();

  for (const row of rows) {
    const key = row.group_key || row.barcode;
    const current = groups.get(key) || [];
    current.push(row);
    groups.set(key, current);
  }

  const products: Array<Partial<Product>> = [];

  for (const [, members] of groups) {
    const head = members[0];
    const variants = members.map((member) => ({
      storage: member.variant_label || member.model || member.barcode.slice(-6),
      price: Math.round(toSafeNumber(member.cash)),
      monthly_price:
        toSafeNumber(member.monthly) > 0
          ? Math.round(toSafeNumber(member.monthly))
          : undefined,
      cost: 0,
      stock: Math.max(0, Math.round(toSafeNumber(member.stock))),
    }));

    const positivePrices = variants.map((variant) => variant.price).filter((price) => price > 0);
    const minPrice =
      positivePrices.length > 0 ? Math.min(...positivePrices) : Math.round(toSafeNumber(head.cash));

    products.push({
      type: head.type,
      brand: head.brand,
      name_ar: head.name_ar,
      name_he: head.name_he,
      name_en: head.name_en || undefined,
      price: minPrice,
      cost: 0,
      stock: variants.reduce((sum, variant) => sum + variant.stock, 0),
      sold: 0,
      image_url: undefined,
      gallery: [],
      colors: [],
      storage_options: variants.map((variant) => variant.storage),
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

  let inserted = 0;
  const errors: string[] = [];
  const chunkSize = 50;

  for (let index = 0; index < products.length; index += chunkSize) {
    const slice = products.slice(index, index + chunkSize);
    const { data, error } = await supabase
      .from("products")
      .insert(slice as never[])
      .select("id");

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
  } catch (error: unknown) {
    console.error("import-excel error:", error);
    const message = error instanceof Error ? error.message : "خطأ غير متوقع";
    return apiError(message, 500);
  }
}
