/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for admin announcements + admin corrections — spec 3F.
 *
 * Complements `tests/integration/api/employee-pwa.test.ts` which covers
 * basic admin announcement POST and correction PUT paths. This file adds
 * gaps: admin announcement GET (readCount, ordering), admin corrections
 * GET (filtering + employee name enrichment), and extra PUT cases.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
} from "@/tests/helpers";

// ── Hoisted state ──────────────────────────────────────
const hoisted = vi.hoisted(() => ({
  adminAuth: {
    id: "auth-adm1",
    email: "admin@clal.test",
    role: "super_admin",
    appUserId: "adm1",
    name: "Admin",
  },
  hasPermission: true,
  clientRef: { current: null as any },
  adminAuthResponse: null as any,
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
      Promise.resolve(hoisted.adminAuthResponse ?? hoisted.adminAuth),
    ),
    hasPermission: vi.fn(() => hoisted.hasPermission),
    logAudit: vi.fn((...args: any[]) => (hoisted.auditMock as any)(...args)),
  };
});

function makeClient(tables: Record<string, { data?: any; error?: any }> = {}) {
  return createMockSupabaseClient(tables);
}

import {
  GET as getAnnouncements,
  POST as createAnnouncement,
} from "@/app/api/admin/announcements/route";
import { GET as getCorrections } from "@/app/api/admin/corrections/route";
import { PUT as respondCorrection } from "@/app/api/admin/corrections/[id]/route";

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.adminAuthResponse = null;
  hoisted.hasPermission = true;
  hoisted.auditMock = vi.fn().mockResolvedValue(undefined);
});

// ════════════════════════════════════════════════════════
// POST /api/admin/announcements — extra coverage
// ════════════════════════════════════════════════════════
describe("POST /api/admin/announcements — extra coverage", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      admin_announcements: { data: [] },
    });
  });

  it("requires admin auth — 401 when unauthenticated", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.adminAuthResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { title: "t", body: "b" },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(401);
  });

  it("requires settings:manage permission — 403 otherwise", async () => {
    hoisted.hasPermission = false;
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { title: "t", body: "b" },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(403);
  });

  it("missing body (required) → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { title: "Only title" },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(400);
  });

  it("priority defaults to 'normal' when omitted", async () => {
    const client = hoisted.clientRef.current;
    client.__queryBuilders.get("admin_announcements")!.single = vi
      .fn()
      .mockResolvedValue({
        data: {
          id: 1,
          title: "T",
          body: "B",
          priority: "normal",
          target: "all",
          created_by: "adm1",
          expires_at: null,
          created_at: "2026-04-18T00:00:00Z",
        },
        error: null,
      });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { title: "Test", body: "Body" },
    });
    const res = await createAnnouncement(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    // The insert payload's priority is 'normal'
    const insertMock = client.__queryBuilders.get("admin_announcements")!.insert;
    expect(insertMock.mock.calls[0]?.[0]?.priority).toBe("normal");
    expect(body.data.announcement.priority).toBe("normal");
  });

  it("target defaults to 'all' when omitted", async () => {
    const client = hoisted.clientRef.current;
    client.__queryBuilders.get("admin_announcements")!.single = vi
      .fn()
      .mockResolvedValue({
        data: {
          id: 1,
          title: "T",
          body: "B",
          priority: "normal",
          target: "all",
          created_by: "adm1",
          expires_at: null,
          created_at: "2026-04-18T00:00:00Z",
        },
        error: null,
      });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { title: "Test", body: "Body" },
    });
    await createAnnouncement(req);
    const insertMock = client.__queryBuilders.get("admin_announcements")!.insert;
    expect(insertMock.mock.calls[0]?.[0]?.target).toBe("all");
  });

  it("accepts optional expiresAt (ISO datetime) and forwards it to insert", async () => {
    const client = hoisted.clientRef.current;
    client.__queryBuilders.get("admin_announcements")!.single = vi
      .fn()
      .mockResolvedValue({
        data: {
          id: 1,
          title: "T",
          body: "B",
          priority: "normal",
          target: "all",
          created_by: "adm1",
          expires_at: "2026-05-01T00:00:00.000Z",
          created_at: "2026-04-18T00:00:00Z",
        },
        error: null,
      });
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: {
        title: "Test",
        body: "Body",
        expiresAt: "2026-05-01T00:00:00.000Z",
      },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(201);
    const insertMock = client.__queryBuilders.get("admin_announcements")!.insert;
    expect(insertMock.mock.calls[0]?.[0]?.expires_at).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });

  it("rejects title shorter than 2 chars (Zod min(2)) → 400", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/admin/announcements",
      body: { title: "a", body: "ok" },
    });
    const res = await createAnnouncement(req);
    expect(res.status).toBe(400);
  });
});

