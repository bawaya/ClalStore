import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

// --- Mocks ---
const { mockSend, mockGetProvider, mockRequireAdmin } = vi.hoisted(() => ({
  mockSend: vi.fn(),
  mockGetProvider: vi.fn(),
  mockRequireAdmin: vi.fn(),
}));

vi.mock("@/lib/integrations/hub", () => ({
  getProvider: (...args: unknown[]) => mockGetProvider(...args),
}));

vi.mock("@/lib/integrations/resend", () => ({
  buildOrderConfirmEmail: vi.fn((orderId: string, name: string, total: number) => ({
    to: "",
    subject: `Order Confirmation ${orderId}`,
    html: `<p>Thank you ${name}, total: ${total}</p>`,
  })),
  buildStatusUpdateEmail: vi.fn(
    (orderId: string, name: string, status: string, label: string) => ({
      to: "",
      subject: `Order ${orderId} ${label}`,
      html: `<p>Order ${orderId} is now ${status}</p>`,
    })
  ),
}));

vi.mock("@/lib/admin/auth", () => ({
  requireAdmin: (...args: unknown[]) => mockRequireAdmin(...args),
}));

import { POST } from "@/app/api/email/route";
import { NextRequest } from "next/server";

function makeReq(body: unknown, headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("http://localhost/api/email", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

describe("POST /api/email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSend.mockResolvedValue({ success: true, messageId: "msg-123" });
    mockGetProvider.mockResolvedValue({
      send: mockSend,
    });
    mockRequireAdmin.mockResolvedValue({ id: "admin-1" });
    process.env.CONTACT_EMAIL = "info@clalmobile.com";
  });

  it("returns sent=false when email provider is not configured", async () => {
    mockGetProvider.mockResolvedValue(null);

    const res = await POST(makeReq({ type: "order_confirm" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.sent).toBe(false);
    expect(body.data.reason).toContain("not configured");
  });

  it("sends order confirmation email", async () => {
    const res = await POST(
      makeReq({
        type: "order_confirm",
        orderId: "CLM-99999",
        customerName: "Ahmad",
        customerEmail: "ahmad@test.com",
        total: 3999,
        items: [{ name: "iPhone", qty: 1, price: 3999 }],
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.sent).toBe(true);
    expect(body.data.messageId).toBe("msg-123");
    expect(mockSend).toHaveBeenCalled();
  });

  it("sends status update email", async () => {
    const res = await POST(
      makeReq({
        type: "status_update",
        orderId: "CLM-99999",
        customerName: "Ahmad",
        customerEmail: "ahmad@test.com",
        status: "shipped",
        statusLabel: "Shipped",
      })
    );
    const body = await res.json();
    expect(body.data.sent).toBe(true);
  });

  it("returns sent=false when no customerEmail for order_confirm", async () => {
    const res = await POST(
      makeReq({
        type: "order_confirm",
        orderId: "CLM-99999",
        customerName: "Ahmad",
        total: 3999,
      })
    );
    const body = await res.json();
    expect(body.data.sent).toBe(false);
  });

  it("sends contact form email to allowed recipient", async () => {
    const res = await POST(
      makeReq({
        to: "info@clalmobile.com",
        subject: "Contact Form",
        html: "<p>Hello</p>",
      })
    );
    const body = await res.json();
    expect(body.data.sent).toBe(true);
  });

  it("rejects contact form email to unauthorized recipient", async () => {
    const res = await POST(
      makeReq({
        to: "hacker@evil.com",
        subject: "Spam",
        html: "<p>Bad</p>",
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 400 for unknown email type", async () => {
    const res = await POST(makeReq({ type: "unknown" }));
    expect(res.status).toBe(400);
  });

  it("requires admin auth for order_confirm", async () => {
    mockRequireAdmin.mockResolvedValue(
      NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 })
    );

    const res = await POST(
      makeReq({
        type: "order_confirm",
        orderId: "CLM-99999",
        customerName: "Ahmad",
        customerEmail: "a@test.com",
        total: 100,
      })
    );
    expect(res.status).toBe(401);
  });

  it("handles email sending failure gracefully", async () => {
    mockSend.mockRejectedValueOnce(new Error("SMTP error"));

    const res = await POST(
      makeReq({
        to: "info@clalmobile.com",
        subject: "Test",
        html: "<p>Test</p>",
      })
    );
    const body = await res.json();
    // Should not crash, returns graceful response
    expect(body.success).toBe(true);
  });
});
