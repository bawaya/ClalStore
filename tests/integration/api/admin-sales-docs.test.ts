/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const submittedDoc = makeSalesDoc({ id: 1, status: "submitted" });
const draftDoc = makeSalesDoc({ id: 2, status: "draft" });

// ── Hoisted refs shared with vi.mock factories ────────
const hoisted = vi.hoisted(() => ({
  user: {
    id: "u1",
    email: "admin@test.com",
    role: "super_admin",
    name: "Admin",
    appUserId: "u1",
  },
  clientRef: { current: null as any },
}));

// ── Supabase mock ─────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue(hoisted.user),
    hasPermission: vi.fn().mockReturnValue(true),
    withPermission: vi.fn().mockImplementation(
      (_module: string, _action: string, handler: Function) => {
        return async (req: any, ctx?: any) => handler(req, hoisted.clientRef.current, hoisted.user, ctx);
      }
    ),
    withAdminAuth: vi.fn().mockImplementation((handler: Function) => {
      return async (req: any, ctx?: any) => handler(req, hoisted.clientRef.current, hoisted.user, ctx);
    }),
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/admin/validators", () => ({
  validateBody: vi.fn().mockImplementation((body: any) => ({
    data: body,
    error: null,
  })),
}));

// Initial client
const supabaseClient = createMockSupabaseClient({
  sales_docs: { data: [submittedDoc, draftDoc] },
  sales_doc_events: { data: [] },
});
hoisted.clientRef.current = supabaseClient;

// ── Imports ───────────────────────────────────────────
import { GET } from "@/app/api/admin/sales-docs/route";
import { POST as verifyDoc } from "@/app/api/admin/sales-docs/[id]/verify/route";
import { POST as rejectDoc } from "@/app/api/admin/sales-docs/[id]/reject/route";

// Helper for parameterised routes
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

// ── Tests ─────────────────────────────────────────────

describe("Admin Sales Docs — GET /api/admin/sales-docs", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns sales docs list with total", async () => {
    const req = createMockRequest({ url: "/api/admin/sales-docs" });
    const res = await GET(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.docs).toBeDefined();
  });

  it("filters by status", async () => {
    const req = createMockRequest({
      url: "/api/admin/sales-docs",
      searchParams: { status: "submitted" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("filters by employee_key", async () => {
    const req = createMockRequest({
      url: "/api/admin/sales-docs",
      searchParams: { employee_key: "emp1" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("filters by month", async () => {
    const req = createMockRequest({
      url: "/api/admin/sales-docs",
      searchParams: { month: "2026-04" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });

  it("supports search", async () => {
    const req = createMockRequest({
      url: "/api/admin/sales-docs",
      searchParams: { search: "CLM" },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
  });
});

describe("Admin Sales Docs Verify — POST /api/admin/sales-docs/[id]/verify", () => {
  beforeEach(() => vi.clearAllMocks());

  it("verifies a submitted doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 1, status: "submitted" },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/1/verify",
    });
    const res = await verifyDoc(req, paramsOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 400 for invalid id", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/abc/verify",
    });
    const res = await verifyDoc(req, paramsOf("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/999/verify",
    });
    const res = await verifyDoc(req, paramsOf("999"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-submitted doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 2, status: "draft" },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/2/verify",
    });
    const res = await verifyDoc(req, paramsOf("2"));
    expect(res.status).toBe(400);
  });
});

describe("Admin Sales Docs Reject — POST /api/admin/sales-docs/[id]/reject", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects a submitted doc with reason", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 1, status: "submitted" },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/1/reject",
      body: { reason: "Missing invoice", category: "missing_attachment" },
    });
    const res = await rejectDoc(req, paramsOf("1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 400 for invalid id", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/abc/reject",
      body: { reason: "test" },
    });
    const res = await rejectDoc(req, paramsOf("abc"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for non-existent doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/999/reject",
      body: { reason: "Missing data" },
    });
    const res = await rejectDoc(req, paramsOf("999"));
    expect(res.status).toBe(404);
  });

  it("returns 400 for non-submitted doc", async () => {
    supabaseClient.from("sales_docs").single.mockResolvedValueOnce({
      data: { id: 2, status: "draft" },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/2/reject",
      body: { reason: "Bad data" },
    });
    const res = await rejectDoc(req, paramsOf("2"));
    expect(res.status).toBe(400);
  });
});
