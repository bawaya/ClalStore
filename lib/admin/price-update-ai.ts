// =====================================================
// Price-update tool — AI helpers
// Wraps Claude/Gemini for: column detection, ambiguous
// match resolution, new-product classification, batch
// anomaly detection, description generation.
// Reuses the project's AI integration config.
// =====================================================

import { callClaude } from "@/lib/ai/claude";
import { callGemini } from "@/lib/ai/gemini";
import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";
import type {
  ApplianceKind,
  ProductSubkind,
  ProductType,
  ProductVariantKind,
} from "@/types/database";
import type { MatchCandidate, ProductLite } from "@/lib/admin/price-update";

type AiProvider = "Google Gemini" | "Anthropic Claude";

const GEMINI_MODEL = "gemini-1.5-flash-latest";
const ANTHROPIC_MODEL = "claude-sonnet-4-20250514";

interface ResolvedAi {
  provider: AiProvider;
  apiKey: string;
  model: string;
}

async function resolveAiConfig(): Promise<ResolvedAi> {
  const { integration, config } = await getIntegrationByTypeWithSecrets("ai_chat");
  const fallbackGemini = process.env.GEMINI_API_KEY || "";
  const fallbackAnthropic =
    process.env.ANTHROPIC_API_KEY_ADMIN || process.env.ANTHROPIC_API_KEY || "";

  const active =
    integration?.status === "active" ? integration.provider : null;

  const provider: AiProvider =
    active === "Google Gemini"
      ? "Google Gemini"
      : active === "Anthropic Claude"
        ? "Anthropic Claude"
        : fallbackGemini
          ? "Google Gemini"
          : "Anthropic Claude";

  if (provider === "Google Gemini") {
    return {
      provider,
      apiKey: String(config.api_key || fallbackGemini).trim(),
      model: String(config.model || GEMINI_MODEL).trim(),
    };
  }

  return {
    provider,
    apiKey: String(config.api_key || fallbackAnthropic).trim(),
    model: String(config.model || ANTHROPIC_MODEL).trim(),
  };
}

async function aiCall(
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2000,
): Promise<string | null> {
  const ai = await resolveAiConfig();
  if (!ai.apiKey) return null;

  const fn = ai.provider === "Google Gemini" ? callGemini : callClaude;
  const res = await fn({
    apiKey: ai.apiKey,
    model: ai.model,
    systemPrompt,
    messages: [{ role: "user", content: userMessage }],
    maxTokens,
    temperature: 0,
    timeout: 60_000,
    jsonMode: true,
  });

  return res?.text?.trim() || null;
}

