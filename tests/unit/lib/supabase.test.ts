/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ────────────────────────────────────────────────────────────
// Mock @supabase/ssr and @supabase/supabase-js at module-load
// ────────────────────────────────────────────────────────────

const { hoistedBrowserClient, hoistedServerClient } = vi.hoisted(() => ({
  hoistedBrowserClient: vi.fn(),
  hoistedServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createBrowserClient: (...args: any[]) => hoistedBrowserClient(...args),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => hoistedServerClient(...args),
}));

// Import after mocks are in place
import {
  createBrowserSupabase,
  createServerSupabase,
  createAdminSupabase,
  getSupabase,
} from "@/lib/supabase";

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.clearAllMocks();
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon-key-test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "svc-key-test";
  hoistedBrowserClient.mockReturnValue({ type: "browser" });
  hoistedServerClient.mockReturnValue({ type: "server" });
});

afterEach(() => {
  Object.keys(process.env).forEach((k) => {
    if (!(k in originalEnv)) delete process.env[k];
  });
  for (const [k, v] of Object.entries(originalEnv)) {
    (process.env as any)[k] = v;
  }
});

// ================================================================
// createBrowserSupabase
// ================================================================

describe("createBrowserSupabase", () => {
  it("creates a browser client with url + anon key", () => {
    const client = createBrowserSupabase();
    expect(client).toEqual({ type: "browser" });
    expect(hoistedBrowserClient).toHaveBeenCalledWith(
      "https://test.supabase.co",
      "anon-key-test",
    );
  });

  it("returns null when SUPABASE_URL is missing", () => {
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_URL;
    const client = createBrowserSupabase();
    expect(client).toBeNull();
    expect(hoistedBrowserClient).not.toHaveBeenCalled();
  });

  it("returns null when ANON_KEY is missing", () => {
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const client = createBrowserSupabase();
    expect(client).toBeNull();
  });

  it("returns null when the underlying createBrowserClient throws", () => {
    hoistedBrowserClient.mockImplementation(() => {
      throw new Error("no cookie store");
    });
    const client = createBrowserSupabase();
    expect(client).toBeNull();
  });
});

// ================================================================
// createServerSupabase
// ================================================================

describe("createServerSupabase", () => {
  it("creates a server client with autoRefreshToken/persistSession off", () => {
    const client = createServerSupabase();
    expect(client).toEqual({ type: "server" });
    const call = hoistedServerClient.mock.calls[0];
    expect(call[0]).toBe("https://test.supabase.co");
    expect(call[1]).toBe("anon-key-test");
    expect(call[2]).toEqual({
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("returns null when env is incomplete", () => {
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_ANON_KEY;
    expect(createServerSupabase()).toBeNull();
  });
});

// ================================================================
// createAdminSupabase
// ================================================================

describe("createAdminSupabase", () => {
  it("creates an admin client with the service role key", () => {
    const client = createAdminSupabase();
    expect(client).toEqual({ type: "server" });
    const call = hoistedServerClient.mock.calls[0];
    expect(call[0]).toBe("https://test.supabase.co");
    expect(call[1]).toBe("svc-key-test");
    expect(call[2]).toEqual({
      auth: { autoRefreshToken: false, persistSession: false },
    });
  });

  it("returns null when SUPABASE_SERVICE_ROLE_KEY is missing", () => {
    delete (process.env as any).SUPABASE_SERVICE_ROLE_KEY;
    expect(createAdminSupabase()).toBeNull();
  });

  it("returns null when SUPABASE_URL is missing even if service key is set", () => {
    delete (process.env as any).NEXT_PUBLIC_SUPABASE_URL;
    expect(createAdminSupabase()).toBeNull();
  });
});

// ================================================================
// getSupabase — browser singleton
// ================================================================

describe("getSupabase", () => {
  it("throws when invoked outside a browser context", () => {
    const origWindow = (globalThis as any).window;
    delete (globalThis as any).window;
    expect(() => getSupabase()).toThrow(/should only be called in browser/i);
    (globalThis as any).window = origWindow;
  });

  it("returns a browser client when window is present", () => {
    // jsdom environment sets window; make sure the browser client mock fires
    hoistedBrowserClient.mockReturnValue({ type: "browser-singleton" });
    // clear module-level cached singleton by re-importing via fresh context
    // (we can still verify the function returns something)
    const client = getSupabase();
    expect(client).toBeDefined();
  });
});
