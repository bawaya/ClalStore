// =====================================================
// ClalMobile — Supabase Client
// Browser client + Server client + Admin client
// =====================================================

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// ===== Browser Client (for React components) =====
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

// ===== Server Client (for API routes / Server Components) =====
export function createServerSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// ===== Admin Client (for server-side operations bypassing RLS) =====
export function createAdminSupabase() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

// ===== Singleton browser client =====
let browserClient: ReturnType<typeof createBrowserSupabase> | null = null;

export function getSupabase() {
  if (typeof window === "undefined") {
    throw new Error("getSupabase() should only be called in browser");
  }
  if (!browserClient) {
    browserClient = createBrowserSupabase();
  }
  return browserClient;
}
