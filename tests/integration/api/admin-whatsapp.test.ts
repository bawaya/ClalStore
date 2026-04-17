/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockRequest, createMockSupabaseClient } from "@/tests/helpers";

// ── Mocks ──────────────────────────────────────────────
vi.mock("@/lib/supabase", () => {
  const client = createMockSupabaseClient();
  return {
    createServerSupabase: vi.fn(() => client),
    createAdminSupabase: vi.fn(() => client),
  };
});

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

// Mock ycloud-templates
const mockListTemplates = vi.fn().mockResolvedValue([
  { name: "clal_order_update", status: "APPROVED" },
  { name: "clal_admin_alert", status: "PENDING" },
]);
const mockCreateTemplate = vi.fn().mockResolvedValue({ name: "clal_new", status: "PENDING" });
const mockDeleteTemplate = vi.fn().mockResolvedValue({ success: true });
const mockProvisionRequiredTemplates = vi.fn().mockResolvedValue({ created: 3, skipped: 2 });

vi.mock("@/lib/integrations/ycloud-templates", () => ({
  listTemplates: (...args: any[]) => mockListTemplates(...args),
  createTemplate: (...args: any[]) => mockCreateTemplate(...args),
  deleteTemplate: (...args: any[]) => mockDeleteTemplate(...args),
  provisionRequiredTemplates: (...args: any[]) => mockProvisionRequiredTemplates(...args),
  REQUIRED_TEMPLATES: [
    { name: "clal_order_update" },
    { name: "clal_admin_alert" },
    { name: "clal_welcome" },
  ],
}));

// Mock whatsapp send functions
const mockSendWhatsAppText = vi.fn().mockResolvedValue({ id: "wamid.123", status: "accepted" });
const mockSendWhatsAppTemplate = vi.fn().mockResolvedValue({ id: "wamid.456", status: "accepted" });

vi.mock("@/lib/bot/whatsapp", () => ({
  sendWhatsAppText: (...args: any[]) => mockSendWhatsAppText(...args),
  sendWhatsAppTemplate: (...args: any[]) => mockSendWhatsAppTemplate(...args),
}));

import { GET as templatesGET, POST as templatesPOST, DELETE as templatesDELETE } from "@/app/api/admin/whatsapp-templates/route";
import { POST as whatsappTestPOST } from "@/app/api/admin/whatsapp-test/route";
import { requireAdmin } from "@/lib/admin/auth";

