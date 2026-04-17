/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeOrder,
  makeOrderItem,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const order = makeOrder({ id: "CLM-1", total: 3499, status: "approved", source: "store" });
const orderItem = makeOrderItem({ order_id: "CLM-1", product_type: "device" });

// ── Supabase mock ─────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  orders: { data: [{ ...order, order_items: [orderItem] }] },
  customers: { data: [{ id: "c1" }] },
  bot_conversations: { data: [{ id: "bc1", channel: "whatsapp", message_count: 10 }] },
  bot_handoffs: { data: [{ id: "h1" }] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    }),
  };
});

// ── Imports ───────────────────────────────────────────
import { GET } from "@/app/api/crm/reports/route";

// ── Tests ─────────────────────────────────────────────

describe("CRM Reports — GET /api/crm/reports", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns daily HTML report", async () => {
    const req = createMockRequest({
      url: "/api/crm/reports",
      searchParams: { type: "daily", date: "2026-04-17" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("2026-04-17");
  });

  it("defaults to daily when no type specified", async () => {
    const req = createMockRequest({ url: "/api/crm/reports" });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/html");
  });

  it("returns weekly HTML report", async () => {
    const req = createMockRequest({
      url: "/api/crm/reports",
      searchParams: { type: "weekly", date: "2026-04-17" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain("<!DOCTYPE html>");
    expect(html).toContain("2026-04-17");
  });

  it("includes order data in daily report", async () => {
    const req = createMockRequest({
      url: "/api/crm/reports",
      searchParams: { type: "daily", date: "2026-04-17" },
    });
    const res = await GET(req);
    const html = await res.text();
    // The report should render statistics
    expect(html).toContain("CLM-1");
  });
});
