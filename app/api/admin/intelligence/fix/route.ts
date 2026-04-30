// =====================================================
// POST /api/admin/intelligence/fix
//   Unified fix endpoint for the Health-tab buttons.
//   Each action wraps the right combination of generate/classify/store calls
//   so the client only makes one round trip per fix.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import { generateContent } from "@/lib/intelligence/generator";
import { classifyProducts } from "@/lib/intelligence/classifier";
import { applyClassifications, getProductsByIds } from "@/lib/intelligence/store";
import type { Product } from "@/types/database";

const uuid = z.string().uuid();

const inputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("delete_duplicates"),
    keep_id: uuid,
    remove_ids: z.array(uuid).min(1).max(20),
  }),
  z.object({
    action: z.literal("generate_descriptions"),
    product_id: uuid,
  }),
  z.object({
    action: z.literal("save_generated"),
    product_id: uuid,
    name_en: z.string().min(1).max(200).optional(),
    description_ar: z.string().max(2000).optional(),
    description_he: z.string().max(2000).optional(),
  }),
  z.object({
    action: z.literal("lookup"),
    product_id: uuid,
  }),
  z.object({
    action: z.literal("apply_brand"),
    product_ids: z.array(uuid).min(1).max(50),
    brand: z.string().min(1).max(100),
  }),
  z.object({
    action: z.literal("apply_subkind"),
    product_id: uuid,
    subkind: z.string().min(1).max(40),
  }),
  z.object({
    action: z.literal("apply_type"),
    product_id: uuid,
    type: z.enum(["device", "accessory", "appliance", "tv", "computer", "tablet", "network"]),
    appliance_kind: z.string().min(1).max(40).optional(),
  }),
  z.object({
    action: z.literal("rollback"),
    product_id: uuid,
  }),
  z.object({
    action: z.literal("reclassify"),
    product_id: uuid,
  }),
]);

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        `Invalid body: ${parsed.error.issues.slice(0, 2).map((i) => i.message).join("; ")}`,
        400,
      );
    }

    const sb = createAdminSupabase();
    const input = parsed.data;

    if (input.action === "delete_duplicates") {
      // Defensive: never delete the keeper.
      const targets = input.remove_ids.filter((id) => id !== input.keep_id);
      if (targets.length === 0) return apiError("Nothing to delete", 400);

      const { error } = await sb.from("products").delete().in("id", targets);
      if (error) return apiError(error.message, 500);

      await logAction(
        "مدير",
        `إصلاح ذكاء: حذف ${targets.length} نسخة مكررة (الإبقاء على ${input.keep_id})`,
        "product",
        input.keep_id,
      );
      return apiSuccess({ deleted: targets.length });
    }

    if (input.action === "lookup") {
      const [product] = await getProductsByIds([input.product_id]);
      if (!product) return apiError("Product not found", 404);
      return apiSuccess({
        id: product.id,
        name_ar: product.name_ar,
        name_he: product.name_he,
        name_en: product.name_en,
        brand: product.brand,
        type: product.type,
        subkind: product.subkind,
        appliance_kind: product.appliance_kind,
      });
    }

    if (input.action === "save_generated") {
      const update: Record<string, string> = {};
      if (input.name_en) update.name_en = input.name_en;
      if (input.description_ar) update.description_ar = input.description_ar;
      if (input.description_he) update.description_he = input.description_he;
      if (Object.keys(update).length === 0) {
        return apiError("Nothing to save", 400);
      }
      const { error } = await sb
        .from("products")
        .update(update)
        .eq("id", input.product_id);
      if (error) return apiError(error.message, 500);

      await logAction(
        "مدير",
        `إصلاح ذكاء: حفظ محتوى مولّد (${Object.keys(update).join(", ")})`,
        "product",
        input.product_id,
      );
      return apiSuccess({ saved: Object.keys(update) });
    }

    if (input.action === "generate_descriptions") {
      const [product] = await getProductsByIds([input.product_id]);
      if (!product) return apiError("Product not found", 404);

      const output = await generateContent({
        current_name_ar: product.name_ar,
        current_name_he: product.name_he,
        current_name_en: product.name_en,
        current_description_ar: product.description_ar,
        current_description_he: product.description_he,
        brand: product.brand,
        type: product.type,
        specs: product.specs as Record<string, string> | undefined,
      });

      const update = {
        name_en: output.name_en,
        description_ar: output.description_ar,
        description_he: output.description_he,
      };
      const { error } = await sb
        .from("products")
        .update(update)
        .eq("id", input.product_id);
      if (error) return apiError(error.message, 500);

      await sb.from("classification_history").insert({
        product_id: input.product_id,
        before_data: {
          name_en: product.name_en,
          description_ar: product.description_ar,
          description_he: product.description_he,
        },
        after_data: update,
        field_confidence: {},
        source: "opus_assisted",
      });

      await logAction(
        "مدير",
        `إصلاح ذكاء: توليد أوصاف لـ ${product.name_ar}`,
        "product",
        input.product_id,
      );
      return apiSuccess({ name_en: output.name_en });
    }

    if (input.action === "apply_brand") {
      // Snapshot brand-before for each row so we can roll back per-product later.
      const before = await getProductsByIds(input.product_ids);
      const brandBefore = new Map(before.map((p) => [p.id, p.brand]));

      const { error } = await sb
        .from("products")
        .update({ brand: input.brand })
        .in("id", input.product_ids);
      if (error) return apiError(error.message, 500);

      // Append a history row per product so rollback can restore the prior brand.
      const historyRows = input.product_ids.map((pid) => ({
        product_id: pid,
        before_data: { brand: brandBefore.get(pid) ?? null },
        after_data: { brand: input.brand },
        field_confidence: { brand: 1 },
        source: "human" as const,
      }));
      await sb.from("classification_history").insert(historyRows);

      await logAction(
        "مدير",
        `إصلاح ذكاء: توحيد البراند إلى "${input.brand}" على ${input.product_ids.length} منتج`,
        "product",
        input.product_ids[0],
      );
      return apiSuccess({ updated: input.product_ids.length });
    }

    if (input.action === "apply_subkind") {
      const [product] = await getProductsByIds([input.product_id]);
      if (!product) return apiError("Product not found", 404);

      const { error } = await sb
        .from("products")
        .update({ subkind: input.subkind })
        .eq("id", input.product_id);
      if (error) return apiError(error.message, 500);

      await sb.from("classification_history").insert({
        product_id: input.product_id,
        before_data: { subkind: product.subkind ?? null },
        after_data: { subkind: input.subkind },
        field_confidence: { subkind: 1 },
        source: "human",
      });

      await logAction(
        "مدير",
        `إصلاح ذكاء: تعيين subkind=${input.subkind}`,
        "product",
        input.product_id,
      );
      return apiSuccess({ subkind: input.subkind });
    }

    if (input.action === "apply_type") {
      const [product] = await getProductsByIds([input.product_id]);
      if (!product) return apiError("Product not found", 404);

      // Fast path: simple type swap (device/accessory/tv/computer/tablet/network).
      // No need to spend an Opus call — issue a direct UPDATE that also clears
      // the dependent constraint columns (appliance_kind, subkind) that the
      // previous type may have populated.
      if (input.type !== "appliance") {
        const update: Record<string, unknown> = {
          type: input.type,
          appliance_kind: null,
          subkind: null,
          last_classified_at: new Date().toISOString(),
        };
        const { error } = await sb
          .from("products")
          .update(update)
          .eq("id", input.product_id);
        if (error) return apiError(error.message, 500);

        await sb.from("classification_history").insert({
          product_id: input.product_id,
          before_data: product,
          after_data: update,
          field_confidence: { type: 1 },
          source: "human",
        });

        await logAction(
          "مدير",
          `إصلاح ذكاء: تغيير النوع إلى ${input.type}`,
          "product",
          input.product_id,
        );
        return apiSuccess({ applied: 1, type: input.type });
      }

      // appliance: requires appliance_kind. If caller didn't provide one,
      // ask Opus to suggest one — but make the failure mode actionable.
      let kind = input.appliance_kind;
      if (!kind) {
        const [suggestion] = await classifyProducts([
          {
            id: product.id,
            name: product.name_ar || product.name_he,
            current_type: "appliance",
          },
        ]);
        kind = suggestion?.appliance_kind || undefined;
      }
      if (!kind) {
        return apiError(
          "type=appliance requires appliance_kind — pick one manually",
          400,
        );
      }

      const update: Record<string, unknown> = {
        type: "appliance",
        appliance_kind: kind,
        subkind: null,
        last_classified_at: new Date().toISOString(),
      };
      const { error } = await sb
        .from("products")
        .update(update)
        .eq("id", input.product_id);
      if (error) return apiError(error.message, 500);

      await sb.from("classification_history").insert({
        product_id: input.product_id,
        before_data: product,
        after_data: update,
        field_confidence: { type: 1 },
        source: input.appliance_kind ? "human" : "opus_assisted",
      });

      await logAction(
        "مدير",
        `إصلاح ذكاء: تغيير النوع إلى appliance (${kind})`,
        "product",
        input.product_id,
      );
      return apiSuccess({ applied: 1, type: "appliance", appliance_kind: kind });
    }

    if (input.action === "rollback") {
      // Restore product to the state captured in the most-recent
      // classification_history row.
      const { data: history, error: histErr } = await sb
        .from("classification_history")
        .select("id,before_data,after_data")
        .eq("product_id", input.product_id)
        .order("applied_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (histErr) return apiError(histErr.message, 500);
      if (!history) return apiError("No history to rollback", 404);

      const before = (history as { before_data: Record<string, unknown> }).before_data || {};
      // Only push back fields we know are safe to write.
      const allowed = [
        "brand",
        "type",
        "subkind",
        "appliance_kind",
        "name_en",
        "description_ar",
        "description_he",
        "specs",
        "needs_classification",
      ];
      const restore: Record<string, unknown> = {};
      for (const k of allowed) {
        if (k in before) restore[k] = (before as Record<string, unknown>)[k];
      }
      if (Object.keys(restore).length === 0) {
        return apiError("History snapshot is empty", 400);
      }

      const { error: updErr } = await sb
        .from("products")
        .update(restore)
        .eq("id", input.product_id);
      if (updErr) return apiError(updErr.message, 500);

      await sb.from("classification_history").insert({
        product_id: input.product_id,
        before_data: (history as { after_data: Record<string, unknown> }).after_data || {},
        after_data: restore,
        field_confidence: {},
        source: "rollback",
      });

      await logAction(
        "مدير",
        `إصلاح ذكاء: تراجع آخر تصنيف`,
        "product",
        input.product_id,
      );
      return apiSuccess({ rolled_back: true, restored_fields: Object.keys(restore) });
    }

    if (input.action === "reclassify") {
      const [product] = await getProductsByIds([input.product_id]);
      if (!product) return apiError("Product not found", 404);

      const [suggestion] = await classifyProducts([
        {
          id: product.id,
          name: product.name_ar || product.name_he || product.name_en || "",
          current_brand: product.brand,
          current_type: product.type,
          current_subkind: product.subkind,
          current_appliance_kind: product.appliance_kind,
          price: product.price ? Number(product.price) : undefined,
          description_hint: product.description_ar || product.description_he,
          specs: product.specs as Record<string, string | number> | undefined,
        },
      ]);
      if (!suggestion) return apiError("Opus produced no suggestion", 500);

      const result = await applyClassifications([
        {
          product_id: product.id,
          before: product,
          classification: suggestion,
          source: "opus_assisted",
        },
      ]);
      if (result.applied === 0) {
        return apiError(
          result.errors[0]?.error || "Apply failed",
          500,
        );
      }

      await logAction(
        "مدير",
        `إصلاح ذكاء: إعادة تصنيف ${product.name_ar}`,
        "product",
        input.product_id,
      );
      return apiSuccess({ applied: 1, suggestion });
    }

    return apiError("Unknown action", 400);
  } catch (err) {
    console.error("[intelligence.fix]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`fix failed — ${detail}`.slice(0, 600), 500);
  }
}
