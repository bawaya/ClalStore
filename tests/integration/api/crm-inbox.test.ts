/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createMockRequest,
  createMockSupabaseClient,
  makeInboxConversation,
  makeInboxMessage,
  makeInboxLabel,
  makeInboxNote,
  makeInboxTemplate,
  makeInboxQuickReply,
  makeCustomer,
  makeProduct,
} from "@/tests/helpers";

// ── Fixtures ──────────────────────────────────────────
const conv = makeInboxConversation({ id: "conv1", customer_phone: "0501234567" });
const msg = makeInboxMessage({ id: "m1", conversation_id: "conv1" });
const label = makeInboxLabel({ id: "lbl1", name: "VIP" });
const note = makeInboxNote({ id: "note1", conversation_id: "conv1" });
const tpl = makeInboxTemplate({ id: "tpl1", name: "Welcome" });
const qr = makeInboxQuickReply({ id: "qr1", shortcut: "/hi" });
const customer = makeCustomer({ id: "cust1", phone: "0501234567" });
const product = makeProduct({ id: "prod1" });

// ── Supabase mock ─────────────────────────────────────
const supabaseClient = createMockSupabaseClient({
  inbox_conversations: { data: [conv] },
  inbox_messages: { data: [msg] },
  inbox_labels: { data: [label] },
  inbox_conversation_labels: { data: [{ conversation_id: "conv1", label_id: "lbl1" }] },
  inbox_notes: { data: [note] },
  inbox_templates: { data: [tpl] },
  inbox_quick_replies: { data: [qr] },
  inbox_events: { data: [] },
  users: { data: [{ id: "u1", full_name: "Admin", email: "admin@test.com", name: "Admin" }] },
  customers: { data: [customer] },
  products: { data: [product] },
});

vi.mock("@/lib/supabase", () => ({
  createServerSupabase: vi.fn(() => supabaseClient),
  createAdminSupabase: vi.fn(() => supabaseClient),
  createBrowserSupabase: vi.fn(() => supabaseClient),
  getSupabase: vi.fn(() => supabaseClient),
}));

vi.mock("@/lib/admin/auth", async (importOriginal) => {
  const orig = (await importOriginal()) as any;
  return {
    ...orig,
    requireAdmin: vi.fn().mockResolvedValue({
      id: "u1",
      email: "admin@test.com",
      role: "super_admin",
      name: "Admin",
      appUserId: "u1",
    }),
  };
});

vi.mock("@/lib/bot/whatsapp", () => ({
  sendWhatsAppText: vi.fn().mockResolvedValue({ id: "wamid.123" }),
  sendWhatsAppImage: vi.fn().mockResolvedValue({ id: "wamid.img" }),
  sendWhatsAppDocument: vi.fn().mockResolvedValue({ id: "wamid.doc" }),
  sendWhatsAppTemplate: vi.fn().mockResolvedValue({ id: "wamid.tpl" }),
}));

vi.mock("@/lib/ai/claude", () => ({
  callClaude: vi.fn().mockResolvedValue({
    text: "Mock AI response",
    json: { sentiment: "positive", confidence: 0.9, reason: "happy",
            summary: "Customer wants iPhone", products: ["iPhone"], status: "inquiring",
            action_required: "Send quote", priority: "normal", language: "ar",
            labels: [{ name: "VIP", is_existing: true }],
            recommendations: [{ id: "prod1", reason: "Best match" }] },
    tokens: { input: 100, output: 50 },
    duration: 500,
  }),
  cleanAlternatingMessages: vi.fn((msgs: any) => msgs),
}));

vi.mock("@/lib/ai/usage-tracker", () => ({
  trackAIUsage: vi.fn(),
}));

vi.mock("@/lib/ai/product-context", () => ({
  getProductByQuery: vi.fn().mockResolvedValue("iPhone 15 - 3499 ILS"),
}));

vi.mock("@/lib/storage", () => ({
  uploadImage: vi.fn().mockResolvedValue("https://storage.test/uploaded.jpg"),
}));

