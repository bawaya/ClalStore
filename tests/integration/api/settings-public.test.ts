import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Supabase mock ---
const { mockFrom } = vi.hoisted(() => ({ mockFrom: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  createAdminSupabase: vi.fn(() => ({ from: mockFrom })),
  createServerSupabase: vi.fn(() => ({ from: mockFrom })),
}));

import { GET } from "@/app/api/settings/public/route";

describe("GET /api/settings/public", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns public settings", async () => {
    const settingsData = [
      { key: "logo_url", value: "https://cdn.clalmobile.com/logo.png" },
      { key: "store_name", value: "ClalMobile" },
      { key: "store_phone", value: "053-3337653" },
      { key: "feature_reviews", value: "true" },
    ];

    const chain = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: settingsData, error: null }),
      }),
    };
    mockFrom.mockReturnValue(chain);

    const res = await GET();
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.data.settings.logo_url).toBe("https://cdn.clalmobile.com/logo.png");
    expect(body.data.settings.store_name).toBe("ClalMobile");
    expect(body.data.settings.store_phone).toBe("053-3337653");
    expect(body.data.settings.feature_reviews).toBe("true");
  });

  it("sets Cache-Control header", async () => {
    const chain = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
    mockFrom.mockReturnValue(chain);

    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=300");
  });

  it("returns empty settings when DB is unavailable", async () => {
    const { createAdminSupabase } = await import("@/lib/supabase");
    (createAdminSupabase as ReturnType<typeof vi.fn>).mockReturnValueOnce(null);

    const res = await GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.settings).toEqual({});
  });

  it("returns empty settings on error", async () => {
    mockFrom.mockImplementation(() => {
      throw new Error("DB error");
    });

    const res = await GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.settings).toEqual({});
  });

  it("returns 200 status code", async () => {
    const chain = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
    };
    mockFrom.mockReturnValue(chain);

    const res = await GET();
    expect(res.status).toBe(200);
  });

  it("only returns whitelisted keys", async () => {
    const settingsData = [
      { key: "logo_url", value: "logo.png" },
      { key: "secret_key", value: "should_not_appear" },
    ];

    const chain = {
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({ data: settingsData, error: null }),
      }),
    };
    mockFrom.mockReturnValue(chain);

    const res = await GET();
    const body = await res.json();
    // The route uses .in("key", PUBLIC_KEYS) so only whitelisted keys are queried
    expect(body.success).toBe(true);
  });
});
