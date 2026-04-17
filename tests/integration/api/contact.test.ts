import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/bot/admin-notify", () => ({
  notifyAdminContactForm: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/contact/route";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { NextRequest } from "next/server";

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockNotify = notifyAdminContactForm as ReturnType<typeof vi.fn>;

describe("POST /api/contact", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockNotify.mockResolvedValue(undefined);
  });

  it("returns success with valid data", async () => {
    const res = await POST(
      makeReq({
        name: "Ahmad",
        phone: "0533337653",
        subject: "Question",
        message: "I need help with my order",
      })
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(res.status).toBe(200);
  });

  it("calls notifyAdminContactForm with correct data", async () => {
    await POST(
      makeReq({
        name: "Ahmad",
        phone: "0533337653",
        email: "ahmad@test.com",
        subject: "Question",
        message: "Help me",
      })
    );
    expect(mockNotify).toHaveBeenCalledWith({
      name: "Ahmad",
      phone: "0533337653",
      email: "ahmad@test.com",
      subject: "Question",
      message: "Help me",
    });
  });

  it("returns 400 when name is missing", async () => {
    const res = await POST(
      makeReq({
        phone: "0533337653",
        message: "Help",
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 when phone is missing", async () => {
    const res = await POST(
      makeReq({
        name: "Ahmad",
        message: "Help",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(
      makeReq({
        name: "Ahmad",
        phone: "0533337653",
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 500 when notification fails", async () => {
    mockNotify.mockRejectedValueOnce(new Error("WhatsApp down"));
    const res = await POST(
      makeReq({
        name: "Ahmad",
        phone: "0533337653",
        message: "Help",
      })
    );
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("accepts optional email field", async () => {
    const res = await POST(
      makeReq({
        name: "Ahmad",
        phone: "0533337653",
        email: "ahmad@test.com",
        message: "Help",
      })
    );
    expect(res.status).toBe(200);
  });
});
