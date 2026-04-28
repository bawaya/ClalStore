import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readMockOutbound } from "@/lib/outbound-mock";

// Mock the bot/engine and integration config so the module loads without
// touching Supabase or the bot runtime — we only need the WhatsApp senders.
vi.mock("@/lib/bot/engine", () => ({
  processMessage: vi.fn(),
}));
vi.mock("@/lib/integrations/hub", () => ({
  getIntegrationConfig: vi.fn(async () => ({})),
}));

let tempDir: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "wa-guard-"));
  vi.stubEnv("MOCK_OUTBOUND_LOG_DIR", tempDir);
  // Trigger Layer 1 of the guard so every test runs through the mock path.
  vi.stubEnv("MOCK_OUTBOUND", "true");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("YCLOUD_API_KEY", "yc_realProductionKey1234567890");

  // Spy on global fetch so we can assert no real network call happens.
  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ id: "real-id" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
  );
});

afterEach(async () => {
  vi.unstubAllEnvs();
  fetchSpy.mockRestore();
  await fs.rm(tempDir, { recursive: true, force: true });
});

const PHONE = "+972541230123";

describe("lib/bot/whatsapp.ts — guarded senders", () => {
  it("sendWhatsAppText records to JSONL and never touches fetch", async () => {
    const { sendWhatsAppText } = await import("@/lib/bot/whatsapp");
    const result = await sendWhatsAppText(PHONE, "hello world");

    expect(result).toMatchObject({
      success: true,
      mocked: true,
      reason: "mock_outbound_flag",
    });
    expect(result.id).toMatch(/^mock-/);
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("whatsapp");
    expect(entry.to).toBe(PHONE);
    expect(entry.bodyPreview).toBe("hello world");
    expect(entry.meta?.type).toBe("text");
  });

  it("sendWhatsAppButtons records buttons in meta", async () => {
    const { sendWhatsAppButtons } = await import("@/lib/bot/whatsapp");
    const result = await sendWhatsAppButtons(PHONE, "pick one", [
      { id: "yes", title: "Yes" },
      { id: "no", title: "No" },
    ]);

    expect(result.mocked).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("whatsapp");
    expect(entry.meta?.type).toBe("buttons");
    expect(entry.meta?.buttons).toEqual(["yes", "no"]);
  });

  it("sendWhatsAppTemplate records template name + params in meta", async () => {
    const { sendWhatsAppTemplate } = await import("@/lib/bot/whatsapp");
    await sendWhatsAppTemplate(PHONE, "order_confirm", ["#1234", "Mohammed"]);

    expect(fetchSpy).not.toHaveBeenCalled();
    const [entry] = await readMockOutbound();
    expect(entry.meta?.type).toBe("template");
    expect(entry.meta?.templateName).toBe("order_confirm");
    expect(entry.meta?.params).toEqual(["#1234", "Mohammed"]);
  });

  it("sendWhatsAppImage records the image url in meta", async () => {
    const { sendWhatsAppImage } = await import("@/lib/bot/whatsapp");
    await sendWhatsAppImage(PHONE, "https://example.com/x.jpg", "caption");

    expect(fetchSpy).not.toHaveBeenCalled();
    const [entry] = await readMockOutbound();
    expect(entry.meta?.type).toBe("image");
    expect(entry.meta?.imageUrl).toBe("https://example.com/x.jpg");
    expect(entry.meta?.caption).toBe("caption");
  });

  it("sendWhatsAppDocument records filename + url in meta", async () => {
    const { sendWhatsAppDocument } = await import("@/lib/bot/whatsapp");
    await sendWhatsAppDocument(PHONE, "https://example.com/x.pdf", "x.pdf", "see attached");

    expect(fetchSpy).not.toHaveBeenCalled();
    const [entry] = await readMockOutbound();
    expect(entry.meta?.type).toBe("document");
    expect(entry.meta?.documentUrl).toBe("https://example.com/x.pdf");
    expect(entry.meta?.filename).toBe("x.pdf");
  });

  it("returns the same shape across all 5 senders (success/mocked/reason/id/status)", async () => {
    const wa = await import("@/lib/bot/whatsapp");
    const calls = await Promise.all([
      wa.sendWhatsAppText(PHONE, "x"),
      wa.sendWhatsAppButtons(PHONE, "x", [{ id: "a", title: "A" }]),
      wa.sendWhatsAppTemplate(PHONE, "tpl", []),
      wa.sendWhatsAppImage(PHONE, "https://e.com/i.jpg"),
      wa.sendWhatsAppDocument(PHONE, "https://e.com/d.pdf", "d.pdf"),
    ]);

    for (const r of calls) {
      expect(r).toMatchObject({
        success: true,
        mocked: true,
        reason: "mock_outbound_flag",
        status: "sent",
      });
      expect(typeof r.id).toBe("string");
      expect(r.id.startsWith("mock-")).toBe(true);
    }
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe("lib/bot/whatsapp.ts — caller smoke tests", () => {
  it("notifyAdmin → sendWhatsAppTemplate path goes through the mock", async () => {
    // admin-notify.ts is imported by notifications, sales-requests, etc.
    // Its notifyAdmin wraps sendWhatsAppTemplate. In mock mode the wrapper
    // must complete without throwing AND without a real fetch.
    vi.stubEnv("ADMIN_PERSONAL_PHONE", "+972541230123");
    const { notifyAdmin } = await import("@/lib/bot/admin-notify");

    await expect(notifyAdmin("test admin message")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
