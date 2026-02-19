export const runtime = 'edge';

import { NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

// Public settings endpoint — no auth required
// Only exposes safe, display-related settings (logo, store name, etc.)

const PUBLIC_KEYS = ["logo_url", "logo_size", "store_name", "store_phone", "store_address"];

export async function GET() {
  try {
    const s = createAdminSupabase();
    if (!s) {
      return NextResponse.json({ settings: {} });
    }
    const { data } = await s.from("settings").select("key, value").in("key", PUBLIC_KEYS);
    const map: Record<string, string> = {};
    (data || []).forEach((s: any) => { map[s.key] = s.value; });
    return NextResponse.json({ settings: map });
  } catch {
    return NextResponse.json({ settings: {} });
  }
}
