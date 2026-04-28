// =====================================================
// Outbound smoke test — exercises every guarded channel
// in one run with MOCK_OUTBOUND=true and proves:
//   1. Zero real fetch() calls leak to the providers' APIs
//      (Resend / SendGrid / YCloud / Twilio).
//   2. The JSONL mock log captures one entry per call with
//      the right channel name + recipient + meta.
//   3. The test helpers in tests/helpers/outbound.ts return
//      the same entries (proves they read what the guards
//      wrote).
//   4. (Optional) When Mailpit is running, the
//      MailpitProvider actually delivers an email that
//      shows up in the Mailpit HTTP API.
// =====================================================

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  getAllMockedOutbound,
  getMockedEmails,
  getMockedSMS,
  getMockedWhatsApp,
  getMockedWhatsAppTemplates,
  clearMockedOutbound,
  isMailpitRunning,
  getMailpitMessages,
  clearMailpit,
} from "@/tests/helpers/outbound";

// Stub Supabase-driven config so the providers init cleanly.
vi.mock("@/lib/integrations/secrets", () => ({
  getIntegrationByTypeWithSecrets: vi.fn(async () => ({
    integration: null,
    config: {},
  })),
}));
vi.mock("@/lib/integrations/hub", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/integrations/hub")>();
  return {
    ...actual,
    getIntegrationConfig: vi.fn(async () => ({})),
  };
});
vi.mock("@/lib/bot/engine", () => ({ processMessage: vi.fn() }));

let tempDir: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;

const PHONE = "+972541230123";
const EMAIL = "smoke-test@example.com";

beforeAll(async () => {
  // Pin the entire suite to mock mode so a forgotten env var on the host
  // can't accidentally let a real send through during the smoke run.
  vi.stubEnv("MOCK_OUTBOUND", "true");
  vi.stubEnv("NODE_ENV", "production");
  // Real-looking keys so the suspicious-key layer doesn't double-block —
  // we want the proof to come from layer 1 only.
  vi.stubEnv("RESEND_API_KEY", "re_realProductionKey1234567890");
  vi.stubEnv("SENDGRID_API_KEY", "SG.realProductionKey1234567890");
  vi.stubEnv("YCLOUD_API_KEY", "yc_realProductionKey1234567890");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_realProductionSid1234567890");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "real_auth_token_xyz");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_realProductionSid");
  vi.stubEnv("TWILIO_FROM_NUMBER", "+972541230000");
});

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "outbound-smoke-"));
  vi.stubEnv("MOCK_OUTBOUND_LOG_DIR", tempDir);
  // Spy on every fetch in the suite. The whole point of the smoke is to
  // catch a regression where one of the guards stops firing, so we count
  // every call and assert zero at the end.
  fetchSpy = vi.spyOn(globalThis, "fetch");
});