// ── Imports (after mocks) ─────────────────────────────
import { GET as listInbox } from "@/app/api/crm/inbox/route";
import { GET as getConversation } from "@/app/api/crm/inbox/[id]/route";
import { POST as sendMessage } from "@/app/api/crm/inbox/[id]/send/route";
import { PUT as changeStatus } from "@/app/api/crm/inbox/[id]/status/route";
import { PUT as assignAgent } from "@/app/api/crm/inbox/[id]/assign/route";
import { GET as getInboxNotes, POST as createInboxNote } from "@/app/api/crm/inbox/[id]/notes/route";
import { POST as analyzeSentiment } from "@/app/api/crm/inbox/[id]/sentiment/route";
import { POST as suggestReply } from "@/app/api/crm/inbox/[id]/suggest/route";
import { POST as summarizeConversation } from "@/app/api/crm/inbox/[id]/summary/route";
import { POST as recommendProducts } from "@/app/api/crm/inbox/[id]/recommend/route";
import { POST as autoLabel } from "@/app/api/crm/inbox/[id]/auto-label/route";
import { GET as getStats } from "@/app/api/crm/inbox/stats/route";
import { GET as getLabels, POST as attachLabel, PUT as createLabel, DELETE as removeLabel } from "@/app/api/crm/inbox/labels/route";
import { GET as getTemplates, POST as createTemplate, PUT as updateTemplate, DELETE as deleteTemplate } from "@/app/api/crm/inbox/templates/route";
import { POST as uploadFile } from "@/app/api/crm/inbox/upload/route";

// Helper for parameterised routes
const paramsOf = (id: string) => ({ params: Promise.resolve({ id }) });

// ── Tests ─────────────────────────────────────────────

describe("Inbox List — GET /api/crm/inbox", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns conversations with stats", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox" });
    const res = await listInbox(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.conversations).toBeDefined();
    expect(body.stats).toBeDefined();
  });

  it("filters by status", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox", searchParams: { status: "active" } });
    const res = await listInbox(req);
    expect(res.status).toBe(200);
  });

  it("supports search", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox", searchParams: { search: "Ahmad" } });
    const res = await listInbox(req);
    expect(res.status).toBe(200);
  });
});

describe("Inbox Detail — GET /api/crm/inbox/[id]", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns conversation with messages", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: conv, error: null });
    const req = createMockRequest({ url: "/api/crm/inbox/conv1" });
    const res = await getConversation(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.conversation).toBeDefined();
    expect(body.messages).toBeDefined();
  });

  it("returns 404 for missing conversation", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: null, error: { message: "not found" } });
    const req = createMockRequest({ url: "/api/crm/inbox/missing" });
    const res = await getConversation(req, paramsOf("missing"));
    expect(res.status).toBe(404);
  });
});

describe("Send Message — POST /api/crm/inbox/[id]/send", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a text message", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: conv, error: null });
    supabaseClient.from("inbox_messages").maybeSingle.mockResolvedValueOnce({
      data: { created_at: new Date().toISOString() },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/conv1/send",
      body: { type: "text", content: "Hello!" },
    });
    const res = await sendMessage(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 404 for missing conversation", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: null, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/missing/send",
      body: { content: "Hi" },
    });
    const res = await sendMessage(req, paramsOf("missing"));
    expect(res.status).toBe(404);
  });

  it("returns 403 for blocked customer", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({
      data: { ...conv, is_blocked: true },
      error: null,
    });
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/conv1/send",
      body: { content: "Hi" },
    });
    const res = await sendMessage(req, paramsOf("conv1"));
    expect(res.status).toBe(403);
  });
});

describe("Change Status — PUT /api/crm/inbox/[id]/status", () => {
  beforeEach(() => vi.clearAllMocks());

  it("changes status to resolved", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: { status: "active" }, error: null });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/conv1/status",
      body: { status: "resolved" },
    });
    const res = await changeStatus(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("rejects invalid status", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/conv1/status",
      body: { status: "invalid_status" },
    });
    const res = await changeStatus(req, paramsOf("conv1"));
    expect(res.status).toBe(400);
  });
});

