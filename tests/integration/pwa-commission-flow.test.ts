/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integration tests for the PWA commission flow — spec 3C.
 *
 * Fills gaps not covered by `tests/integration/api/pwa-submit.test.ts`:
 *   - POST /api/pwa/sales          (create draft sales doc)
 *   - POST /api/pwa/sales/[id]/attachments/sign   (signed upload URL)
 *   - POST /api/pwa/sales/[id]/attachments        (record metadata + verify in Storage)
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeSalesDoc,
} from "@/tests/helpers";

// ── Hoisted shared state ──────────────────────────────
const hoisted = vi.hoisted(() => ({
  auth: {
    authId: "auth-emp1",
    appUserId: "emp1",
    role: "sales",
    name: "Sales Rep",
  },
  clientRef: { current: null as any },
  authResult: null as any,
}));

// ── Mocks ─────────────────────────────────────────────
vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => hoisted.clientRef.current),
  createAdminSupabase: vi.fn(() => hoisted.clientRef.current),
}));

vi.mock("@/lib/pwa/auth", () => ({
  requireEmployee: vi.fn(() =>
    Promise.resolve(hoisted.authResult ?? hoisted.auth),
  ),
}));

// ── Route imports (after mocks) ───────────────────────
import { POST as createSale } from "@/app/api/pwa/sales/route";
import { POST as signAttachment } from "@/app/api/pwa/sales/[id]/attachments/sign/route";
import { POST as recordAttachment } from "@/app/api/pwa/sales/[id]/attachments/route";

const ctxOf = (id: string) => ({ params: Promise.resolve({ id }) });

function makeClient(tables: Record<string, { data?: any; error?: any }> = {}) {
  return createMockSupabaseClient(tables);
}

const signBody = (over: Record<string, any> = {}) => ({
  attachment_type: "invoice",
  file_name: "x.pdf",
  mime_type: "application/pdf",
  file_size: 1000,
  ...over,
});

const recordBody = (over: Record<string, any> = {}) => ({
  attachment_type: "invoice",
  file_path: "sales-docs/1/invoice/abc.jpg",
  file_name: "abc.jpg",
  mime_type: "image/jpeg",
  file_size: 1024,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  hoisted.authResult = null;
});

// ════════════════════════════════════════════════════════
// POST /api/pwa/sales — create draft
// ════════════════════════════════════════════════════════
describe("POST /api/pwa/sales", () => {
  it("creates draft sales_doc with employee_key set to the authed user", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    // insert returns the created row
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 1,
        status: "draft",
        employee_key: "emp1",
        employee_user_id: "emp1",
        sale_type: "device",
        total_amount: 5000,
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 5000,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.data?.employee_key).toBe("emp1");
    expect(body.data?.status).toBe("draft");
  });

  it("links customer by phone when customer_phone is provided", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [{ id: "cust-42" }] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    // customer phone lookup
    client.__queryBuilders.get("customers")!.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: { id: "cust-42" }, error: null });
    // insert returns the created row with resolved customer
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 2,
        customer_id: "cust-42",
        status: "draft",
        employee_key: "emp1",
        sale_type: "line",
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "line",
        total_amount: 39.9,
        customer_phone: "0501234567",
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data?.customer_id).toBe("cust-42");
  });

  it("customer not found by phone → customer_id stays null", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [] },
      orders: { data: [] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    client.__queryBuilders.get("customers")!.maybeSingle = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: null });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 3,
        customer_id: null,
        status: "draft",
        sale_type: "line",
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "line",
        total_amount: 39.9,
        customer_phone: "0509999999",
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.data?.customer_id).toBeNull();
  });

  it("rejects total_amount = 0 (Zod .positive())", async () => {
    hoisted.clientRef.current = makeClient({
      sales_docs: { data: [] },
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 0,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects negative total_amount", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: -100,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects sale_date in the future (> +1 day)", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const futureISO = new Date(Date.now() + 10 * 86400000)
      .toISOString()
      .slice(0, 10);
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 1000,
        sale_date: futureISO,
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects sale_date older than 90 days", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const oldISO = new Date(Date.now() - 120 * 86400000)
      .toISOString()
      .slice(0, 10);
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "device",
        total_amount: 1000,
        sale_date: oldISO,
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("rejects missing sale_type (required)", async () => {
    hoisted.clientRef.current = makeClient({ sales_docs: { data: [] } });
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        total_amount: 100,
        sale_date: "2026-04-10",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(400);
  });

  it("accepts idempotency_key in payload (passed through to insert)", async () => {
    const client = makeClient({
      sales_docs: { data: [] },
      customers: { data: [] },
      sales_doc_items: { data: [] },
      sales_doc_events: { data: [] },
    });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: makeSalesDoc({
        id: 42,
        status: "draft",
        idempotency_key: "my-key-xyz",
      }),
      error: null,
    });
    hoisted.clientRef.current = client;

    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: {
        sale_type: "line",
        total_amount: 39.9,
        sale_date: "2026-04-10",
        idempotency_key: "my-key-xyz",
      },
    });
    const res = await createSale(req);
    expect(res.status).toBe(201);
    // the insert builder received the idempotency_key as part of the payload
    const insertMock = client.__queryBuilders.get("sales_docs")!.insert;
    const passedPayload = insertMock.mock.calls[0]?.[0];
    expect(passedPayload?.idempotency_key).toBe("my-key-xyz");
  });

  it("returns 401 when unauthenticated", async () => {
    const { NextResponse } = await import("next/server");
    hoisted.authResult = NextResponse.json({ error: "unauth" }, { status: 401 });
    hoisted.clientRef.current = makeClient({});
    const req = createMockRequest({
      method: "POST",
      url: "/api/pwa/sales",
      body: { sale_type: "device", total_amount: 1000 },
    });
    const res = await createSale(req);
    expect(res.status).toBe(401);
  });
});