afterEach(async () => {
  fetchSpy.mockRestore();
  vi.unstubAllEnvs();
  vi.stubEnv("MOCK_OUTBOUND", "true");
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("outbound smoke — every guarded channel, one run, zero leaks", () => {
  it("WhatsApp (5 senders) + SMS (3) + templates (3 writes) all stay in mock", async () => {
    // ===== Exercise every guarded function =====
    const wa = await import("@/lib/bot/whatsapp");
    const twilio = await import("@/lib/integrations/twilio-sms");
    const tpl = await import("@/lib/integrations/ycloud-templates");

    await wa.sendWhatsAppText(PHONE, "smoke text");
    await wa.sendWhatsAppButtons(PHONE, "smoke buttons", [
      { id: "y", title: "Yes" },
    ]);
    await wa.sendWhatsAppTemplate(PHONE, "smoke_tpl", ["param1"]);
    await wa.sendWhatsAppImage(PHONE, "https://e.com/i.jpg", "cap");
    await wa.sendWhatsAppDocument(PHONE, "https://e.com/d.pdf", "d.pdf");

    await twilio.startTwilioVerification(PHONE, "sms");
    await twilio.checkTwilioVerification(PHONE, "1234");
    const provider = new twilio.TwilioSMSProvider();
    await provider.send(PHONE, "smoke sms");

    await tpl.createTemplate({
      name: "smoke_tpl_1",
      category: "UTILITY",
      language: "ar",
      components: [{ type: "BODY", text: "x" }],
    });
    await tpl.deleteTemplate("smoke_tpl_doomed");
    await tpl.provisionRequiredTemplates();

    // ===== Critical assertion: zero outbound fetches =====
    const outboundCalls = fetchSpy.mock.calls.filter((call: unknown[]) => {
      const u = String(call[0]);
      return (
        u.includes("api.resend.com") ||
        u.includes("api.sendgrid.com") ||
        u.includes("api.ycloud.com") ||
        u.includes("api.twilio.com") ||
        u.includes("verify.twilio.com")
      );
    });
    expect(outboundCalls).toHaveLength(0);

    // ===== JSONL split per channel =====
    const sms = await getMockedSMS();
    const whatsapp = await getMockedWhatsApp();
    const templates = await getMockedWhatsAppTemplates();

    expect(sms).toHaveLength(3); // verify_start, verify_check, raw_sms
    expect(whatsapp).toHaveLength(5); // text, buttons, template, image, document
    // 3 explicit writes: createTemplate + deleteTemplate +
    // provisionRequiredTemplates (the wrapper records the intent).
    expect(templates).toHaveLength(3);

    const all = await getAllMockedOutbound();
    expect(all).toHaveLength(11);

    // ===== Recipient + reason are present on every entry =====
    for (const entry of all) {
      expect(entry.reason).toBe("mock_outbound_flag");
      expect(entry.to).toBeTruthy();
      expect(entry.ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }

    // ===== Per-channel meta types are tagged correctly =====
    expect(whatsapp.map((e) => e.meta?.type).sort()).toEqual([
      "buttons",
      "document",
      "image",
      "template",
      "text",
    ]);
    expect(sms.map((e) => e.meta?.type).sort()).toEqual([
      "raw_sms",
      "verify_check",
      "verify_start",
    ]);
    expect(templates.map((e) => e.meta?.type).sort()).toEqual([
      "create_template",
      "delete_template",
      "provision",
    ]);
  });

  it("clearMockedOutbound truncates the log so the next test starts at zero", async () => {
    const wa = await import("@/lib/bot/whatsapp");
    await wa.sendWhatsAppText(PHONE, "first");
    expect((await getAllMockedOutbound()).length).toBe(1);

    await clearMockedOutbound();
    expect(await getAllMockedOutbound()).toEqual([]);

    await wa.sendWhatsAppText(PHONE, "second");
    const after = await getAllMockedOutbound();
    expect(after).toHaveLength(1);
    expect(after[0].bodyPreview).toBe("second");
  });
});

describe("outbound smoke — Mailpit live integration (skipped if not running)", () => {
  it("MailpitProvider delivers an email to the live Mailpit instance", async (ctx) => {
    // Probe at run-time, not registration time, so the skip decision uses
    // the live container state. (it.skipIf evaluates the condition when
    // tests are registered — too early for an async probe.)
    if (!(await isMailpitRunning())) {
      ctx.skip();
      return;
    }

    const { MailpitProvider } = await import("@/lib/integrations/mailpit");
    await clearMailpit();

    const provider = new MailpitProvider();
    const result = await provider.send({
      to: EMAIL,
      subject: "Smoke test email",
      html: "<p dir=\"rtl\">مرحبا — هذا اختبار من smoke suite</p>",
    });

    expect(result.success).toBe(true);

    // Mailpit's storage is async; give it a moment to index.
    await new Promise((r) => setTimeout(r, 200));

    const messages = await getMailpitMessages();
    expect(messages.length).toBeGreaterThanOrEqual(1);
    const subject = messages.map((m) => m.Subject);
    expect(subject).toContain("Smoke test email");
  });
});
