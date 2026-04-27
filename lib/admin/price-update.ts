// =====================================================
// Price-update tool — pure logic (no I/O)
// Used by /api/admin/price-update and unit tests.
// =====================================================

export interface PriceRow {
  idx: number;       // original row index in Excel
  name: string;      // raw name from Excel
  cash: number;      // total price
  monthly: number;   // monthly installment ×36
}

export interface ProductLite {
  id: string;
  name_ar: string;
  name_he: string;
  name_en?: string | null;
  brand: string;
  model_number?: string | null;
  price: number;
  variants: Array<{
    storage: string;
    price: number;
    old_price?: number;
    monthly_price?: number;
    cost?: number;
    stock?: number;
  }>;
  cost: number;
}

export type MatchStatus =
  | "exact"        // direct hit on a normalized name
  | "high"         // ≥ 80 score (token overlap or substring)
  | "ambiguous"    // 2+ candidates within 5 points of each other
  | "low"          // best score < 70 — needs AI or human review
  | "none";        // no candidate at all

export interface MatchCandidate {
  productId: string;
  productName: string;
  brand: string;
  score: number;
  reason: string;
}

export interface PriceWarning {
  level: "yellow" | "red";
  code: "delta_high" | "monthly_mismatch" | "below_cost" | "zero_price" | "zero_monthly";
  message: string;
}

const NUMBER_RE = /(\d+(?:\.\d+)?)/g;
const STORAGE_RE = /\b(\d+(?:\.\d+)?)\s*(gb|tb|mb)\b/i;
const TOKEN_SPLIT_RE = /[\s\-_/\\(),.+×*&]+/;
const ARABIC_DIACRITICS_RE = /[ً-ٰٟ]/g;
const TATWEEL_RE = /ـ/g;

const ARABIC_TO_LATIN_BRAND: Record<string, string> = {
  "سامسونج": "samsung",
  "سامسونغ": "samsung",
  "ابل": "apple",
  "آبل": "apple",
  "أبل": "apple",
  "هواوي": "huawei",
  "شاومي": "xiaomi",
  "شياومي": "xiaomi",
  "ريلمي": "realme",
  "اوبو": "oppo",
  "أوبو": "oppo",
  "وان بلس": "oneplus",
  "ون بلس": "oneplus",
  "غوغل": "google",
  "جوجل": "google",
  "سوني": "sony",
  "ال جي": "lg",
  "ال_جي": "lg",
  "ايفون": "iphone",
  "آيفون": "iphone",
  "أيفون": "iphone",
  "جالكسي": "galaxy",
  "غالاكسي": "galaxy",
};

const HEBREW_TO_LATIN_BRAND: Record<string, string> = {
  "סמסונג": "samsung",
  "אפל": "apple",
  "אייפון": "iphone",
  "גלקסי": "galaxy",
  "שיאומי": "xiaomi",
  "שאומי": "xiaomi",
  "סוני": "sony",
};

