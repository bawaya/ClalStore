/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makePipelineDeal,
  makePipelineStage,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const deal = makePipelineDeal({ id: "d1", customer_name: "Ahmad", value: 3499 });
const stage = makePipelineStage({ id: 1, name: "Lead" });

// ── Mocks ─────────────────────────────────────────────
const mockPipelineSnapshot = {
  stages: [stage],
  deals: [deal],
  summary: { total: 1, totalValue: 3499 },
};

const mockGetPipelineSnapshot = vi.fn().mockResolvedValue(mockPipelineSnapshot);
const mockCreatePipelineDealRecord = vi.fn().mockResolvedValue(deal);
const mockUpdatePipelineDealRecord = vi.fn().mockResolvedValue(deal);
const mockDeletePipelineDealRecord = vi.fn().mockResolvedValue(undefined);
const mockConvertPipelineDealToOrder = vi.fn().mockResolvedValue({ orderId: "CLM-99", ok: true });

vi.mock("@/lib/crm/pipeline", () => ({
  getPipelineSnapshot: (...args: any[]) => mockGetPipelineSnapshot(...args),
  createPipelineDealRecord: (...args: any[]) => mockCreatePipelineDealRecord(...args),
  updatePipelineDealRecord: (...args: any[]) => mockUpdatePipelineDealRecord(...args),
  deletePipelineDealRecord: (...args: any[]) => mockDeletePipelineDealRecord(...args),
  convertPipelineDealToOrder: (...args: any[]) => mockConvertPipelineDealToOrder(...args),
}));

const supabaseClient = createMockSupabaseClient({
  pipeline_deals: { data: [deal] },
  pipeline_stages: { data: [stage] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
}));

const { mockUser } = vi.hoisted(() => ({
  mockUser: {
    id: "u1",
    email: "admin@test.com",
    role: "super_admin",
    name: "Admin",
    appUserId: "u1",
  },
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue(mockUser),
    hasPermission: vi.fn().mockReturnValue(true),
    withPermission: vi.fn().mockImplementation(
      (_module: string, _action: string, handler: Function) => {
        return async (req: any, ctx?: any) => handler(req, supabaseClient, mockUser, ctx);
      }
    ),
    withAdminAuth: vi.fn().mockImplementation((handler: Function) => {
      return async (req: any, ctx?: any) => handler(req, supabaseClient, mockUser, ctx);
    }),
    logAudit: vi.fn().mockResolvedValue(undefined),
  };
});

// ── Imports ───────────────────────────────────────────
import { GET, POST, PUT, DELETE } from "@/app/api/crm/pipeline/route";
import { POST as convertDeal } from "@/app/api/crm/pipeline/[id]/convert/route";

// ── Tests ─────────────────────────────────────────────

describe("Pipeline — /api/crm/pipeline", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns pipeline snapshot", async () => {
      const req = createMockRequest({ url: "/api/crm/pipeline" });
      const res = await GET(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetPipelineSnapshot).toHaveBeenCalled();
    });
  });

  describe("POST", () => {
    it("creates a pipeline deal", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/pipeline",
        body: {
          stage_id: 1,
          customer_name: "Ahmad",
          customer_phone: "0501234567",
          product_name: "iPhone 15",
          estimated_value: 3499,
        },
      });
      const res = await POST(req);
      const body = await res.json();
      expect(res.status).toBe(201);
      expect(body.success).toBe(true);
      expect(mockCreatePipelineDealRecord).toHaveBeenCalled();
    });

    it("returns 400 for invalid payload", async () => {
      const req = createMockRequest({
        method: "POST",
        url: "/api/crm/pipeline",
        body: {},
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });
  });

  describe("PUT", () => {
    it("updates a pipeline deal", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/pipeline",
        body: { id: "d1", stage: "negotiation", value: 3200 },
      });
      const res = await PUT(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockUpdatePipelineDealRecord).toHaveBeenCalled();
    });
  });

  describe("DELETE", () => {
    it("deletes a pipeline deal", async () => {
      const req = createMockRequest({
        method: "DELETE",
        url: "/api/crm/pipeline",
        searchParams: { id: "d1" },
      });
      const res = await DELETE(req);
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockDeletePipelineDealRecord).toHaveBeenCalled();
    });

    it("returns 400 when id is missing", async () => {
      const req = createMockRequest({ method: "DELETE", url: "/api/crm/pipeline" });
      const res = await DELETE(req);
      expect(res.status).toBe(400);
    });
  });
});

describe("Pipeline Convert — POST /api/crm/pipeline/[id]/convert", () => {
  beforeEach(() => vi.clearAllMocks());

  it("converts a deal to an order", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/pipeline/d1/convert",
      body: {},
    });
    const res = await convertDeal(req, { params: Promise.resolve({ id: "d1" }) });
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mockConvertPipelineDealToOrder).toHaveBeenCalled();
  });
});
