// =====================================================
// ClalMobile — Supabase Client
// Browser client + Server client + Admin client
// Build-safe: returns null when env vars missing (during CF build)
// =====================================================

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const isMissing = !SUPABASE_URL || !SUPABASE_ANON_KEY;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ===== Browser Client (for React components) =====
export function createBrowserSupabase() {
  if (isMissing) return null as AnyClient;
  try {
    return createBrowserClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY);
  } catch {
    return null as AnyClient;
  }
}

// ===== Server Client (for API routes / Server Components) =====
export function createServerSupabase() {
  if (isMissing) return null as AnyClient;
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
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
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return null as AnyClient;
  return createClient<Database>(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,
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