/** Lower-case, strip diacritics, fold Arabic/Hebrew brand names to Latin. */
export function normalizeName(input: string): string {
  if (!input) return "";
  let out = String(input).trim().toLowerCase();
  out = out.replace(ARABIC_DIACRITICS_RE, "").replace(TATWEEL_RE, "");

  for (const [from, to] of Object.entries(ARABIC_TO_LATIN_BRAND)) {
    out = out.replaceAll(from, to);
  }
  for (const [from, to] of Object.entries(HEBREW_TO_LATIN_BRAND)) {
    out = out.replaceAll(from, to);
  }

  out = out
    .replace(/[؀-ۿ]/g, "") // remaining arabic letters
    .replace(/[֐-׿]/g, "") // remaining hebrew letters
    .replace(/[^\w\d\s\-+]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return out;
}

/** Extract storage like "256gb", "1tb" if present in the name. */
export function extractStorage(name: string): string | null {
  const m = STORAGE_RE.exec(name);
  if (!m) return null;
  const value = Number(m[1]);
  const unit = m[2].toLowerCase();
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${Math.round(value)}${unit.toUpperCase()}`;
}

/** Tokenize a normalized name into searchable tokens. */
export function tokenize(name: string): string[] {
  if (!name) return [];
  return normalizeName(name)
    .split(TOKEN_SPLIT_RE)
    .filter((t) => t.length >= 2);
}

/** Score how well an Excel name matches a product (0–100). */
export function scoreMatch(excelName: string, product: ProductLite): number {
  const exTokens = new Set(tokenize(excelName));
  if (exTokens.size === 0) return 0;

  const candidates = [product.name_ar, product.name_he, product.name_en, product.model_number]
    .filter((s): s is string => !!s && s.trim().length > 0);

  let best = 0;
  for (const candidate of candidates) {
    const cTokens = new Set(tokenize(candidate));
    if (cTokens.size === 0) continue;

    const intersection = [...exTokens].filter((t) => cTokens.has(t)).length;
    if (intersection === 0) continue;

    // Symmetric Jaccard-style score, weighted toward containing all Excel tokens.
    const recall = intersection / exTokens.size;       // how much of Excel name we found
    const precision = intersection / cTokens.size;     // how much of product we used
    const score = Math.round((recall * 0.7 + precision * 0.3) * 100);

    // Bonus for exact-after-normalization match
    if (normalizeName(excelName) === normalizeName(candidate)) {
      best = Math.max(best, 100);
      continue;
    }

    if (score > best) best = score;
  }

  // Brand alignment bonus (helps disambiguate same model across brands)
  const exNormalized = normalizeName(excelName);
  const brandNormalized = normalizeName(product.brand);
  if (brandNormalized && exNormalized.includes(brandNormalized)) {
    best = Math.min(100, best + 5);
  }

  return best;
}

/** Find the top-N candidate matches, sorted descending. */
export function findCandidates(
  excelName: string,
  products: ProductLite[],
  limit = 10,
): MatchCandidate[] {
  const scored: MatchCandidate[] = [];
  for (const product of products) {
    const score = scoreMatch(excelName, product);
    if (score <= 0) continue;
    scored.push({
      productId: product.id,
      productName: product.name_ar || product.name_he || product.name_en || "",
      brand: product.brand,
      score,
      reason: score === 100 ? "exact" : "fuzzy",
    });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

/**
 * Decide match status from a list of scored candidates.
 *  - exact      → top score == 100
 *  - high       → top score ≥ 80, and runner-up trails by ≥ 8
 *  - ambiguous  → top score ≥ 70 but runner-up within 5
 *  - low        → top score 50-79 with no clear runner-up
 *  - none       → no candidate or top score < 50
 */
export function classifyMatchStatus(candidates: MatchCandidate[]): MatchStatus {
  if (candidates.length === 0) return "none";
  const top = candidates[0].score;
  const second = candidates[1]?.score ?? 0;

  if (top >= 100) return "exact";
  if (top < 50) return "none";
  if (top >= 70 && top - second < 5 && candidates.length >= 2) return "ambiguous";
  if (top >= 80) return "high";
  return "low";
}

/**
 * Run the per-row sanity checks the user requested:
 *  - delta > 30%
 *  - |monthly × 36 − cash| > 5%
 *  - cash < cost (selling at a loss)
 *  - new price/monthly is zero
 */
export function runValidations(
  row: PriceRow,
  product?: ProductLite | null,
  installments = 36,
): PriceWarning[] {
  const warnings: PriceWarning[] = [];

  if (row.cash <= 0) {
    warnings.push({
      level: "red",
      code: "zero_price",
      message: "السعر الكاش صفر أو سالب",
    });
  }

  if (row.monthly <= 0) {
    warnings.push({
      level: "yellow",
      code: "zero_monthly",
      message: "القسط الشهري صفر — لن يظهر سطر التقسيط في الكرت",
    });
  }

  if (row.cash > 0 && row.monthly > 0 && installments > 0) {
    const expected = row.monthly * installments;
    const drift = Math.abs(expected - row.cash) / row.cash;
    if (drift > 0.05) {
      warnings.push({
        level: "yellow",
        code: "monthly_mismatch",
        message: `قسط×${installments} = ₪${Math.round(expected).toLocaleString()} يختلف عن السعر الكاش بأكثر من 5%`,
      });
    }
  }

  if (product && row.cash > 0 && product.price > 0) {
    const delta = Math.abs(row.cash - product.price) / product.price;
    if (delta > 0.3) {
      const dir = row.cash > product.price ? "ارتفاع" : "انخفاض";
      warnings.push({
        level: "yellow",
        code: "delta_high",
        message: `${dir} ${Math.round(delta * 100)}% عن السعر الحالي ₪${product.price.toLocaleString()}`,
      });
    }
  }

  if (product && product.cost > 0 && row.cash > 0 && row.cash < product.cost) {
    warnings.push({
      level: "red",
      code: "below_cost",
      message: `السعر ₪${row.cash.toLocaleString()} أقل من التكلفة ₪${product.cost.toLocaleString()} (بيع بخسارة)`,
    });
  }

  return warnings;
}

/** Apply new prices to all variants of a product, returning the updated array. */
export function applyPriceToVariants(
  variants: ProductLite["variants"],
  cash: number,
  monthly: number,
): ProductLite["variants"] {
  if (!Array.isArray(variants) || variants.length === 0) return [];
  return variants.map((v) => ({
    ...v,
    price: Math.round(cash),
    monthly_price: monthly > 0 ? Math.round(monthly) : undefined,
  }));
}
