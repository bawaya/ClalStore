export const runtime = 'edge';

// =====================================================
// ClalMobile — Admin Product Auto-Fill (MobileAPI / GSMArena / Combined)
// POST: { name, brand, provider? } → specs, colors, images
// "combined" mode: MobileAPI data + GSMArena color images
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { fetchProductData as fetchFromMobileAPI } from "@/lib/admin/mobileapi";
import { fetchProductData as fetchFromGSMArena } from "@/lib/admin/gsmarena";

/**
 * Fuzzy-match two color names (handles "Black Titanium" vs "Titanium Black", etc.)
 */
function colorsMatch(a: string, b: string): boolean {
  const na = a.toLowerCase().trim();
  const nb = b.toLowerCase().trim();
  if (na === nb) return true;

  // Check if one contains the other
  if (na.includes(nb) || nb.includes(na)) return true;

  // Word overlap: if all significant words in A appear in B (or vice versa)
  const wordsA = na.split(/\s+/).filter(w => w.length > 2);
  const wordsB = nb.split(/\s+/).filter(w => w.length > 2);
  if (wordsA.length > 0 && wordsB.length > 0) {
    const aInB = wordsA.every(w => wordsB.some(wb => wb.includes(w) || w.includes(wb)));
    const bInA = wordsB.every(w => wordsA.some(wa => wa.includes(w) || w.includes(wa)));
    if (aInB || bInA) return true;
  }

  return false;
}

/**
 * Combined mode: MobileAPI for specs + GSMArena for color-specific images
 * Falls back to MobileAPI-only if GSMArena scraping fails
 */
async function fetchCombined(name: string, brand: string) {
  // Step 1: Get full data from MobileAPI (fast, reliable)
  const data = await fetchFromMobileAPI(name, brand);

  // Step 2: Try to enrich with GSMArena gallery/color images
  try {
    const gsma = await fetchFromGSMArena(name, brand);

    // ── Merge color images ──
    if (data.colors?.length && gsma.colors?.length) {
      const usedGsmaIndices = new Set<number>();

      // Pass 1: Exact / fuzzy color name match
      for (let i = 0; i < data.colors.length; i++) {
        if (data.colors[i].image) continue; // already has image
        for (let j = 0; j < gsma.colors.length; j++) {
          if (usedGsmaIndices.has(j)) continue;
          if (gsma.colors[j].image && colorsMatch(data.colors[i].name_en, gsma.colors[j].name_en)) {
            data.colors[i].image = gsma.colors[j].image;
            usedGsmaIndices.add(j);
            break;
          }
        }
      }

      // Pass 2: If MobileAPI colors still have no images, try position-based fallback
      // (GSMArena often lists colors in the same order as MobileAPI)
      for (let i = 0; i < data.colors.length; i++) {
        if (data.colors[i].image) continue;
        if (i < gsma.colors.length && gsma.colors[i].image && !usedGsmaIndices.has(i)) {
          data.colors[i].image = gsma.colors[i].image;
          usedGsmaIndices.add(i);
        }
      }

      // Pass 3: Distribute remaining GSMArena color images to unmatched colors
      const remainingGsma = gsma.colors
        .filter((_, j) => !usedGsmaIndices.has(j) && _.image)
        .map(c => c.image!);
      let ri = 0;
      for (let i = 0; i < data.colors.length; i++) {
        if (data.colors[i].image) continue;
        if (ri < remainingGsma.length) {
          data.colors[i].image = remainingGsma[ri++];
        }
      }
    }

    // ── Merge gallery (GSMArena CDN images are often higher quality) ──
    if (gsma.gallery?.length) {
      const combined = [...(data.gallery || []), ...gsma.gallery];
      data.gallery = [...new Set(combined)];
    }

    // ── Use GSMArena main image if MobileAPI didn't have one or if GSMArena has a bigpic ──
    if (gsma.image_url && (!data.image_url || gsma.image_url.includes("gsmarena.com"))) {
      data.image_url = gsma.image_url;
    }

    console.log(`[Combined] MobileAPI data + GSMArena color images merged successfully`);
  } catch (e) {
    // GSMArena failed (CloudFlare block, etc.) — continue with MobileAPI data only
    console.log(`[Combined] GSMArena enrichment failed, using MobileAPI only:`, e);
  }

  return data;
}

export async function POST(req: NextRequest) {
  try {
    const { name, brand, provider } = await req.json();

    if (!name || !brand) {
      return NextResponse.json({ error: "أدخل اسم المنتج والشركة" }, { status: 400 });
    }

    let data;
    if (provider === "combined") {
      data = await fetchCombined(name, brand);
    } else if (provider === "gsmarena") {
      data = await fetchFromGSMArena(name, brand);
    } else {
      data = await fetchFromMobileAPI(name, brand);
    }

    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل في جلب البيانات" }, { status: 500 });
  }
}
