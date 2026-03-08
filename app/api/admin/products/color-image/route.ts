export const runtime = 'edge';

// =====================================================
// ClalMobile — Fetch color-specific image from GSMArena
// POST: { name, brand, color_en } → { image_url }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchProductData } from "@/lib/admin/gsmarena";

export async function POST(req: NextRequest) {
  try {
    const { name, brand, color_en } = await req.json() as {
      name: string;
      brand: string;
      color_en?: string;
    };

    if (!name || !brand) {
      return NextResponse.json({ error: "أدخل اسم المنتج والشركة" }, { status: 400 });
    }

    const data = await fetchProductData(name, brand);

    // If color specified, find matching color image
    if (color_en && data.colors?.length) {
      const target = color_en.toLowerCase().trim();
      const targetWords = target.split(/\s+/).filter(w => w.length > 2);

      // Find best matching color
      let bestMatch: { image: string; score: number } | null = null;

      for (const c of data.colors) {
        if (!c.image) continue;
        const cName = c.name_en.toLowerCase().trim();
        const cWords = cName.split(/\s+/).filter(w => w.length > 2);

        let score = 0;
        // Exact match
        if (cName === target) score = 100;
        // Contains
        else if (cName.includes(target) || target.includes(cName)) score = 80;
        // Word overlap
        else {
          const overlap = targetWords.filter(w => cWords.some(cw => cw.includes(w) || w.includes(cw)));
          if (overlap.length > 0) score = (overlap.length / Math.max(targetWords.length, 1)) * 60;
        }

        if (score > 0 && (!bestMatch || score > bestMatch.score)) {
          bestMatch = { image: c.image, score };
        }
      }

      if (bestMatch) {
        return NextResponse.json({ image_url: bestMatch.image });
      }

      // Return all available color images so frontend can show options
      const available = data.colors
        .filter(c => c.image)
        .map(c => ({ name_en: c.name_en, image_url: c.image! }));

      return NextResponse.json({
        error: "لم يتم العثور على تطابق دقيق للون",
        available,
      });
    }

    // No specific color — return all colors with images
    const colors = data.colors
      .filter(c => c.image)
      .map(c => ({ name_en: c.name_en, image_url: c.image! }));

    return NextResponse.json({ colors, total: colors.length });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل في البحث" }, { status: 500 });
  }
}
