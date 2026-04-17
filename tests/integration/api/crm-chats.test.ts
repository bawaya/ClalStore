/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeBotConversation,
  makeBotMessage,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const chat = makeBotConversation({ id: "chat1", status: "active" });
const message = makeBotMessage({ id: "msg1", conversation_id: "chat1" });

// ── Mocks ─────────────────────────────────────────────
const mockGetCRMChats = vi.fn().mockResolvedValue({ data: [chat], total: 1 });
const mockGetChatStats = vi.fn().mockResolvedValue({ total: 10, active: 3, webchat: 5, whatsapp: 5 });
const mockGetChatMessages = vi.fn().mockResolvedValue([message]);
const mockCloseConversation = vi.fn().mockResolvedValue(undefined);
const mockEscalateConversation = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/crm/queries", () => ({
  getCRMChats: (...args: any[]) => mockGetCRMChats(...args),
  getChatStats: (...args: any[]) => mockGetChatStats(...args),
  getChatMessages: (...args: any[]) => mockGetChatMessages(...args),
  closeConversation: (...args: any[]) => mockCloseConversation(...args),
  escalateConversation: (...args: any[]) => mockEscalateConversation(...args),
}));

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

// ── Imports ───────────────────────────────────────────
import { GET as getChats } from "@/app/api/crm/chats/route";
import { GET as getMessages, PUT as updateChat } from "@/app/api/crm/chats/[id]/messages/route";

// Helper for parameterised routes
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

// ── Tests ─────────────────────────────────────────────

describe("CRM Chats — GET /api/crm/chats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns conversations list", async () => {
    const req = createMockRequest({ url: "/api/crm/chats" });
    const res = await getChats(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversations).toBeDefined();
    expect(body.total).toBe(1);
  });

  it("returns stats when stats=true", async () => {
    const req = createMockRequest({
      url: "/api/crm/chats",
      searchParams: { stats: "true" },
    });
    const res = await getChats(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(mockGetChatStats).toHaveBeenCalled();
  });

  it("passes filters for list", async () => {
    const req = createMockRequest({
      url: "/api/crm/chats",
      searchParams: { channel: "whatsapp", status: "active", search: "test", limit: "10" },
    });
    await getChats(req);
    expect(mockGetCRMChats).toHaveBeenCalledWith(
      expect.objectContaining({ channel: "whatsapp", status: "active", search: "test", limit: 10 }),
    );
  });
});

describe("Chat Messages — /api/crm/chats/[id]/messages", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("GET", () => {
    it("returns messages for a conversation", async () => {
      const req = createMockRequest({ url: "/api/crm/chats/chat1/messages" });
      const res = await getMessages(req, paramsOf("chat1"));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockGetChatMessages).toHaveBeenCalledWith("chat1");
    });
  });

  describe("PUT", () => {
    it("closes a conversation", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/chats/chat1/messages",
        body: { action: "close" },
      });
      const res = await updateChat(req, paramsOf("chat1"));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(body.success).toBe(true);
      expect(mockCloseConversation).toHaveBeenCalledWith("chat1");
    });

    it("escalates a conversation", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/chats/chat1/messages",
        body: { action: "escalate" },
      });
      const res = await updateChat(req, paramsOf("chat1"));
      const body = await res.json();
      expect(res.status).toBe(200);
      expect(mockEscalateConversation).toHaveBeenCalledWith("chat1");
    });

    it("returns 400 for unknown action", async () => {
      const req = createMockRequest({
        method: "PUT",
        url: "/api/crm/chats/chat1/messages",
        body: { action: "unknown" },
      });
      const res = await updateChat(req, paramsOf("chat1"));
      expect(res.status).toBe(400);
    });
  });
});
