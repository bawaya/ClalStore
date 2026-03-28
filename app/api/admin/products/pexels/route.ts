export const runtime = 'edge';

// =====================================================
// ClalMobile — Search Pexels for phone color images
// POST: { query, color?, per_page? } → { photos[] }
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const PEXELS_API = "https://api.pexels.com/v1/search";
const PEXELS_KEY = process.env.PEXELS_API_KEY || "";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { query, color, per_page } = await req.json() as {
      query: string;
      color?: string;
      per_page?: number;
    };

    if (!query || query.trim().length < 2) {
      return apiError("أدخل كلمة البحث", 400);
    }

    const params: Record<string, string> = {
      query: query.trim(),
      per_page: String(per_page || 12),
      orientation: "portrait",
    };
    if (color) params.color = color;

    const url = `${PEXELS_API}?${new URLSearchParams(params)}`;
    const res = await fetch(url, {
      headers: { Authorization: PEXELS_KEY },
    });

    if (!res.ok) {
      return apiError(`Pexels API error: ${res.status}`, 502);
    }

    const data = await res.json();
    const photos = (data.photos || []).map((p: any) => ({
      id: p.id,
      alt: p.alt || "",
      avg_color: p.avg_color,
      src: p.src?.large || p.src?.medium || p.src?.original,
      thumb: p.src?.medium || p.src?.small,
    }));

    return apiSuccess({ photos, total: data.total_results || 0 });
  } catch (err: unknown) {
    return apiError(errMsg(err, "فشل في البحث"), 500);
  }
}
