// =====================================================
// POST /api/admin/intelligence/save-images
//   Body: {
//     product_id: uuid,
//     primary?: { url, color_label?: string },
//     gallery?: Array<{ url }>,
//     colors?: Array<{ index?: number, color_name?: string, url }>,
//     rehost?: boolean (default true — re-upload to R2)
//   }
//   → { saved: { image_url?, gallery_added, colors_updated }, ... }
// Downloads each picked image, optionally re-hosts to R2, then
// updates the product row + writes a classification_history row
// for traceability.
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import { rehostImage, getProductForImageWork } from "@/lib/vision/image-utils";
import type { ProductColor } from "@/types/database";

const inputSchema = z.object({
  product_id: z.string().uuid(),
  primary: z
    .object({
      url: z.string().url(),
      color_label: z.string().optional(),
    })
    .optional(),
  gallery: z.array(z.object({ url: z.string().url() })).max(20).optional(),
  colors: z
    .array(
      z.object({
        index: z.number().int().min(0).optional(),
        color_name: z.string().optional(),
        url: z.string().url(),
      }),
    )
    .max(20)
    .optional(),
  rehost: z.boolean().optional().default(true),
});

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const body = await req.json();
    const parsed = inputSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(
        `Invalid body: ${parsed.error.issues
          .slice(0, 2)
          .map((i) => i.message)
          .join("; ")}`,
        400,
      );
    }
    const input = parsed.data;

    const product = await getProductForImageWork(input.product_id);
    if (!product) return apiError("Product not found", 404);

    const sb = createAdminSupabase();
    const before = {
      image_url: product.image_url,
      gallery: product.gallery || [],
      colors: product.colors || [],
    };

    // Convert each requested URL to a hosted URL (download + R2 upload).
    const finalize = async (url: string): Promise<string> => {
      if (!input.rehost) return url;
      try {
        const r = await rehostImage(url);
        return r.url;
      } catch (err) {
        console.warn("[save-images] rehost failed for", url, err);
        return url; // graceful: keep the original URL if rehost fails
      }
    };

    const update: Partial<typeof before> = {};
    let primaryUrl: string | undefined;
    const galleryAdded: string[] = [];
    const colorsUpdated: { index: number; url: string }[] = [];

    if (input.primary) {
      primaryUrl = await finalize(input.primary.url);
      update.image_url = primaryUrl;
    }

    if (input.gallery && input.gallery.length > 0) {
      const next = [...(product.gallery || [])];
      for (const g of input.gallery) {
        const hosted = await finalize(g.url);
        if (!next.includes(hosted)) {
          next.push(hosted);
          galleryAdded.push(hosted);
        }
      }
      update.gallery = next.slice(0, 20); // cap at 20
    }

    if (input.colors && input.colors.length > 0) {
      const nextColors: ProductColor[] = [...(product.colors || [])];
      for (const c of input.colors) {
        const hosted = await finalize(c.url);
        let idx = c.index;
        if (idx === undefined && c.color_name) {
          const needle = c.color_name.toLowerCase();
          idx = nextColors.findIndex(
            (x) =>
              (x.name_ar || "").toLowerCase().includes(needle) ||
              (x.name_he || "").toLowerCase().includes(needle) ||
              // ProductColor doesn't formally type name_en, but the autofill
              // flow stores it on the JSONB row — match it loosely.
              ((x as { name_en?: string }).name_en || "").toLowerCase().includes(needle),
          );
          if (idx === -1) idx = undefined;
        }
        if (idx !== undefined && idx >= 0 && idx < nextColors.length) {
          nextColors[idx] = { ...nextColors[idx], image: hosted };
          colorsUpdated.push({ index: idx, url: hosted });
        } else {
          // Append a new color row if no match. JSONB tolerates extra keys
          // so we keep name_en alongside the typed fields for cross-tool reuse.
          nextColors.push({
            hex: "#808080",
            name_ar: c.color_name || "",
            name_he: c.color_name || "",
            name_en: c.color_name || "",
            image: hosted,
          } as ProductColor & { name_en?: string });
          colorsUpdated.push({ index: nextColors.length - 1, url: hosted });
        }
      }
      update.colors = nextColors;
    }

    if (Object.keys(update).length === 0) {
      return apiError("Nothing to save", 400);
    }

    const { error } = await sb.from("products").update(update).eq("id", input.product_id);
    if (error) return apiError(error.message, 500);

    // Audit row — track exactly what changed for rollback.
    await sb.from("classification_history").insert({
      product_id: input.product_id,
      before_data: before,
      after_data: update,
      field_confidence: {},
      source: "human",
    });

    await logAction(
      "مدير",
      `صور AI: حفظ ${primaryUrl ? "رئيسية، " : ""}${galleryAdded.length} معرض، ${colorsUpdated.length} ألوان`,
      "product",
      input.product_id,
    );

    return apiSuccess({
      saved: {
        image_url: primaryUrl,
        gallery_added: galleryAdded,
        colors_updated: colorsUpdated,
      },
    });
  } catch (err) {
    console.error("[intelligence.save-images]", err);
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    return apiError(`save-images failed — ${detail}`.slice(0, 600), 500);
  }
}
