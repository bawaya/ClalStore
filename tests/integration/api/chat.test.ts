import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/bot/webchat", () => ({
  handleWebChatMessage: vi.fn(),
  formatWebChatResponse: vi.fn(),
}));

vi.mock("@/lib/bot/engine", () => ({
  logBotInteraction: vi.fn().mockResolvedValue(undefined),
}));

import { POST } from "@/app/api/chat/route";
import { handleWebChatMessage, formatWebChatResponse } from "@/lib/bot/webchat";
import { logBotInteraction } from "@/lib/bot/engine";
import { NextRequest } from "next/server";

const mockHandleWebChat = handleWebChatMessage as ReturnType<typeof vi.fn>;
const mockFormatResponse = formatWebChatResponse as ReturnType<typeof vi.fn>;
const mockLogInteraction = logBotInteraction as ReturnType<typeof vi.fn>;

function makeReq(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHandleWebChat.mockResolvedValue({ text: "Hello!", quickReplies: [] });
    mockFormatResponse.mockReturnValue({
      text: "Hello!",
      quickReplies: [],
      escalate: false,
    });
    mockLogInteraction.mockResolvedValue(undefined);
  });

  it("returns success with valid message", async () => {
    const res = await POST(makeReq({ message: "Hello" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.text).toBe("Hello!");
    expect(res.status).toBe(200);
  });

  it("passes sessionId to handler when provided", async () => {
    await POST(makeReq({ message: "Hi", sessionId: "sess-123" }));
    expect(mockHandleWebChat).toHaveBeenCalledWith("Hi", "sess-123");
  });

  it("generates anonymous sessionId when not provided", async () => {
    await POST(makeReq({ message: "Hi" }));
    const [, sessionId] = mockHandleWebChat.mock.calls[0];
    expect(sessionId).toMatch(/^anon_\d+$/);
  });

  it("returns 400 when message is missing", async () => {
    const res = await POST(makeReq({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.success).toBe(false);
  });

  it("returns 400 when message is empty string", async () => {
    const res = await POST(makeReq({ message: "" }));
    expect(res.status).toBe(400);
  });

  it("logs bot interaction on success", async () => {
    await POST(makeReq({ message: "Test", sessionId: "s1" }));
    expect(mockLogInteraction).toHaveBeenCalledWith(
      "webchat",
      "s1",
      "Test",
      "Hello!",
      "processed"
    );
  });

  it("returns friendly error when handler throws", async () => {
    mockHandleWebChat.mockRejectedValueOnce(new Error("AI failed"));
    const res = await POST(makeReq({ message: "Hi" }));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.text).toContain("053-3337653");
    expect(body.data.escalate).toBe(false);
  });

  it("formats response through formatWebChatResponse", async () => {
    await POST(makeReq({ message: "Hi" }));
    expect(mockFormatResponse).toHaveBeenCalledWith({ text: "Hello!", quickReplies: [] });
  });
});