// ════════════════════════════════════════════════════════
// GET /api/admin/announcements
// ════════════════════════════════════════════════════════
const ann = (o: Record<string, any> = {}) => ({
  id: 1,
  title: "T",
  body: "b",
  priority: "normal",
  target: "all",
  created_by: "adm1",
  expires_at: null,
  created_at: "2026-04-10T00:00:00Z",
  ...o,
});

describe("GET /api/admin/announcements", () => {
  it("returns all announcements with readCount per row", async () => {
    const client = makeClient({
      admin_announcements: {
        data: [ann({ id: 1, priority: "high" }), ann({ id: 2, target: "employees", created_at: "2026-04-09T00:00:00Z" })],
      },
      admin_announcement_reads: {
        data: [{ announcement_id: 1 }, { announcement_id: 1 }, { announcement_id: 2 }],
      },
      users: { data: [] },
    });
    // head+count for users
    client.__queryBuilders.get("users")!.__setData([]);
    client.__queryBuilders.get("users")!.neq = vi.fn().mockImplementation(function (this: any) {
      return this;
    });
    (client.__queryBuilders.get("users") as any).then = (resolve: any) =>
      resolve({ data: [], error: null, count: 10 });

    hoisted.clientRef.current = client;

    const req = createMockRequest({ url: "/api/admin/announcements" });
    const res = await getAnnouncements(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.announcements).toHaveLength(2);
    const byId = Object.fromEntries(
      body.data.announcements.map((a: any) => [a.id, a]),
    );
    expect(byId[1].readCount).toBe(2);
    expect(byId[2].readCount).toBe(1);
  });

  it("rows are ordered by created_at desc (matches query)", async () => {
    const client = makeClient({
      admin_announcements: {
        data: [ann({ id: 1, created_at: "2026-04-18T00:00:00Z" }), ann({ id: 2, created_at: "2026-04-01T00:00:00Z" })],
      },
      admin_announcement_reads: { data: [] },
      users: { data: [] },
    });
    hoisted.clientRef.current = client;
    const req = createMockRequest({ url: "/api/admin/announcements" });
    await getAnnouncements(req);
    const annBuilder = client.__queryBuilders.get("admin_announcements")!;
    expect(annBuilder.order).toHaveBeenCalledWith(
      "created_at",
      expect.objectContaining({ ascending: false }),
    );
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.adminAuthResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient();
    const req = createMockRequest({ url: "/api/admin/announcements" });
    const res = await getAnnouncements(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// GET /api/admin/corrections
// ════════════════════════════════════════════════════════
const corr = (o: Record<string, any> = {}) => ({
  id: 1,
  employee_id: "emp1",
  request_type: "other",
  description: "x",
  status: "pending",
  admin_response: null,
  resolved_by: null,
  resolved_at: null,
  commission_sale_id: null,
  sales_doc_id: null,
  created_at: "2026-04-10T00:00:00Z",
  ...o,
});

describe("GET /api/admin/corrections", () => {
  it("returns all requests with employeeName enrichment", async () => {
    const client = makeClient({
      commission_correction_requests: {
        data: [
          corr({ id: 1, employee_id: "emp1", request_type: "amount_error" }),
          corr({ id: 2, employee_id: "emp2", status: "approved", admin_response: "ok" }),
        ],
      },
      users: {
        data: [
          { id: "emp1", name: "Ahmad" },
          { id: "emp2", name: "Noor" },
        ],
      },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({ url: "/api/admin/corrections" });
    const res = await getCorrections(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.requests).toHaveLength(2);
    const byId = Object.fromEntries(
      body.data.requests.map((r: any) => [r.id, r]),
    );
    expect(byId[1].employeeName).toBe("Ahmad");
    expect(byId[2].employeeName).toBe("Noor");
  });

  it("filters by ?status=pending when provided", async () => {
    const client = makeClient({
      commission_correction_requests: { data: [corr()] },
      users: { data: [{ id: "emp1", name: "Ahmad" }] },
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      url: "/api/admin/corrections",
      searchParams: { status: "pending" },
    });
    const res = await getCorrections(req);
    expect(res.status).toBe(200);
    const builder = client.__queryBuilders.get("commission_correction_requests")!;
    // The .eq('status', 'pending') filter was applied
    const statusCall = builder.eq.mock.calls.find(
      (c: any[]) => c[0] === "status" && c[1] === "pending",
    );
    expect(statusCall).toBeDefined();
  });

  it("ignores unrecognized status values (no .eq('status', ...) call)", async () => {
    const client = makeClient({
      commission_correction_requests: { data: [] },
      users: { data: [] },
    });
    hoisted.clientRef.current = client;
    const req = createMockRequest({
      url: "/api/admin/corrections",
      searchParams: { status: "banana" },
    });
    await getCorrections(req);
    const builder = client.__queryBuilders.get("commission_correction_requests")!;
    const statusCall = builder.eq.mock.calls.find(
      (c: any[]) => c[0] === "status" && c[1] === "banana",
    );
    expect(statusCall).toBeUndefined();
  });

  it("gracefully shows 'Unknown' when the user row is missing", async () => {
    const client = makeClient({
      commission_correction_requests: { data: [corr({ employee_id: "ghost" })] },
      users: { data: [] },
    });
    hoisted.clientRef.current = client;
    const req = createMockRequest({ url: "/api/admin/corrections" });
    const res = await getCorrections(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.requests[0].employeeName).toBe("Unknown");
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.adminAuthResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient();
    const req = createMockRequest({ url: "/api/admin/corrections" });
    const res = await getCorrections(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// PUT /api/admin/corrections/[id] — extra coverage
// ════════════════════════════════════════════════════════
describe("PUT /api/admin/corrections/[id] — extra coverage", () => {
  beforeEach(() => {
    hoisted.clientRef.current = makeClient({
      commission_correction_requests: { data: [] },
      employee_activity_log: { data: [] },
      audit_log: { data: [] },
    });
  });

  function stubResponse(row: any) {
    const builder = hoisted.clientRef.current.__queryBuilders.get(
      "commission_correction_requests",
    )!;
    builder.maybeSingle = vi.fn().mockResolvedValue({ data: row, error: null });
  }

  it("invokes logAudit with module='commissions' and action='resolve_correction'", async () => {
    stubResponse({ id: 1, employee_id: "emp1", status: "approved" });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: {
        status: "approved",
        adminResponse: "Approved after payroll review",
      },
    });
    await respondCorrection(req, ctxOf("1"));
    expect(hoisted.auditMock).toHaveBeenCalled();
    const auditArgs = hoisted.auditMock.mock.calls.at(-1)?.[1];
    expect(auditArgs?.module).toBe("commissions");
    expect(auditArgs?.action).toBe("resolve_correction");
    expect(auditArgs?.entityType).toBe("correction_request");
    expect(auditArgs?.entityId).toBe("1");
  });

  it("inserts an employee activity row (fire-and-forget)", async () => {
    stubResponse({ id: 1, employee_id: "emp1", status: "approved" });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: {
        status: "approved",
        adminResponse: "Approved",
      },
    });
    await respondCorrection(req, ctxOf("1"));
    const activity = hoisted.clientRef.current.__queryBuilders.get(
      "employee_activity_log",
    );
    expect(activity?.insert).toHaveBeenCalled();
    const payload = activity!.insert.mock.calls.at(-1)?.[0];
    expect(payload?.employee_id).toBe("emp1");
    expect(payload?.event_type).toBe("correction_resolved");
  });

  it("double-resolve race: second call returns 409 (atomic WHERE status='pending')", async () => {
    // First call: row present; second call: WHERE status='pending' returns 0 rows → null
    const builder = hoisted.clientRef.current.__queryBuilders.get(
      "commission_correction_requests",
    )!;
    builder.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({
        data: { id: 1, employee_id: "emp1", status: "approved" },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null });

    const firstReq = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: { status: "approved", adminResponse: "Approved once" },
    });
    const firstRes = await respondCorrection(firstReq, ctxOf("1"));
    expect(firstRes.status).toBe(200);

    const secondReq = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: { status: "approved", adminResponse: "Approved again" },
    });
    const secondRes = await respondCorrection(secondReq, ctxOf("1"));
    expect(secondRes.status).toBe(409);
  });

  it("adminResponse shorter than 2 chars → 400 (Zod min(2))", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: { status: "approved", adminResponse: "a" },
    });
    const res = await respondCorrection(req, ctxOf("1"));
    expect(res.status).toBe(400);
  });

  it("401 when unauth", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.adminAuthResponse = NextResponse.json({ error: "unauth" }, { status: 401 });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/admin/corrections/1",
      body: { status: "approved", adminResponse: "should not reach" },
    });
    const res = await respondCorrection(req, ctxOf("1"));
    expect(res.status).toBe(401);
  });
});
