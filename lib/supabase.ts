// =====================================================
// ClalMobile — Supabase Client
// Browser client + Server client + Admin client
// =====================================================

import { createBrowserClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

// ===== Browser Client (for React components) =====
export function createBrowserSupabase() {
  return createBrowserClient<Database>(
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  );
}

// ===== Server Client (for API routes / Server Components) =====
export function createServerSupabase() {
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
