
/**
 * مطابقة مباشرة بدون AI — لملفات Excel/CSV
 * يستخرج البيانات من الجدول ويطابق محلياً (ضريبة 18% تُحسب هنا)
 */
import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import type { Product } from "@/types/database";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

type StructuredRow = {
  brand: string;
  model: string;
  storage?: string;
  price: number;
  monthlyPrice: number;
};

function inferBrand(s: string): string {
  const n = (s || "").toLowerCase();
  if (/iphone|ipad|mac|apple/i.test(n)) return "Apple";
  if (/galaxy|z flip|z fold|samsung|a\d|s\d/i.test(n)) return "Samsung";
  if (/xiaomi|redmi|poco/i.test(n)) return "Xiaomi";
  if (/google|pixel/i.test(n)) return "Google";
  if (/oppo|realme|oneplus/i.test(n)) return "Oppo";
  if (/honor|huawei/i.test(n)) return "Honor";
  if (/motorola|moto/i.test(n)) return "Motorola";
  if (/nokia/i.test(n)) return "Nokia";
  if (/sony|xperia/i.test(n)) return "Sony";
  return "Other";
}

function extractStorage(model: string): { baseModel: string; storage: string } {
  const m = (model || "").trim();
  const storageMatch = m.match(/\s+(\d+)\s*(GB|TB)\s*$/i);
  if (storageMatch) {
    return {
      baseModel: m.replace(/\s+\d+\s*(GB|TB)\s*$/i, "").trim(),
      storage: storageMatch[1] + storageMatch[2].toUpperCase(),
    };
  }
  return { baseModel: m, storage: "" };
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const rows = (body.rows as StructuredRow[]) || [];
    if (!rows.length) {
      return apiError("No rows provided", 400);
    }

    const supabase = createAdminSupabase();
    const { data: products, error: dbErr } = await supabase
      .from("products")
      .select("*")
      .eq("type", "device");
    if (dbErr || !products?.length) {
      return apiError("No products in DB", 500);
    }

    const productList = products as Product[];
    const productMap = new Map(productList.map((p) => [p.id, p]));

    const norm = (s: string) => (s || "").toUpperCase().replace(/\s/g, "");
    const toCompare = (s: string) =>
      (s || "")
        .toLowerCase()
        .replace(/آيفون|ايفون/g, "iphone")
        .replace(/جالكسي|جالاكسي/g, "galaxy")
        .replace(/^(samsung\s+)?galaxy\s+/i, "")
        .replace(/\s*5g\s*/gi, " ")
        .replace(/\s+/g, " ");

    const results = rows
      .filter((r) => r.price > 0)
      .map((row) => {
        const brand = (row.brand || inferBrand(row.model || "")).trim() || inferBrand(row.model || "");
        const { baseModel, storage } = extractStorage(row.model || "");
        const priceWithVat = Math.round(row.price * 1.18);
        const monthlyPrice = Math.round((row.monthlyPrice || 0) * 1.18);

        let productId: string | null = null;
        let variantStorage: string | null = null;
        const rowCompare = toCompare(baseModel);
        const rowStorage = norm(storage || row.storage || "");

        for (const p of productList) {
          const pBrand = (p.brand || "").toLowerCase();
          if (pBrand !== brand.toLowerCase()) continue;

          const pCompare = toCompare(p.name_en || p.name_ar || "");
          const modelMatch =
            pCompare.includes(rowCompare) ||
            rowCompare.includes(pCompare) ||
            norm(pCompare) === norm(rowCompare);

          if (!modelMatch) continue;

          const storages = [
            ...new Set([
              ...(p.storage_options || []),
              ...(p.variants || []).map((v: any) => v.storage).filter(Boolean),
            ]),
          ];
          for (const st of storages) {
            if (!st) continue;
            if (norm(st) === rowStorage || norm(String(st)) === rowStorage) {
              productId = p.id;
              variantStorage = st;
              break;
            }
          }
          if (productId) break;
        }

        const product = productId ? productMap.get(productId) : null;
        const variant = product?.variants?.find(
          (v) =>
            v.storage?.toUpperCase().replace(/\s/g, "") ===
            (variantStorage || "").toUpperCase().replace(/\s/g, "")
        );

        return {
          pdfDeviceName: baseModel + (storage ? ` ${storage}` : ""),
          pdfStorage: storage || row.storage || "",
          pdfBrand: brand,
          pdfPriceRaw: row.price,
          priceWithVat,
          monthlyPrice,
          matched: !!variant,
          confidence: variant ? "exact" : "none",
          productId: product?.id || null,
          productNameAr: product?.name_ar || null,
          productNameHe: product?.name_he || null,
          variantStorage: variant?.storage || null,
          currentPrice: variant?.price ?? null,
          currentMonthly: variant?.monthly_price ?? null,
          newPrice: priceWithVat,
          matchScore: variant ? 1 : 0,
        };
      });

    const summary = {
      total: results.length,
      matched: results.filter((r) => r.matched).length,
      exact: results.filter((r) => r.confidence === "exact").length,
      fuzzy: 0,
      unmatched: results.filter((r) => !r.matched).length,
    };

    return apiSuccess({
      rows: results,
      summary,
      provider: "direct",
    });
  } catch (err: unknown) {
    return apiError(errMsg(err, String(err)));
  }
}
