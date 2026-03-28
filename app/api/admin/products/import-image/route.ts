export const runtime = 'edge';

// =====================================================
// ClalMobile — Import Images from PaynGo (Magento REST API)
// POST: { query } → { image_url, name }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const PAYNGO_API = "https://www.payngo.co.il/rest/V1/products";
const PAYNGO_MEDIA = "https://www.payngo.co.il/media/catalog/product";

interface PaynGoProduct {
  name: string;
  sku: string;
  image_path: string;
  image_url: string;
}

function extractImage(product: any): string | null {
  const attrs = product.custom_attributes || [];
  const imgAttr = attrs.find((a: any) => a.attribute_code === "image");
  if (imgAttr?.value && imgAttr.value !== "no_selection") {
    return `${PAYNGO_MEDIA}${imgAttr.value}`;
  }
  // Fallback to media_gallery_entries
  const gallery = product.media_gallery_entries || [];
  if (gallery.length > 0 && gallery[0].file) {
    return `${PAYNGO_MEDIA}${gallery[0].file}`;
  }
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { query, color_he } = await req.json() as { query: string; color_he?: string };
    if (!query || query.trim().length < 2) {
      return apiError("أدخل اسم المنتج للبحث", 400);
    }

    // PaynGo names phones as: "סמארטפון Samsung Galaxy S26 Ultra ... צבע שחור"
    // For color search: prefix with סמארטפון and append color in Hebrew
    const searchTerm = color_he
      ? `סמארטפון%${query.trim()}%צבע ${color_he.trim()}%`
      : `%${query.trim()}%`;

    // Search PaynGo Magento API
    const searchUrl = `${PAYNGO_API}?` + new URLSearchParams({
      "searchCriteria[filterGroups][0][filters][0][field]": "name",
      "searchCriteria[filterGroups][0][filters][0][value]": searchTerm,
      "searchCriteria[filterGroups][0][filters][0][conditionType]": "like",
      "searchCriteria[filterGroups][1][filters][0][field]": "visibility",
      "searchCriteria[filterGroups][1][filters][0][value]": "4",
      "searchCriteria[filterGroups][1][filters][0][conditionType]": "eq",
      "searchCriteria[pageSize]": "20",
      "searchCriteria[sortOrders][0][field]": "updated_at",
      "searchCriteria[sortOrders][0][direction]": "DESC",
      "fields": "items[id,name,sku,custom_attributes,media_gallery_entries]",
    }).toString();

    const res = await fetch(searchUrl, {
      headers: { "Accept": "application/json" },
    });

    if (!res.ok) {
      return apiError(`PaynGo API error: ${res.status}`, 502);
    }

    const data = await res.json();
    const items = data.items || [];

    // Extract unique products (deduplicate by image)
    const seen = new Set<string>();
    const results: PaynGoProduct[] = [];

    for (const item of items) {
      const imageUrl = extractImage(item);
      if (!imageUrl || seen.has(imageUrl)) continue;
      seen.add(imageUrl);
      results.push({
        name: item.name,
        sku: item.sku,
        image_path: imageUrl.replace(PAYNGO_MEDIA, ""),
        image_url: imageUrl,
      });
    }

    return apiSuccess({ results, total: results.length });
  } catch (err: unknown) {
    return apiError(errMsg(err, "فشل في البحث"), 500);
  }
}
