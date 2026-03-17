export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import type { ProductVariant } from "@/types/database";
import { requireAdmin } from "@/lib/admin/auth";

type PriceUpdate = {
  productId: string;
  variantStorage: string;
  newPrice: number;
  monthlyPrice?: number;
};

export type ProductCreate = {
  pdfDeviceName: string;
  pdfStorage: string;
  pdfBrand: string;
  newPrice: number;
  monthlyPrice?: number;
};

/** Strip storage suffix (e.g. "256GB", "512GB") to get base device name */
function baseDeviceName(name: string): string {
  return name.replace(/\s*(?:128|256|512|64|32|1)\s*(?:GB|TB)\s*$/i, "").trim() || name;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = (await req.json()) as {
      updates?: PriceUpdate[];
      creates?: ProductCreate[];
    };
    const updates = body.updates ?? [];
    const creates = body.creates ?? [];

    if (!updates.length && !creates.length) {
      return NextResponse.json(
        { error: "No updates or creates provided" },
        { status: 400 }
      );
    }

    const db = createAdminSupabase();
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    // --- Process creates: group by (pdfBrand + base device name) ---
    let createdCount = 0;
    if (creates.length > 0) {
      const byDevice = new Map<string, ProductCreate[]>();
      for (const c of creates) {
        const key = `${(c.pdfBrand || "Other").trim()}|${baseDeviceName(c.pdfDeviceName)}`;
        if (!byDevice.has(key)) byDevice.set(key, []);
        byDevice.get(key)!.push(c);
      }

      for (const [, items] of byDevice) {
        const first = items[0];
        const brand = (first.pdfBrand || "Other").trim();
        const modelName = baseDeviceName(first.pdfDeviceName) || first.pdfDeviceName;

        const storageOptions = [...new Set(items.map((i) => (i.pdfStorage || "").trim()).filter(Boolean))];
        const variants: ProductVariant[] = items.map((c) => ({
          storage: c.pdfStorage || "—",
          price: c.newPrice,
          monthly_price: c.monthlyPrice,
        }));

        const prices = variants.map((v) => v.price).filter((p) => p > 0);
        const minPrice = prices.length ? Math.min(...prices) : 0;

        const { error: insertErr } = await db.from("products").insert({
          type: "device",
          brand,
          name_ar: modelName,
          name_he: modelName,
          price: minPrice,
          cost: 0,
          stock: 0,
          sold: 0,
          colors: [],
          storage_options: storageOptions.length ? storageOptions : ["—"],
          variants,
          specs: {},
          active: true,
          featured: false,
        });

        if (insertErr) {
          failCount += items.length;
          errors.push(`Create ${modelName}: ${insertErr.message}`);
        } else {
          createdCount += 1;
        }
      }

      if (createdCount > 0) {
        try {
          await logAction(
            "مدير",
            `إنشاء منتجات PDF: ${createdCount} منتج جديد`,
            "product",
            "bulk-product-create"
          );
        } catch {}
      }
    }

    // --- Process updates ---
    const byProduct = new Map<string, PriceUpdate[]>();
    for (const u of updates) {
      if (!byProduct.has(u.productId)) byProduct.set(u.productId, []);
      byProduct.get(u.productId)!.push(u);
    }

    for (const [productId, productUpdates] of byProduct) {
      try {
        const { data: product } = await db
          .from("products")
          .select("*")
          .eq("id", productId)
          .single();

        if (!product) {
          failCount += productUpdates.length;
          errors.push(`Product ${productId} not found`);
          continue;
        }

        const variants: ProductVariant[] = [...(product.variants || [])];
        let storageOptions: string[] = [...(product.storage_options || [])];
        let addedNewVariant = false;

        for (const update of productUpdates) {
          const idx = variants.findIndex(
            (v) =>
              v.storage?.toUpperCase().replace(/\s/g, "") ===
              update.variantStorage.toUpperCase().replace(/\s/g, "")
          );

          if (idx >= 0) {
            variants[idx] = {
              ...variants[idx],
              old_price: variants[idx].price,
              price: update.newPrice,
              ...(update.monthlyPrice ? { monthly_price: update.monthlyPrice } : {}),
            };
            successCount++;
          } else {
            variants.push({
              storage: update.variantStorage,
              price: update.newPrice,
              ...(update.monthlyPrice ? { monthly_price: update.monthlyPrice } : {}),
            });
            if (!storageOptions.some((s) => s?.toUpperCase().replace(/\s/g, "") === update.variantStorage.toUpperCase().replace(/\s/g, ""))) {
              storageOptions.push(update.variantStorage);
            }
            addedNewVariant = true;
            successCount++;
          }
        }

        const prices = variants.map((v) => v.price).filter((p) => p > 0);
        const minPrice =
          prices.length > 0 ? Math.min(...prices) : product.price;

        const updatePayload: Record<string, unknown> = {
          variants,
          old_price: product.price,
          price: minPrice,
          updated_at: new Date().toISOString(),
        };
        if (addedNewVariant) {
          updatePayload.storage_options = storageOptions;
        }

        await db
          .from("products")
          .update(updatePayload)
          .eq("id", productId);
      } catch (err: any) {
        failCount += productUpdates.length;
        errors.push(`Error updating ${productId}: ${err.message}`);
      }
    }

    try {
      await logAction(
        "مدير",
        `تحديث أسعار PDF: ${successCount} نجح، ${failCount} فشل`,
        "product",
        "bulk-price-update"
      );
    } catch {}

    return NextResponse.json({
      success: true,
      updated: successCount,
      created: createdCount,
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