describe("Assign Agent — PUT /api/crm/inbox/[id]/assign", () => {
  beforeEach(() => vi.clearAllMocks());

  it("assigns an agent", async () => {
    supabaseClient.from("users").single.mockResolvedValueOnce({ data: { name: "Admin" }, error: null });
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/conv1/assign",
      body: { user_id: "u1" },
    });
    const res = await assignAgent(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("unassigns when user_id is empty", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/conv1/assign",
      body: { user_id: "" },
    });
    const res = await assignAgent(req, paramsOf("conv1"));
    expect(res.status).toBe(200);
  });
});

describe("Inbox Notes — /api/crm/inbox/[id]/notes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns notes", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox/conv1/notes" });
    const res = await getInboxNotes(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.notes).toBeDefined();
  });

  it("POST creates a note", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/conv1/notes",
      body: { content: "Internal note", author_name: "Admin" },
    });
    const res = await createInboxNote(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("POST returns 400 for empty content", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/conv1/notes",
      body: { content: "" },
    });
    const res = await createInboxNote(req, paramsOf("conv1"));
    expect(res.status).toBe(400);
  });
});

describe("AI Sentiment — POST /api/crm/inbox/[id]/sentiment", () => {
  beforeEach(() => vi.clearAllMocks());

  it("analyzes sentiment", async () => {
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/conv1/sentiment" });
    const res = await analyzeSentiment(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sentiment).toBeDefined();
  });

  it("returns neutral when no inbound messages", async () => {
    supabaseClient.__queryBuilders.get("inbox_messages")!.__setData([]);
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/conv1/sentiment" });
    const res = await analyzeSentiment(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.sentiment).toBe("neutral");
    // restore
    supabaseClient.__queryBuilders.get("inbox_messages")!.__setData([msg]);
  });
});

describe("AI Suggest — POST /api/crm/inbox/[id]/suggest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("suggests a reply", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: conv, error: null });
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/conv1/suggest",
      body: {},
    });
    const res = await suggestReply(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.suggestion).toBeDefined();
  });

  it("returns 404 for missing conversation", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: null, error: { message: "missing" } });
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/missing/suggest", body: {} });
    const res = await suggestReply(req, paramsOf("missing"));
    expect(res.status).toBe(404);
  });
});

describe("AI Summary — POST /api/crm/inbox/[id]/summary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("generates a summary", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({
      data: { ...conv, metadata: {} },
      error: null,
    });
    // Need at least 3 messages
    supabaseClient.__queryBuilders.get("inbox_messages")!.__setData([msg, msg, msg]);
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/conv1/summary",
      body: {},
    });
    const res = await summarizeConversation(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary).toBeDefined();
    // restore
    supabaseClient.__queryBuilders.get("inbox_messages")!.__setData([msg]);
  });

  it("returns 404 for missing conversation", async () => {
    supabaseClient.from("inbox_conversations").single.mockResolvedValueOnce({ data: null, error: { message: "nf" } });
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/missing/summary", body: {} });
    const res = await summarizeConversation(req, paramsOf("missing"));
    expect(res.status).toBe(404);
  });
});

describe("AI Recommend — POST /api/crm/inbox/[id]/recommend", () => {
  beforeEach(() => vi.clearAllMocks());

  it("recommends products", async () => {
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/conv1/recommend" });
    const res = await recommendProducts(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.recommendations).toBeDefined();
  });
});

describe("AI Auto-Label — POST /api/crm/inbox/[id]/auto-label", () => {
  beforeEach(() => vi.clearAllMocks());

  it("suggests labels", async () => {
    supabaseClient.__queryBuilders.get("inbox_messages")!.__setData([msg, msg]);
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/conv1/auto-label" });
    const res = await autoLabel(req, paramsOf("conv1"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.labels).toBeDefined();
    supabaseClient.__queryBuilders.get("inbox_messages")!.__setData([msg]);
  });
});

describe("Inbox Stats — GET /api/crm/inbox/stats", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns stats", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox/stats" });
    const res = await getStats(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.stats).toBeDefined();
    expect(body.stats.total_conversations).toBeDefined();
  });
});

