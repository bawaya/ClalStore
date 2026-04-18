/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for POST /api/admin/sales-docs/[id]/cancel — spec 3D.
 *
 * Fills gaps not covered in `tests/integration/api/admin-sales-docs-cancel.test.ts`:
 *   - Cancels verified/submitted docs (not just synced_to_commissions)
 *   - Unauthenticated 401
 *   - Already-cancelled doc → 409
 *   - Event + audit log side effects
 *   - cancelCommissionsByDoc invoked with expected args (docId)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const verifiedDoc = makeSalesDoc({
  id: 20,
  status: "verified",
  sale_type: "device",
  sale_date: "2026-04-10",
  total_amount: 5000,
});
const submittedDoc = makeSalesDoc({
  id: 21,
  status: "submitted",
  sale_type: "line",
  sale_date: "2026-04-10",
  total_amount: 200,
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
  auditMock: null as any,
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
    logAudit: vi.fn((...args: any[]) => (hoisted.auditMock as any)(...args)),
  };
});

vi.mock("@/lib/commissions/register", () => ({
  cancelCommissionsByDoc: vi.fn((...args: any[]) =>
    (hoisted.cancelMock as any)(...args),
  ),
}));

const supabaseClient = createMockSupabaseClient({
  sales_docs: { data: [verifiedDoc] },
  sales_doc_events: { data: [] },
});
hoisted.clientRef.current = supabaseClient;

import { POST as cancelDoc } from "@/app/api/admin/sales-docs/[id]/cancel/route";

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

function mockDocReadAndCancel(
  initial: any,
  cancelled: any | null,
  cancelErr: any = null,
) {
  const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
  docsBuilder.maybeSingle = vi
    .fn()
    .mockResolvedValueOnce({ data: initial, error: null })
    .mockResolvedValueOnce({ data: cancelled, error: cancelErr });
}

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.authResult = null;
  hoisted.hasPermission = true;
  hoisted.cancelMock = vi.fn().mockResolvedValue({
    cancelledIds: [101],
    affectedMonths: ["2026-04"],
  });
  hoisted.auditMock = vi.fn().mockResolvedValue(undefined);
});

describe("POST /api/admin/sales-docs/[id]/cancel — additional cases", () => {
  it("cancels a verified doc → 200, status set to cancelled", async () => {
    mockDocReadAndCancel(verifiedDoc, { ...verifiedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Customer returned the device" },
    });
    const res = await cancelDoc(req, ctxOf("20"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.doc?.status).toBe("cancelled");
  });

  it("cancels a submitted doc → 200", async () => {
    mockDocReadAndCancel(submittedDoc, { ...submittedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/21/cancel",
      body: { reason: "Wrong line plan selected" },
    });
    const res = await cancelDoc(req, ctxOf("21"));
    expect(res.status).toBe(200);
  });

  it("invokes cancelCommissionsByDoc with the right doc id (for milestone recalc)", async () => {
    mockDocReadAndCancel(verifiedDoc, { ...verifiedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Valid reason for cancel" },
    });
    await cancelDoc(req, ctxOf("20"));
    expect(hoisted.cancelMock).toHaveBeenCalledWith(supabaseClient, 20);
  });

  it("returns affected_months so caller can recalc milestones per month", async () => {
    mockDocReadAndCancel(verifiedDoc, { ...verifiedDoc, status: "cancelled" });
    hoisted.cancelMock = vi.fn().mockResolvedValue({
      cancelledIds: [77, 78],
      affectedMonths: ["2026-03", "2026-04"],
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Two months to recalc" },
    });
    const res = await cancelDoc(req, ctxOf("20"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.affected_months).toEqual(["2026-03", "2026-04"]);
    expect(body.data?.cancelled_commission_ids).toEqual([77, 78]);
  });

  it("returns 401 when requireAdmin rejects (unauthenticated)", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResult = NextResponse.json({ error: "unauth" }, { status: 401 });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Should not reach" },
    });
    const res = await cancelDoc(req, ctxOf("20"));
    expect(res.status).toBe(401);
  });

  it("returns 400 for already-cancelled doc (status not in cancellable set)", async () => {
    const docsBuilder = supabaseClient.__queryBuilders.get("sales_docs")!;
    docsBuilder.maybeSingle = vi.fn().mockResolvedValueOnce({
      data: { ...verifiedDoc, status: "cancelled" },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "duplicate cancel" },
    });
    const res = await cancelDoc(req, ctxOf("20"));
    // route returns 400 when status isn't in cancellable states
    expect(res.status).toBe(400);
  });

  it("inserts a sales_doc_events row after successful cancel", async () => {
    mockDocReadAndCancel(verifiedDoc, { ...verifiedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Event log check" },
    });
    await cancelDoc(req, ctxOf("20"));
    const eventsBuilder = supabaseClient.__queryBuilders.get("sales_doc_events");
    expect(eventsBuilder?.insert).toHaveBeenCalled();
    const payload = eventsBuilder!.insert.mock.calls.at(-1)?.[0];
    expect(payload?.event_type).toBe("cancelled");
    expect(payload?.sales_doc_id).toBe(20);
    expect(payload?.payload?.reason).toBe("Event log check");
  });

  it("invokes logAudit with module='sales_docs' and action='cancel'", async () => {
    mockDocReadAndCancel(verifiedDoc, { ...verifiedDoc, status: "cancelled" });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Audit row check" },
    });
    await cancelDoc(req, ctxOf("20"));
    expect(hoisted.auditMock).toHaveBeenCalled();
    const auditArgs = hoisted.auditMock.mock.calls.at(-1)?.[1];
    expect(auditArgs?.action).toBe("cancel");
    expect(auditArgs?.module).toBe("sales_docs");
    expect(auditArgs?.entityId).toBe("20");
    expect(auditArgs?.details?.reason).toBe("Audit row check");
  });

  it("400 when reason missing (Zod required)", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: {}, // no reason
    });
    const res = await cancelDoc(req, ctxOf("20"));
    expect(res.status).toBe(400);
  });

  it("400 when reason < 3 chars (Zod min(3))", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "oh" },
    });
    const res = await cancelDoc(req, ctxOf("20"));
    expect(res.status).toBe(400);
  });

  it("non-admin (no commissions:manage) → 403", async () => {
    hoisted.hasPermission = false;
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/sales-docs/20/cancel",
      body: { reason: "Valid reason length" },
    });
    const res = await cancelDoc(req, ctxOf("20"));
    expect(res.status).toBe(403);
  });
});
