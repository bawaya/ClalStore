export const runtime = 'nodejs';

// =====================================================
// ClalMobile — Bulk fetch color images from multiple sources
// POST: { name, brand, colors[] } → { results[] }
// Priority: PaynGo (Hebrew) → GSMArena gallery → skip
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";

const PAYNGO_API = "https://www.payngo.co.il/rest/V1/products";
const PAYNGO_MEDIA = "https://www.payngo.co.il/media/catalog/product";

// Arabic color name → Hebrew for PaynGo search
const AR_TO_HE: Record<string, string> = {
  "أسود": "שחור", "أبيض": "לבן", "أحمر": "אדום", "أزرق": "כחול",
  "أخضر": "ירוק", "وردي": "ורוד", "رمادي": "אפור", "بنفسجي": "סגול",
  "ذهبي": "זהב", "فضي": "כסף", "برتقالي": "כתום", "بيج": "בז'",
  "تيتانيوم": "טיטניום", "كريمي": "קרם", "سماوي": "כחול",
  "تيتانيوم أسود": "שחור טיטניום", "تيتانيوم طبيعي": "טיטניום טבעי",
  "تيتانيوم أبيض": "לבן טיטניום", "تيتانيوم صحراوي": "טיטניום מדברי",
  "تيتانيوم أزرق": "כחול טיטניום",
};

interface ColorInput {
  name_ar?: string;
  name_he?: string;
  has_image?: boolean; // skip if already has image
}

interface ColorResult {
  index: number;
  image_url: string | null;
  source: string; // "payngo" | "gsmarena" | "failed"
  color_name: string;
}

// Extract image URL from PaynGo product
function extractPaynGoImage(product: any): string | null {
  const attrs = product.custom_attributes || [];
  const imgAttr = attrs.find((a: any) => a.attribute_code === "image");
  if (imgAttr?.value && imgAttr.value !== "no_selection") {
    return `${PAYNGO_MEDIA}${imgAttr.value}`;
  }
  const gallery = product.media_gallery_entries || [];
  if (gallery.length > 0 && gallery[0].file) {
    return `${PAYNGO_MEDIA}${gallery[0].file}`;
  }
  return null;
}

// Search PaynGo for a specific color
async function searchPaynGoColor(productName: string, colorHe: string): Promise<string | null> {
  try {
    const searchTerm = `סמארטפון%${productName.trim()}%צבע ${colorHe.trim()}%`;
    const url = `${PAYNGO_API}?` + new URLSearchParams({
      "searchCriteria[filterGroups][0][filters][0][field]": "name",
      "searchCriteria[filterGroups][0][filters][0][value]": searchTerm,
      "searchCriteria[filterGroups][0][filters][0][conditionType]": "like",
      "searchCriteria[pageSize]": "3",
      "fields": "items[name,custom_attributes,media_gallery_entries]",
    });

    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;

    const data = await res.json();
    const items = data.items || [];

    // Find first item with a valid image (prefer smartphone results)
    for (const item of items) {
      const name = (item.name || "").toLowerCase();
      // Skip accessories (כיסוי = case, מגן = protector)
      if (name.includes("כיסוי") || name.includes("מגן מסך") || name.includes("מטען")) continue;
      const img = extractPaynGoImage(item);
      if (img) return img;
    }

    // Fallback: any item with image
    for (const item of items) {
      const img = extractPaynGoImage(item);
      if (img) return img;
    }

    return null;
  } catch {
    return null;
  }
}

// Fetch color images from GSMArena
async function fetchGSMArenaColors(name: string, brand: string): Promise<Map<string, string>> {
  const colorMap = new Map<string, string>(); // english color name → image URL

  try {
    // Dynamic import to avoid issues if module not available
    const { fetchProductData } = await import("@/lib/admin/gsmarena");
    const data = await fetchProductData(name, brand);

    if (data.colors?.length) {
      for (const c of data.colors) {
        if (c.image && c.name_en) {
          colorMap.set(c.name_en.toLowerCase(), c.image);
        }
      }
    }
  } catch {
    // GSMArena failed (CloudFlare, etc.)
  }

  return colorMap;
}

