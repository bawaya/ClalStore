/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for POST /api/admin/sales-docs/[id]/cancel
 * (manager-initiated cancel + commission soft-delete, phase 10).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const syncedDoc = makeSalesDoc({
  id: 10,
  status: "synced_to_commissions",
  sale_type: "device",
  sale_date: "2026-04-10",
  total_amount: 5000,
});

// ── Hoisted shared state ──────────────────────────────
const hoisted = vi.hoisted(() => ({
  adminUser: {
    id: "u1",
    email: "admin@test.com",
    role: "super_admin",
    appUserId: "app-u1",
    name: "Admin",
  },
  hasPermission: true,
  clientRef: { current: null as any },
  cancelMock: null as any,
  authResult: null as any,
}));

// ── Mocks ─────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn(() =>
      Promise.resolve(hoisted.authResult ?? hoisted.adminUser),
    ),
    hasPermission: vi.fn(() => hoisted.hasPermission),
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@/lib/commissions/register", () => ({
  cancelCommissionsByDoc: vi.fn((...args: any[]) =>
    (hoisted.cancelMock as any)(...args),
  ),
}));

const supabaseClient = createMockSupabaseClient({
  sales_docs: { data: [syncedDoc] },
  sales_doc_events: { data: [] },
});
hoisted.clientRef.current = supabaseClient;

import { POST as cancelDoc } from "@/app/api/admin/sales-docs/[id]/cancel/route";

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

// Rewire sales_docs .maybeSingle() for a two-step (read, cancel-transition) flow
function mockDocReadAndCancel(initial: any, cancelled: any | null, cancelErr: any = null) {
  const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
  docsBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: initial, error: null }) // read
    .mockResolvedValueOnce({ data: cancelled, error: cancelErr }); // transition
}

describe("POST /api/admin/sales-docs/[id]/cancel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hoisted.authResult = null;
    hoisted.hasPermission = true;
    hoisted.cancelMock = vi.fn().mockResolvedValue({
      cancelledIds: [101],
      affectedMonths: ["2026-04"],
    });
  });

  it("happy path: synced doc → cancelled, commissions soft-deleted, audit row added", async () => {
    mockDocReadAndCancel(syncedDoc, { ...syncedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "customer changed mind" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.cancelled_commission_ids).toEqual([101]);
    expect(body.affected_months).toEqual(["2026-04"]);
    expect(hoisted.cancelMock).toHaveBeenCalledWith(supabaseClient, 10);
  });

  it("double-cancel: atomic transition returns null → 409", async () => {
    mockDocReadAndCancel(syncedDoc, null);
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "duplicate cancel attempt" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    expect(res.status).toBe(409);
  });

  it("non-admin: 403", async () => {
    hoisted.hasPermission = false;
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "ok reason" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    expect(res.status).toBe(403);
  });

  it("missing reason: 400", async () => {
    mockDocReadAndCancel(syncedDoc, { ...syncedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: {}, // no reason
    });
    const res = await cancelDoc(req, ctxOf("10"));
    expect(res.status).toBe(400);
  });

  it("reason too short (< 3 chars): 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "x" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    expect(res.status).toBe(400);
  });

  it("month locked (commission cancel rejects with 'locked'): 423 and doc stays", async () => {
    mockDocReadAndCancel(syncedDoc, { ...syncedDoc, status: "cancelled" });
    hoisted.cancelMock = vi
      .fn()
      .mockRejectedValue(new Error("month is locked"));
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "try cancel locked month" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    const body = await res.json();
    expect(res.status).toBe(423);
    expect(body.error).toMatch(/مقفل/);
  });

  it("doc status transition rejected by DB trigger (locked): 423", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: syncedDoc, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "row is locked by month_lock trigger" } });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "attempt locked cancel" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    expect(res.status).toBe(423);
  });

  it("cancel doc with no linked commissions: succeeds gracefully", async () => {
    mockDocReadAndCancel(syncedDoc, { ...syncedDoc, status: "cancelled" });
    hoisted.cancelMock = vi.fn().mockResolvedValue({
      cancelledIds: [],
      affectedMonths: [],
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "no commission row existed" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.cancelled_commission_ids).toEqual([]);
    expect(body.affected_months).toEqual([]);
  });

  it("doc in non-cancellable state (draft): 400", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { ...syncedDoc, status: "draft" }, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/10/cancel",
      body: { reason: "drafts cannot cancel" },
    });
    const res = await cancelDoc(req, ctxOf("10"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing doc", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/999/cancel",
      body: { reason: "not found test" },
    });
    const res = await cancelDoc(req, ctxOf("999"));
    expect(res.status).toBe(404);
  });
});
