// =====================================================
// Catalog context builder
// Fetches products from Supabase and projects them into
// compact JSONL suitable for Opus 4.7 (1M context).
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import type { Product } from "@/types/database";

/** Fields we project for AI context — keep it lean to maximize density. */
export type CompactProduct = {
  id: string;
  type: Product["type"];
  brand: string;
  name_ar: string;
  name_he: string;
  name_en?: string;
  subkind?: string | null;
  appliance_kind?: string | null;
  price: number;
  has_desc_ar: boolean;
  has_desc_he: boolean;
  needs_classification: boolean;
};

export interface CatalogContext {
  products: CompactProduct[];
  jsonl: string;
  totalRows: number;
}

export async function loadCatalogContext(opts?: {
  /** Cap row count if you only want a sample. 0/undefined = all (up to safety cap). */
  limit?: number;
  /** Filter by needs_classification flag. */
  onlyNeedsClassification?: boolean;
}): Promise<CatalogContext> {
  const sb = createAdminSupabase();
  let q = sb
    .from("products")
    .select(
      "id,type,brand,name_ar,name_he,name_en,subkind,appliance_kind,price,description_ar,description_he,needs_classification",
    )
    .order("created_at", { ascending: false });

  if (opts?.onlyNeedsClassification) q = q.eq("needs_classification", true);
  q = q.limit(opts?.limit && opts.limit > 0 ? opts.limit : 5000);

  const { data, error } = await q;
  if (error) throw error;

  const rows = (data || []) as Array<
    Pick<
      Product,
      "id" | "type" | "brand" | "name_ar" | "name_he" | "name_en" | "subkind" | "appliance_kind" | "price"
    > & {
      description_ar?: string | null;
      description_he?: string | null;
      needs_classification?: boolean | null;
    }
  >;

  const products: CompactProduct[] = rows.map((r) => ({
    id: r.id,
    type: r.type,
    brand: r.brand,
    name_ar: r.name_ar,
    name_he: r.name_he,
    name_en: r.name_en || undefined,
    subkind: r.subkind ?? null,
    appliance_kind: r.appliance_kind ?? null,
    price: Number(r.price ?? 0),
    has_desc_ar: !!(r.description_ar && r.description_ar.trim()),
    has_desc_he: !!(r.description_he && r.description_he.trim()),
    needs_classification: !!r.needs_classification,
  }));

  const jsonl = products.map((p) => JSON.stringify(p)).join("\n");

  return { products, jsonl, totalRows: products.length };
}

/** Lightweight context — only the fields needed for classification of unknown rows. */
export async function loadUnclassifiedSample(limit = 100): Promise<{
  rows: { id: string; name_ar: string; name_he: string; price: number; type: string }[];
}> {
  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("products")
    .select("id,name_ar,name_he,price,type")
    .eq("needs_classification", true)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return { rows: (data || []) as never };
}

// In-process cache for description samples. The samples teach Opus our
// store's tone — they don't need to be fresh on every generate call.
type Sample = { name_en: string; description_ar: string; description_he: string };
let SAMPLES_CACHE: { value: Sample[]; expiresAt: number } | null = null;
const SAMPLES_TTL_MS = 60 * 60 * 1000; // 1 hour

/** Pick description samples to teach Opus the store tone. */
export async function loadDescriptionSamples(limit = 30): Promise<Sample[]> {
  const now = Date.now();
  if (SAMPLES_CACHE && SAMPLES_CACHE.expiresAt > now && SAMPLES_CACHE.value.length >= limit) {
    return SAMPLES_CACHE.value.slice(0, limit);
  }

  const sb = createAdminSupabase();
  const { data, error } = await sb
    .from("products")
    .select("name_en,description_ar,description_he")
    .not("description_ar", "is", null)
    .not("description_he", "is", null)
    .neq("description_ar", "")
    .neq("description_he", "")
    .limit(Math.max(limit, 30));

  if (error) throw error;
  const samples = (data || []).filter(
    (r: { name_en: string | null; description_ar: string | null; description_he: string | null }) =>
      !!r.name_en && !!r.description_ar && !!r.description_he,
  ) as Sample[];

  SAMPLES_CACHE = { value: samples, expiresAt: now + SAMPLES_TTL_MS };
  return samples.slice(0, limit);
}
