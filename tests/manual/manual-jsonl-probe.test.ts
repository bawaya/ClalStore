// Manual smoke probe — writes to the REAL logs/outbound/<date>.jsonl
// instead of a tempdir, so a developer can `cat` the file afterwards
// to see what would have been sent. Skipped in CI by filename
// convention (suite filter excludes tests/manual/).

import { describe, it, expect, beforeAll, vi } from "vitest";

vi.mock("@/lib/integrations/hub", () => ({
  getIntegrationConfig: vi.fn(async () => ({})),
}));
vi.mock("@/lib/bot/engine", () => ({ processMessage: vi.fn() }));

beforeAll(() => {
  vi.stubEnv("MOCK_OUTBOUND", "true");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("YCLOUD_API_KEY", "yc_realKey1234567890");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_realSid1234567890");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "real_auth_token");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_realSid");
  vi.stubEnv("TWILIO_FROM_NUMBER", "+972541230000");
  // Note: MOCK_OUTBOUND_LOG_DIR intentionally NOT stubbed — writes to
  // the project's real logs/outbound/<date>.jsonl path.
});

describe("manual JSONL probe (writes to real logs/outbound/)", () => {
  it("exercises every channel so a developer can cat the file", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const wa = await import("@/lib/bot/whatsapp");
    const twilio = await import("@/lib/integrations/twilio-sms");
    const tpl = await import("@/lib/integrations/ycloud-templates");

    await wa.sendWhatsAppText("+972541230123", "إشعار طلب — رقم ORD-9876");
    await wa.sendWhatsAppTemplate("+972541230123", "order_confirm", [
      "ORD-9876",
      "محمد",
    ]);
    await twilio.sendSMSOtp("+972541230123", "1234");
    await tpl.createTemplate({
      name: "manual_probe_tpl",
      category: "UTILITY",
      language: "ar",
      components: [{ type: "BODY", text: "test" }],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});