// ════════════════════════════════════════════════════════
// POST /api/pwa/sales/[id]/attachments/sign
// ════════════════════════════════════════════════════════
describe("POST /api/pwa/sales/[id]/attachments/sign", () => {
  function installOwnedDraft(status: string = "draft") {
    const client = makeClient({
      sales_docs: {
        data: [{ id: 1, employee_key: "emp1", status }],
      },
    });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: { id: 1, employee_key: "emp1", status },
      error: null,
    });
    // The sign route calls storage.from(BUCKET).createSignedUploadUrl(path)
    // The default storage mock only has createSignedUrl — install the upload variant.
    client.storage.__bucket.createSignedUploadUrl = vi.fn().mockResolvedValue({
      data: {
        signedUrl: "https://storage.test/upload-signed",
        token: "upload-token-xyz",
        path: "sales-docs/1/invoice/abc.jpg",
      },
      error: null,
    });
    hoisted.clientRef.current = client;
    return client;
  }

  const signReq = (body: any, id = "1") =>
    createMockRequest({
      method: "POST",
      url: `/api/pwa/sales/${id}/attachments/sign`,
      body,
    });

  it("returns signed URL for a valid MIME (image/jpeg)", async () => {
    installOwnedDraft();
    const res = await signAttachment(
      signReq(signBody({ file_name: "invoice.jpg", mime_type: "image/jpeg", file_size: 1024 })),
      ctxOf("1"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.signed_url).toMatch(/https?:\/\//);
    expect(body.data?.bucket).toBe("sales-docs-private");
  });

  it("storage_path uses the expected prefix 'sales-docs/<docId>/<type>/'", async () => {
    installOwnedDraft();
    const res = await signAttachment(
      signReq(signBody({ attachment_type: "contract_photo", file_name: "photo.png", mime_type: "image/png", file_size: 5000 })),
      ctxOf("1"),
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data?.storage_path).toMatch(/^sales-docs\/1\/contract_photo\//);
  });

  it("accepts pdf, jpeg, png, webp, heic", async () => {
    for (const [mime, ext] of [
      ["application/pdf", "pdf"],
      ["image/jpeg", "jpg"],
      ["image/png", "png"],
      ["image/webp", "webp"],
      ["image/heic", "heic"],
    ] as const) {
      installOwnedDraft();
      const res = await signAttachment(
        signReq(signBody({ file_name: `f.${ext}`, mime_type: mime })),
        ctxOf("1"),
      );
      expect(res.status, `expected 200 for ${mime}`).toBe(200);
    }
  });

  it("rejects invalid MIME (application/exe → 400)", async () => {
    installOwnedDraft();
    const res = await signAttachment(
      signReq(signBody({ mime_type: "application/exe", file_name: "nope.exe" })),
      ctxOf("1"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects file size > 10MB", async () => {
    installOwnedDraft();
    const res = await signAttachment(
      signReq(signBody({ file_size: 11 * 1024 * 1024 })),
      ctxOf("1"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects doc not owned by employee (403)", async () => {
    const client = makeClient({ sales_docs: { data: [] } });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: { id: 1, employee_key: "different-emp", status: "draft" },
      error: null,
    });
    hoisted.clientRef.current = client;
    const res = await signAttachment(signReq(signBody()), ctxOf("1"));
    expect(res.status).toBe(403);
  });

  it("rejects doc already synced (not in draft/rejected) — 400", async () => {
    installOwnedDraft("synced_to_commissions");
    const res = await signAttachment(signReq(signBody()), ctxOf("1"));
    expect(res.status).toBe(400);
  });

  it("returns 404 for missing doc", async () => {
    const client = makeClient({ sales_docs: { data: [] } });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: null,
      error: null,
    });
    hoisted.clientRef.current = client;
    const res = await signAttachment(signReq(signBody(), "999"), ctxOf("999"));
    expect(res.status).toBe(404);
  });
});

// ════════════════════════════════════════════════════════
// POST /api/pwa/sales/[id]/attachments — record metadata
// ════════════════════════════════════════════════════════
describe("POST /api/pwa/sales/[id]/attachments", () => {
  function installOwnedDraft(filesInStorage: Array<{ name: string; metadata?: any }>) {
    const client = makeClient({
      sales_docs: {
        data: [{ id: 1, employee_key: "emp1", status: "draft" }],
      },
      sales_doc_attachments: { data: [] },
      sales_doc_events: { data: [] },
    });
    client.__queryBuilders.get("sales_docs")!.single = vi.fn().mockResolvedValue({
      data: { id: 1, employee_key: "emp1", status: "draft" },
      error: null,
    });
    // Wire storage.list to return the injected file set
    client.storage.__bucket.list = vi
      .fn()
      .mockResolvedValue({ data: filesInStorage, error: null });
    // attachment insert row
    client.__queryBuilders.get("sales_doc_attachments")!.single = vi.fn().mockResolvedValue({
      data: {
        id: 11,
        sales_doc_id: 1,
        attachment_type: "invoice",
        file_path: "sales-docs/1/invoice/abc.jpg",
        file_name: "invoice.jpg",
        mime_type: "image/jpeg",
        file_size: 1024,
      },
      error: null,
    });
    hoisted.clientRef.current = client;
    return client;
  }

  const recordReq = (body: any, id = "1") =>
    createMockRequest({
      method: "POST",
      url: `/api/pwa/sales/${id}/attachments`,
      body,
    });
  const okFile = { name: "abc.jpg", metadata: { size: 1024 } };

  it("records metadata after Storage verification passes (201)", async () => {
    installOwnedDraft([okFile]);
    const res = await recordAttachment(recordReq(recordBody()), ctxOf("1"));
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.success).toBe(true);
  });

  it("verifies file exists in Storage (storage.list is called)", async () => {
    const client = installOwnedDraft([okFile]);
    await recordAttachment(recordReq(recordBody()), ctxOf("1"));
    expect(client.storage.__bucket.list).toHaveBeenCalled();
  });

  it("rejects if file not found in Storage (400)", async () => {
    installOwnedDraft([]); // empty listing
    const res = await recordAttachment(
      recordReq(recordBody({ file_path: "sales-docs/1/invoice/missing.jpg", file_name: "missing.jpg" })),
      ctxOf("1"),
    );
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error).toMatch(/غير موجود|not found/i);
  });

  it("rejects path that doesn't start with 'sales-docs/<docId>/'", async () => {
    installOwnedDraft([okFile]);
    const res = await recordAttachment(
      recordReq(recordBody({ file_path: "other-bucket/1/invoice/abc.jpg" })),
      ctxOf("1"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects path that uses a different doc id (path tampering)", async () => {
    installOwnedDraft([okFile]);
    const res = await recordAttachment(
      recordReq(recordBody({ file_path: "sales-docs/99/invoice/abc.jpg" })),
      ctxOf("1"),
    );
    expect(res.status).toBe(400);
  });

  it("rejects reported size mismatch vs Storage metadata", async () => {
    installOwnedDraft([{ name: "abc.jpg", metadata: { size: 9999 } }]);
    const res = await recordAttachment(
      recordReq(recordBody({ file_size: 1024 })), // client says 1024, storage 9999
      ctxOf("1"),
    );
    expect(res.status).toBe(400);
  });
});
