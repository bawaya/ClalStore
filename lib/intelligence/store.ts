// =====================================================
// Persistence — apply Intelligence suggestions to DB
// Writes products + classification_history audit row.
// =====================================================

import { createAdminSupabase } from "@/lib/supabase";
import type { ClassificationItem } from "./schemas";
import type { Product } from "@/types/database";

export interface ApplyResult {
  applied: number;
  skipped: number;
  errors: { id: string; error: string }[];
}

export interface ApplyInput {
  product_id: string;
  before: Partial<Product>;
  classification: ClassificationItem;
  reviewed_by?: string;
  source: "opus_auto" | "opus_assisted" | "human";
}

const ALLOWED_PRODUCT_FIELDS = new Set([
  "brand",
  "type",
  "subkind",
  "appliance_kind",
  "name_en",
  "description_ar",
  "description_he",
  "specs",
]);

// Types whose subkind column is constrained to a per-type whitelist.
// Anything else MUST have subkind=NULL or the products_subkind_check fires.
const SUBKIND_BEARING_TYPES = new Set([
  "tv",
  "computer",
  "tablet",
  "network",
  "accessory",
]);

function buildUpdate(item: ClassificationItem): Partial<Product> {
  const update: Record<string, unknown> = {
    needs_classification: !!item.needs_review,
    last_classified_at: new Date().toISOString(),
  };

  if (item.brand) update.brand = item.brand;
  if (item.type) update.type = item.type;
  if (item.subkind !== undefined) update.subkind = item.subkind ?? null;
  if (item.appliance_kind !== undefined) update.appliance_kind = item.appliance_kind ?? null;
  if (item.name_en) update.name_en = item.name_en;
  if (item.description_ar) update.description_ar = item.description_ar;
  if (item.description_he) update.description_he = item.description_he;
  if (item.specs && Object.keys(item.specs).length > 0) {
    update.specs = item.specs;
  }

  // Type-driven cleanup: when type changes, the previous row's appliance_kind
  // / subkind almost always violates the new type's CHECK constraint. Force
  // clear them whenever the suggestion didn't explicitly carry a value for
  // the new type, so we don't propagate stale state into a constraint failure.
  if (typeof update.type === "string") {
    const newType = update.type as Product["type"];
    if (newType !== "appliance" && update.appliance_kind === undefined) {
      update.appliance_kind = null;
    }
    if (!SUBKIND_BEARING_TYPES.has(newType) && update.subkind === undefined) {
      update.subkind = null;
    }
  }

  // Average confidence for fast UI display
  const conf = item.confidence;
  const values = [conf?.brand, conf?.type, conf?.subkind].filter(
    (v): v is number => typeof v === "number",
  );
  if (values.length > 0) {
    update.classification_confidence =
      values.reduce((a, b) => a + b, 0) / values.length;
  }

  // Drop disallowed fields defensively
  for (const k of Object.keys(update)) {
    if (
      !ALLOWED_PRODUCT_FIELDS.has(k) &&
      k !== "needs_classification" &&
      k !== "classification_confidence" &&
      k !== "last_classified_at"
    ) {
      delete update[k];
    }
  }
  return update as Partial<Product>;
}

export async function applyClassifications(
  inputs: ApplyInput[],
): Promise<ApplyResult> {
  const sb = createAdminSupabase();
  const result: ApplyResult = { applied: 0, skipped: 0, errors: [] };

  for (const input of inputs) {
    try {
      const update = buildUpdate(input.classification);

      // Type/subkind/appliance_kind constraint pre-check: if type=appliance,
      // appliance_kind must be set. Skip rather than violate the DB CHECK.
      if (update.type === "appliance" && !update.appliance_kind) {
        result.skipped++;
        result.errors.push({
          id: input.product_id,
          error: "type=appliance requires appliance_kind — Opus did not provide one",
        });
        continue;
      }

      const { error: updateErr } = await sb
        .from("products")
        .update(update)
        .eq("id", input.product_id);

      if (updateErr) {
        result.errors.push({ id: input.product_id, error: updateErr.message });
        result.skipped++;
        continue;
      }

      const { error: historyErr } = await sb.from("classification_history").insert({
        product_id: input.product_id,
        before_data: input.before,
        after_data: update,
        field_confidence: input.classification.confidence ?? {},
        source: input.source,
        reviewed_by: input.reviewed_by ?? null,
      });

      if (historyErr) {
        // History failure is non-fatal — product was updated.
        console.warn("[intelligence] history write failed:", historyErr.message);
      }
      result.applied++;
    } catch (err) {
      result.errors.push({
        id: input.product_id,
        error: err instanceof Error ? err.message : String(err),
      });
      result.skipped++;
    }
  }
  return result;
}

export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const sb = createAdminSupabase();
  const { data, error } = await sb.from("products").select("*").in("id", ids);
  if (error) throw error;
  return (data || []) as Product[];
}
