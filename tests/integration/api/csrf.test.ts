import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/csrf", () => ({
  generateCsrfToken: vi.fn(() => "mock-csrf-token-abc123"),
  setCsrfCookie: vi.fn(),
}));

import { GET } from "@/app/api/csrf/route";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";

describe("GET /api/csrf", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a CSRF token", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.token).toBe("mock-csrf-token-abc123");
  });

  it("calls generateCsrfToken", async () => {
    await GET();
    expect(generateCsrfToken).toHaveBeenCalledOnce();
  });

  it("calls setCsrfCookie with the response and token", async () => {
    await GET();
    expect(setCsrfCookie).toHaveBeenCalledOnce();
    const [response, token] = (setCsrfCookie as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(token).toBe("mock-csrf-token-abc123");
    expect(response).toBeDefined();
  });

  it("returns 200 status", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
  });
});