describe("Inbox Labels — /api/crm/inbox/labels", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns labels", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox/labels" });
    const res = await getLabels(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.labels).toBeDefined();
  });

  it("POST attaches label to conversation", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/labels",
      body: { conversation_id: "conv1", label_id: "lbl1" },
    });
    const res = await attachLabel(req);
    expect(res.status).toBe(200);
  });

  it("POST returns 400 without required fields", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/labels",
      body: {},
    });
    const res = await attachLabel(req);
    expect(res.status).toBe(400);
  });

  it("PUT creates a new label", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/labels",
      body: { name: "New Label", color: "#FF0000" },
    });
    const res = await createLabel(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.label).toBeDefined();
  });

  it("PUT returns 400 without name", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/labels",
      body: {},
    });
    const res = await createLabel(req);
    expect(res.status).toBe(400);
  });

  it("DELETE removes label from conversation", async () => {
    const req = createMockRequest({
      method: "DELETE",
      url: "/api/crm/inbox/labels",
      searchParams: { conversation_id: "conv1", label_id: "lbl1" },
    });
    const res = await removeLabel(req);
    expect(res.status).toBe(200);
  });

  it("DELETE returns 400 without params", async () => {
    const req = createMockRequest({ method: "DELETE", url: "/api/crm/inbox/labels" });
    const res = await removeLabel(req);
    expect(res.status).toBe(400);
  });
});

describe("Inbox Templates — /api/crm/inbox/templates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("GET returns templates and quick replies", async () => {
    const req = createMockRequest({ url: "/api/crm/inbox/templates" });
    const res = await getTemplates(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.templates).toBeDefined();
    expect(body.quick_replies).toBeDefined();
  });

  it("GET filters by category", async () => {
    const req = createMockRequest({
      url: "/api/crm/inbox/templates",
      searchParams: { category: "welcome" },
    });
    const res = await getTemplates(req);
    expect(res.status).toBe(200);
  });

  it("POST creates a template", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/templates",
      body: { name: "Test", content: "Hello {{name}}" },
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(200);
  });

  it("POST creates a quick reply", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/templates",
      body: { name: "Greet", content: "Hello!", type: "quick_reply" },
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(200);
  });

  it("POST returns 400 without name or content", async () => {
    const req = createMockRequest({
      method: "POST",
      url: "/api/crm/inbox/templates",
      body: {},
    });
    const res = await createTemplate(req);
    expect(res.status).toBe(400);
  });

  it("PUT updates a template", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/templates",
      body: { id: "tpl1", name: "Updated" },
    });
    const res = await updateTemplate(req);
    expect(res.status).toBe(200);
  });

  it("PUT returns 400 without id", async () => {
    const req = createMockRequest({
      method: "PUT",
      url: "/api/crm/inbox/templates",
      body: { name: "No ID" },
    });
    const res = await updateTemplate(req);
    expect(res.status).toBe(400);
  });

  it("DELETE deletes a template", async () => {
    const req = createMockRequest({
      method: "DELETE",
      url: "/api/crm/inbox/templates",
      searchParams: { id: "tpl1" },
    });
    const res = await deleteTemplate(req);
    expect(res.status).toBe(200);
  });

  it("DELETE deletes a quick reply", async () => {
    const req = createMockRequest({
      method: "DELETE",
      url: "/api/crm/inbox/templates",
      searchParams: { id: "qr1", type: "quick_reply" },
    });
    const res = await deleteTemplate(req);
    expect(res.status).toBe(200);
  });

  it("DELETE returns 400 without id", async () => {
    const req = createMockRequest({ method: "DELETE", url: "/api/crm/inbox/templates" });
    const res = await deleteTemplate(req);
    expect(res.status).toBe(400);
  });
});

describe("Inbox Upload — POST /api/crm/inbox/upload", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 when no file is present", async () => {
    const req = createMockRequest({ method: "POST", url: "/api/crm/inbox/upload" });
    // formData returns empty FormData by default
    const res = await uploadFile(req);
    expect(res.status).toBe(400);
  });
});