// ── Tests ──────────────────────────────────────────────
describe("Admin WhatsApp APIs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireAdmin as any).mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
    });
    process.env.WEBHOOK_VERIFY_TOKEN = "test-verify-token";
    process.env.ADMIN_PERSONAL_PHONE = "972501234567";
    process.env.WHATSAPP_PHONE_ID = "phone-id-123";
    process.env.YCLOUD_API_KEY = "ycloud-key";
  });

  // ═══════════════════════════════════════════════
  // /api/admin/whatsapp-templates
  // ═══════════════════════════════════════════════
  describe("WhatsApp Templates — /api/admin/whatsapp-templates", () => {
    describe("GET", () => {
      it("returns templates with summary and missing list", async () => {
        const req = createMockRequest({ url: "/api/admin/whatsapp-templates" });
        const res = await templatesGET(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(body.data.templates).toHaveLength(2);
        expect(body.data.summary).toBeDefined();
        expect(body.data.summary.total).toBe(2);
        expect(body.data.summary.approved).toBe(1);
        expect(body.data.summary.pending).toBe(1);
        expect(body.data.missing).toBeDefined();
      });

      it("identifies missing required templates", async () => {
        const req = createMockRequest({ url: "/api/admin/whatsapp-templates" });
        const res = await templatesGET(req);
        const body = await res.json();

        // clal_welcome is not in the fetched list
        expect(body.data.missing).toContain("clal_welcome");
      });

      it("returns 401 when not authenticated", async () => {
        const { NextResponse } = await import("next/server");
        (requireAdmin as any).mockResolvedValue(
          NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
        );
        const req = createMockRequest({ url: "/api/admin/whatsapp-templates" });
        const res = await templatesGET(req);

        expect(res.status).toBe(401);
      });

      it("returns 500 on listTemplates error", async () => {
        mockListTemplates.mockRejectedValue(new Error("yCloud API fail"));
        const req = createMockRequest({ url: "/api/admin/whatsapp-templates" });
        const res = await templatesGET(req);

        expect(res.status).toBe(500);
      });
    });

    describe("POST", () => {
      it("provisions all required templates", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { action: "provision_all" },
        });
        const res = await templatesPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockProvisionRequiredTemplates).toHaveBeenCalled();
      });

      it("creates a single template", async () => {
        const req = createMockRequest({
          method: "POST",
          body: {
            template: { name: "clal_new", language: "ar", content: "test" },
          },
        });
        const res = await templatesPOST(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockCreateTemplate).toHaveBeenCalled();
      });

      it("returns 400 for invalid request body", async () => {
        const req = createMockRequest({
          method: "POST",
          body: { invalid: true },
        });
        const res = await templatesPOST(req);

        expect(res.status).toBe(400);
      });

      it("returns 500 on provision error", async () => {
        mockProvisionRequiredTemplates.mockRejectedValue(new Error("API fail"));
        const req = createMockRequest({
          method: "POST",
          body: { action: "provision_all" },
        });
        const res = await templatesPOST(req);

        expect(res.status).toBe(500);
      });
    });

    describe("DELETE", () => {
      it("deletes a template by name", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/whatsapp-templates",
          searchParams: { name: "clal_old" },
        });
        const res = await templatesDELETE(req);
        const body = await res.json();

        expect(res.status).toBe(200);
        expect(body.success).toBe(true);
        expect(mockDeleteTemplate).toHaveBeenCalledWith("clal_old");
      });

      it("returns 400 when name is missing", async () => {
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/whatsapp-templates",
        });
        const res = await templatesDELETE(req);

        expect(res.status).toBe(400);
      });

      it("returns 500 on delete error", async () => {
        mockDeleteTemplate.mockRejectedValue(new Error("API fail"));
        const req = createMockRequest({
          method: "DELETE",
          url: "/api/admin/whatsapp-templates",
          searchParams: { name: "clal_old" },
        });
        const res = await templatesDELETE(req);

        expect(res.status).toBe(500);
      });
    });
  });

  // ═══════════════════════════════════════════════
  // /api/admin/whatsapp-test
  // ═══════════════════════════════════════════════
  describe("WhatsApp Test — /api/admin/whatsapp-test POST", () => {
    it("sends a text message", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { to: "972501234567", message: "Hello test" },
        headers: { "x-admin-key": "test-verify-token" },
      });
      const res = await whatsappTestPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data.mode).toBe("text");
      expect(mockSendWhatsAppText).toHaveBeenCalledWith("972501234567", "Hello test");
    });

    it("sends a template message", async () => {
      const req = createMockRequest({
        method: "POST",
        body: {
          to: "972501234567",
          mode: "template",
          templateName: "clal_admin_alert",
          templateParams: ["Test param"],
        },
        headers: { "x-admin-key": "test-verify-token" },
      });
      const res = await whatsappTestPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.data.mode).toBe("template");
      expect(body.data.templateName).toBe("clal_admin_alert");
      expect(mockSendWhatsAppTemplate).toHaveBeenCalled();
    });

    it("uses default message when none provided", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { to: "972501234567" },
        headers: { "x-admin-key": "test-verify-token" },
      });
      const res = await whatsappTestPOST(req);
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(mockSendWhatsAppText).toHaveBeenCalledWith(
        "972501234567",
        expect.stringContaining("Test message"),
      );
    });

    it("returns 400 when to is missing", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { message: "Hello" },
        headers: { "x-admin-key": "test-verify-token" },
      });
      const res = await whatsappTestPOST(req);

      expect(res.status).toBe(400);
    });

    it("returns 401 when x-admin-key is wrong", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { to: "972501234567" },
        headers: { "x-admin-key": "wrong-key" },
      });
      const res = await whatsappTestPOST(req);

      expect(res.status).toBe(401);
    });

    it("returns 401 when x-admin-key is missing", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { to: "972501234567" },
      });
      const res = await whatsappTestPOST(req);

      expect(res.status).toBe(401);
    });

    it("returns diagnostics in response", async () => {
      const req = createMockRequest({
        method: "POST",
        body: { to: "972501234567" },
        headers: { "x-admin-key": "test-verify-token" },
      });
      const res = await whatsappTestPOST(req);
      const body = await res.json();

      expect(body.data.diagnostics).toBeDefined();
      expect(body.data.diagnostics.YCLOUD_API_KEY).toBe("set");
    });

    it("returns 500 on send error", async () => {
      mockSendWhatsAppText.mockRejectedValue(new Error("send failed"));
      const req = createMockRequest({
        method: "POST",
        body: { to: "972501234567" },
        headers: { "x-admin-key": "test-verify-token" },
      });
      const res = await whatsappTestPOST(req);

      expect(res.status).toBe(500);
    });
  });
});
