export const runtime = 'edge';

import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess } from "@/lib/api-response";

// Public settings endpoint — no auth required
// Only exposes safe, display-related settings (logo, store name, etc.)

const PUBLIC_KEYS = [
  "logo_url", "logo_size", "store_name", "store_phone", "store_address",
  "ga_measurement_id", "meta_pixel_id", "feature_reviews",
];

export async function GET() {
  try {
    const s = createAdminSupabase();
    if (!s) {
      return apiSuccess({ settings: {} });
    }
    const { data } = await s.from("settings").select("key, value").in("key", PUBLIC_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((s: any) => { map[s.key] = s.value; });
    return apiSuccess({ settings: map });
  } catch {
    return apiSuccess({ settings: {} });
  }
}
