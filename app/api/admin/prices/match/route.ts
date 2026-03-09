export const runtime = "edge";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import type { Product, ProductVariant } from "@/types/database";

type PdfRow = {
  deviceName: string;
  storage: string;
  priceRaw: number;
  priceWithVat: number;
};

function normalizeForMatch(text: string): string {
  return text
    .replace(/[\u0600-\u06FF\u0590-\u05FF\u05B0-\u05BD\u05C1-\u05C2]/g, "")
    .replace(/[^\w\d\s]/g, " ")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .trim();
}

function tokenize(text: string): string[] {
  return normalizeForMatch(text)
    .split(" ")
    .filter((t) => t.length > 1);
}

function matchScore(pdfTokens: string[], productTokens: string[]): number {
  if (pdfTokens.length === 0) return 0;
  let hits = 0;
  for (const pt of pdfTokens) {
    if (
      productTokens.some(
        (t) => t === pt || t.includes(pt) || pt.includes(t)
      )
    ) {
      hits++;
    }
  }
  return hits / pdfTokens.length;
}

export async function POST(req: NextRequest) {
  try {
    const { rows } = (await req.json()) as { rows: PdfRow[] };
    if (!rows?.length) {
      return NextResponse.json({ error: "No rows provided" }, { status: 400 });
    }

    const db = createAdminSupabase();
    const { data: products } = await db
      .from("products")
      .select("*")
      .eq("type", "device");

    if (!products?.length) {
      return NextResponse.json(
        { error: "No products found in DB" },
        { status: 404 }
      );
    }

    const productCache = (products as Product[]).map((p) => ({
      product: p,
      tokens: tokenize(
        `${p.name_en || ""} ${p.name_he || ""} ${p.brand || ""}`
      ),
    }));

    const results = rows.map((row) => {
      const storagePattern = /\d+\s*(gb|tb)/i;
      const pdfNameClean = row.deviceName.replace(storagePattern, "").trim();
      const pdfTokens = tokenize(pdfNameClean);
      const pdfStorage = row.storage.toUpperCase();

      let best: {
        product: Product;
        variant: ProductVariant;
        score: number;
      } | null = null;

      for (const { product, tokens: productTokens } of productCache) {
        const score = matchScore(pdfTokens, productTokens);
        if (score <= (best?.score || 0.39)) continue;

        const variant = (product.variants || []).find(
          (v) =>
            v.storage?.toUpperCase().replace(/\s/g, "") ===
            pdfStorage.replace(/\s/g, "")
        );

        if (variant && score > (best?.score || 0)) {
          best = { product, variant, score };
        }
      }

      const confidence: "exact" | "fuzzy" | "none" =
        best && best.score >= 0.75
          ? "exact"
          : best && best.score >= 0.4
          ? "fuzzy"
          : "none";

      return {
        pdfDeviceName: row.deviceName,
        pdfStorage: row.storage,
        pdfPriceRaw: row.priceRaw,
        priceWithVat: row.priceWithVat,
        matched: best !== null,
        confidence,
        productId: best?.product.id || null,
        productNameAr: best?.product.name_ar || null,
        productNameHe: best?.product.name_he || null,
        variantStorage: best?.variant.storage || null,
        currentPrice: best?.variant.price ?? null,
        newPrice: row.priceWithVat,
        matchScore: best?.score ?? 0,
      };
    });

    const summary = {
      total: results.length,
      matched: results.filter((r) => r.matched).length,
      exact: results.filter((r) => r.confidence === "exact").length,
      fuzzy: results.filter((r) => r.confidence === "fuzzy").length,
      unmatched: results.filter((r) => !r.matched).length,
    };

    return NextResponse.json({ data: results, summary });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