// Arabic color → English color for GSMArena matching
const AR_TO_EN: Record<string, string[]> = {
  "أسود": ["black"], "أبيض": ["white"], "أحمر": ["red"], "أزرق": ["blue"],
  "أخضر": ["green"], "وردي": ["pink", "rose"], "رمادي": ["gray", "grey"],
  "بنفسجي": ["purple", "violet"], "ذهبي": ["gold"], "فضي": ["silver"],
  "برتقالي": ["orange"], "بيج": ["beige"], "سماوي": ["sky blue", "light blue"],
  "تيتانيوم": ["titanium"], "تيتانيوم أسود": ["black titanium", "titanium black"],
  "تيتانيوم طبيعي": ["natural titanium"], "تيتانيوم أبيض": ["white titanium"],
  "تيتانيوم صحراوي": ["desert titanium"], "تيتانيوم أزرق": ["blue titanium"],
  "كريمي": ["cream"],
};

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { name, brand, colors } = await req.json() as {
      name: string;
      brand: string;
      colors: ColorInput[];
    };

    if (!name || !brand || !colors?.length) {
      return NextResponse.json({ error: "بيانات ناقصة" }, { status: 400 });
    }

    const results: ColorResult[] = [];
    const needsFetch = colors.map((c, i) => ({ ...c, index: i })).filter(c => !c.has_image);

    if (needsFetch.length === 0) {
      return NextResponse.json({ results: [], message: "جميع الألوان لديها صور" });
    }

    // === Stage 1: Try PaynGo for each color (most reliable) ===
    const payngoPromises = needsFetch.map(async (c) => {
      const colorHe = c.name_he?.trim() || AR_TO_HE[c.name_ar?.trim() || ""] || "";
      if (!colorHe) return { index: c.index, image: null };
      const image = await searchPaynGoColor(name, colorHe);
      return { index: c.index, image };
    });

    const payngoResults = await Promise.all(payngoPromises);
    const foundByPayngo = new Set<number>();

    for (const r of payngoResults) {
      if (r.image) {
        foundByPayngo.add(r.index);
        results.push({
          index: r.index,
          image_url: r.image,
          source: "payngo",
          color_name: colors[r.index].name_ar || "",
        });
      }
    }

    // === Stage 2: For remaining colors, try GSMArena ===
    const remaining = needsFetch.filter(c => !foundByPayngo.has(c.index));

    if (remaining.length > 0) {
      const gsmaColors = await fetchGSMArenaColors(name, brand);

      if (gsmaColors.size > 0) {
        for (const c of remaining) {
          const colorAr = c.name_ar?.trim() || "";
          const enNames = AR_TO_EN[colorAr] || [];

          // Try matching by English name
          let matched: string | null = null;
          for (const en of enNames) {
            for (const [gsmaName, gsmaUrl] of gsmaColors) {
              if (gsmaName.includes(en) || en.includes(gsmaName)) {
                matched = gsmaUrl;
                break;
              }
            }
            if (matched) break;
          }

          if (matched) {
            results.push({
              index: c.index,
              image_url: matched,
              source: "gsmarena",
              color_name: colorAr,
            });
          } else {
            results.push({
              index: c.index,
              image_url: null,
              source: "failed",
              color_name: colorAr,
            });
          }
        }
      } else {
        // GSMArena completely failed
        for (const c of remaining) {
          results.push({
            index: c.index,
            image_url: null,
            source: "failed",
            color_name: c.name_ar || "",
          });
        }
      }
    }

    const succeeded = results.filter(r => r.image_url).length;
    const failed = results.filter(r => !r.image_url).length;

    return NextResponse.json({
      results,
      summary: { total: results.length, succeeded, failed },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "فشل في الجلب" }, { status: 500 });
  }
}
