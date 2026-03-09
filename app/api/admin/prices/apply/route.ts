export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { logAction } from "@/lib/admin/queries";
import type { ProductVariant } from "@/types/database";

type PriceUpdate = {
  productId: string;
  variantStorage: string;
  newPrice: number;
  monthlyPrice?: number;
};

export async function POST(req: NextRequest) {
  try {
    const { updates } = (await req.json()) as { updates: PriceUpdate[] };
    if (!updates?.length) {
      return NextResponse.json(
        { error: "No updates provided" },
        { status: 400 }
      );
    }

    const db = createAdminSupabase();
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

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
            failCount++;
            errors.push(
              `Variant ${update.variantStorage} not found in ${product.name_ar}`
            );
          }
        }

        const prices = variants.map((v) => v.price).filter((p) => p > 0);
        const minPrice =
          prices.length > 0 ? Math.min(...prices) : product.price;

        await db
          .from("products")
          .update({
            variants,
            old_price: product.price,
            price: minPrice,
            updated_at: new Date().toISOString(),
          })
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
      failed: failCount,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
