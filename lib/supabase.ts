// =====================================================
// ClalMobile — Supabase Client
// Browser client + Server client + Admin client
// Build-safe: returns null when env vars missing (during CF build)
// Lazy env reads: Cloudflare Workers populate process.env per-request
// =====================================================

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

// Read env vars lazily — Cloudflare Workers may not have process.env at module init
function getSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL || '';
}
function getAnonKey() {
  return process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
}
function getServiceKey() {
  return process.env.SUPABASE_SERVICE_ROLE_KEY || '';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyClient = any;

// ===== Browser Client (for React components) =====
export function createBrowserSupabase() {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) return null as AnyClient;
  try {
    return createBrowserClient<Database>(url, anonKey);
  } catch {
    return null as AnyClient;
  }
}

// ===== Server Client (for API routes / Server Components) =====
export function createServerSupabase() {
  const url = getSupabaseUrl();
  const anonKey = getAnonKey();
  if (!url || !anonKey) return null as AnyClient;
  return createClient<Database>(
    url,
    anonKey,
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
  const url = getSupabaseUrl();
  const serviceKey = getServiceKey();
  if (!url || !serviceKey) return null as AnyClient;
  return createClient<Database>(
    url,
    serviceKey,
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