function safeJson<T>(payload: string | null): T | null {
  if (!payload) return null;
  const cleaned = payload.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

// =====================================================
// 1. Column detection
// =====================================================

export interface DetectedColumns {
  name: number;
  cash: number;
  monthly: number;
}

const COLUMN_DETECT_SYSTEM = `You are given the first 3 rows of an Excel sheet. Identify which 0-indexed column holds:
- "name": the product name
- "cash": the total cash price (a positive number, usually ₪500–₪50000)
- "monthly": the monthly installment value on a 36-month plan (a positive number, usually 5–95% of cash/36)

Headers may be in Arabic, Hebrew, or English. The "name" column is text. The "cash" and "monthly" columns are numbers; "cash" is always larger than "monthly".

Return ONLY a JSON object: {"name": <int>, "cash": <int>, "monthly": <int>}. No commentary.`;

export async function detectColumns(
  preview: unknown[][],
): Promise<DetectedColumns | null> {
  if (!preview.length || !preview[0]?.length) return null;

  // Try heuristics first to save AI cost.
  const headers = (preview[0] || []).map((c) => String(c || "").toLowerCase());
  const heuristic = detectColumnsHeuristic(headers);
  if (heuristic) return heuristic;

  const sample = preview.slice(0, 3);
  const result = safeJson<DetectedColumns>(
    await aiCall(
      COLUMN_DETECT_SYSTEM,
      JSON.stringify(sample),
      300,
    ),
  );
  if (
    result &&
    Number.isInteger(result.name) &&
    Number.isInteger(result.cash) &&
    Number.isInteger(result.monthly) &&
    result.name !== result.cash &&
    result.cash !== result.monthly &&
    result.name !== result.monthly
  ) {
    return result;
  }
  return null;
}

function detectColumnsHeuristic(headers: string[]): DetectedColumns | null {
  const find = (...needles: string[]) =>
    headers.findIndex((h) => needles.some((n) => h.includes(n)));

  const name = find("name", "product", "اسم", "منتج", "שם", "מוצר", "תיאור", "desc");
  const monthly = find("monthly", "قسط", "חודשי", "תשלום", "month", "installment");
  const cash =
    find("cash", "price", "كاش", "سعر", "מזומן", "מחיר", "total") !== -1
      ? find("cash", "price", "كاش", "سعر", "מזומן", "מחיר", "total")
      : -1;

  if (name >= 0 && cash >= 0 && monthly >= 0 && name !== cash && cash !== monthly && name !== monthly) {
    return { name, cash, monthly };
  }
  return null;
}

// =====================================================
// 2. Ambiguous match resolution
// =====================================================

export interface AmbiguousResolution {
  productId: string | null;
  confidence: number;
  reason: string;
}

const RESOLVE_SYSTEM = `You match a product name from an Excel row to one of several candidate products in our store catalog.

Return ONLY a JSON object: {"productId": "<id|null>", "confidence": <0-100>, "reason": "<short>"}.
- Pick the candidate whose model and storage best match the Excel name.
- If none of the candidates is a confident match, return productId=null with confidence < 50.
- Reason should be a 5-10 word Arabic phrase explaining the choice.`;

export async function resolveAmbiguous(
  excelName: string,
  candidates: MatchCandidate[],
): Promise<AmbiguousResolution | null> {
  if (candidates.length === 0) return null;
  const userMsg = JSON.stringify({
    excel_name: excelName,
    candidates: candidates.map((c) => ({
      id: c.productId,
      name: c.productName,
      brand: c.brand,
      score: c.score,
    })),
  });
  return safeJson<AmbiguousResolution>(await aiCall(RESOLVE_SYSTEM, userMsg, 500));
}

// =====================================================
// 3. New product classification (when unmatched)
// =====================================================

export interface NewProductDraft {
  type: ProductType;
  subkind?: ProductSubkind | null;
  appliance_kind?: ApplianceKind | null;
  brand: string;
  name_ar: string;
  name_he: string;
  name_en: string;
  warranty_months: number;
  variant_kind: ProductVariantKind;
  storage_label: string;       // single-variant label (extracted storage or "default")
  specs: Record<string, string>;
  description_ar: string;      // 2-3 sentence Arabic description
  description_he: string;      // 2-3 sentence Hebrew description
  category_hint: string | null; // category name for fuzzy match server-side
}

const CLASSIFY_NEW_SYSTEM = `You receive product names from an Israeli electronics retailer's price file. For each name, infer the full product metadata so the system can create a new catalog entry. Names may be in Arabic, Hebrew, or English.

Allowed types and subkinds:
- "device"    (smartphones; subkind null) — for iPhone, Galaxy phone, Pixel, Xiaomi phone, etc.
- "tv"        (subkind: oled|qled|neo_qled|mini_led|uhd|nano|fhd|other)
- "computer"  (subkind: laptop_gaming|laptop_business|laptop_2in1|desktop|printer_inkjet|printer_laser|printer_aio|other)
- "tablet"    (subkind: apple_pro|apple_air|apple_basic|kids|android|other)
- "network"   (subkind: router_mesh|wifi_extender|switch|access_point|other)
- "appliance" (use appliance_kind: robot_vacuum|air_fryer|espresso|kettle|blender|ninja_pot|coffee_maker|iron|hair_dryer|smart_speaker|food_processor|stand_mixer|stick_vacuum|hair_styler|shaver_trimmer|juicer|toaster|steam_grill|popcorn|ice_maker|ipl_hair_removal|cookware_set|fan|microwave|other)
- "accessory" (subkind null)

Rules:
- name_ar: clean Arabic name (keep brand & model letters in English/Latin).
- name_he: clean Hebrew name.
- name_en: brand + model + main spec only.
- variant_kind: "model" for everything except phones/tablets which use "storage".
- storage_label: if the input mentions storage (256GB, 1TB) return that; else "default".
- specs: extract whatever you can — for phones {ram, storage, screen, battery, chip}, TVs {screen_size_inch, resolution, smart_os}, laptops {cpu, ram_gb, storage_gb, gpu}, tablets {chip, screen_size_inch, cellular}, appliances {power_w, capacity_l}.
- description_ar: 2-3 short sentences in Arabic, factual, marketing tone. NO price, NO availability claims.
- description_he: same in Hebrew.
- category_hint: the most likely category name in Arabic ("هواتف ذكية", "تلفزيونات", "حواسيب محمولة", "أجهزة منزلية"…), or null.
- warranty_months: phones 24, TVs/laptops 24, tablets 12, appliances 12 unless name says otherwise.

Return ONLY a JSON array, one object per input row, in the SAME ORDER. No commentary.`;

export async function classifyNewProducts(
  names: string[],
): Promise<NewProductDraft[]> {
  if (names.length === 0) return [];
  const out: NewProductDraft[] = [];
  const batchSize = 8;

  for (let i = 0; i < names.length; i += batchSize) {
    const batch = names.slice(i, i + batchSize);
    const result = safeJson<unknown[]>(
      await aiCall(CLASSIFY_NEW_SYSTEM, JSON.stringify(batch), 4000),
    );

    for (let j = 0; j < batch.length; j += 1) {
      const ai = (Array.isArray(result) ? result[j] : null) as Partial<NewProductDraft> | null;
      out.push({
        type: (ai?.type || "accessory") as ProductType,
        subkind: ai?.subkind ?? null,
        appliance_kind: ai?.appliance_kind ?? null,
        brand: ai?.brand?.trim() || "غير معروف",
        name_ar: ai?.name_ar?.trim() || batch[j],
        name_he: ai?.name_he?.trim() || batch[j],
        name_en: ai?.name_en?.trim() || "",
        warranty_months: Number(ai?.warranty_months) || 12,
        variant_kind: (ai?.variant_kind || "model") as ProductVariantKind,
        storage_label: ai?.storage_label?.trim() || "default",
        specs:
          ai?.specs && typeof ai.specs === "object"
            ? (ai.specs as Record<string, string>)
            : {},
        description_ar: ai?.description_ar?.trim() || "",
        description_he: ai?.description_he?.trim() || "",
        category_hint: ai?.category_hint?.trim() || null,
      });
    }
  }

  return out;
}

// =====================================================
// 4. Batch anomaly detection
// =====================================================

export interface BatchAnomaly {
  level: "yellow" | "red";
  message: string;
}

const ANOMALY_SYSTEM = `You are reviewing a batch of price changes for an Israeli electronics retailer (catalog in Arabic/Hebrew, prices in shekel ₪). Your goal is to spot likely human errors in the Excel file BEFORE the admin clicks apply.

Look for patterns like:
- A large fraction (>40%) of rows dropping by >40% in price → maybe a unit error (₪ vs thousands).
- Rows where the new monthly × 36 is wildly off the new cash price → maybe values entered in the wrong column.
- Many "no match" rows with names that look like minor typos of existing products → maybe duplicate creation risk.
- Suspiciously round prices (₪1, ₪10, ₪100) for premium products.
- Outliers: e.g. a single iPhone priced at ₪200 when others are ₪3000+.

Return ONLY a JSON array of objects: [{"level": "yellow"|"red", "message": "<Arabic, 1 sentence>"}, ...]. Empty array if nothing concerning. Max 5 items.`;

export interface AnomalyInputRow {
  name: string;
  cash: number;
  monthly: number;
  oldPrice?: number | null;
  matched: boolean;
}

export async function detectBatchAnomalies(
  rows: AnomalyInputRow[],
): Promise<BatchAnomaly[]> {
  if (rows.length === 0) return [];
  const result = safeJson<BatchAnomaly[]>(
    await aiCall(ANOMALY_SYSTEM, JSON.stringify(rows), 1500),
  );
  if (!Array.isArray(result)) return [];
  return result.filter(
    (a): a is BatchAnomaly =>
      !!a && (a.level === "yellow" || a.level === "red") && typeof a.message === "string",
  );
}

// =====================================================
// 5. Category matching (for new products)
// =====================================================

export interface CategoryLite {
  id: string;
  name_ar: string;
  name_he: string;
}

/** Pure helper — picks the closest category by name. */
export function pickCategory(
  hint: string | null | undefined,
  categories: CategoryLite[],
): string | null {
  if (!hint || categories.length === 0) return null;
  const normalize = (s: string) =>
    s.trim().toLowerCase().replace(/[\s\-_]+/g, "");
  const target = normalize(hint);
  let best: { id: string; score: number } | null = null;
  for (const c of categories) {
    const a = normalize(c.name_ar);
    const h = normalize(c.name_he);
    let score = 0;
    if (a === target || h === target) score = 100;
    else if (a.includes(target) || target.includes(a)) score = 70;
    else if (h.includes(target) || target.includes(h)) score = 60;
    if (score > 0 && (!best || score > best.score)) {
      best = { id: c.id, score };
    }
  }
  return best?.id || null;
}

// re-export used types for callers that don't want to import the lib twice
export type { ProductLite };
