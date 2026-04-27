import { unstable_cache } from "next/cache";
import { createAdminSupabase } from "@/lib/supabase";

const PUBLIC_KEYS = [
  "logo_url", "logo_size", "store_name", "store_phone", "store_address",
  "ga_measurement_id", "meta_pixel_id", "feature_reviews",
] as const;

export type PublicSettings = Record<string, string>;

export const getCachedPublicSettings = unstable_cache(
  async (): Promise<PublicSettings> => {
    const s = createAdminSupabase();
    if (!s) return {};
    const { data } = await s.from("settings").select("key, value").in("key", PUBLIC_KEYS);
    const map: PublicSettings = {};
    (data || []).forEach((row: { key: string; value: string }) => {
      map[row.key] = row.value;
    });
    return map;
  },
  ["public-settings"],
  { tags: ["public-settings"], revalidate: 300 },
);
