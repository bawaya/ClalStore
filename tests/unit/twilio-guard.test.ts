import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import { readMockOutbound } from "@/lib/outbound-mock";

vi.mock("@/lib/integrations/hub", () => ({
  getIntegrationConfig: vi.fn(async () => ({})),
}));

let tempDir: string;
let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "twilio-guard-"));
  vi.stubEnv("MOCK_OUTBOUND_LOG_DIR", tempDir);
  vi.stubEnv("MOCK_OUTBOUND", "true");
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("TWILIO_ACCOUNT_SID", "AC_realProductionSid1234567890");
  vi.stubEnv("TWILIO_AUTH_TOKEN", "real_auth_token_xyz");
  vi.stubEnv("TWILIO_VERIFY_SERVICE_SID", "VA_realProductionSid");
  vi.stubEnv("TWILIO_FROM_NUMBER", "+972541230000");
  vi.stubEnv("MOCK_TWILIO_VERIFY_RESULT", "");

  fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ sid: "REAL_SID", status: "approved" }), {
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

describe("twilio-sms — startTwilioVerification", () => {
  it("records intent and returns success without fetch", async () => {
    const { startTwilioVerification } = await import("@/lib/integrations/twilio-sms");
    const result = await startTwilioVerification(PHONE, "sms");

    expect(result).toEqual({ success: true });
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("sms");
    expect(entry.to).toBe(PHONE);
    expect(entry.meta?.type).toBe("verify_start");
    expect(entry.meta?.channel).toBe("sms");
  });
});

describe("twilio-sms — checkTwilioVerification", () => {
  it("returns success when MOCK_TWILIO_VERIFY_RESULT defaults to approved", async () => {
    const { checkTwilioVerification } = await import("@/lib/integrations/twilio-sms");
    const result = await checkTwilioVerification(PHONE, "1234");

    expect(result.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.meta?.type).toBe("verify_check");
    expect(entry.meta?.mockStatus).toBe("approved");
  });

  it("returns failure when MOCK_TWILIO_VERIFY_RESULT=denied", async () => {
    vi.stubEnv("MOCK_TWILIO_VERIFY_RESULT", "denied");
    const { checkTwilioVerification } = await import("@/lib/integrations/twilio-sms");
    const result = await checkTwilioVerification(PHONE, "9999");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/denied/);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("ignores invalid MOCK_TWILIO_VERIFY_RESULT values and falls back to approved", async () => {
    vi.stubEnv("MOCK_TWILIO_VERIFY_RESULT", "totally_made_up");
    const { checkTwilioVerification } = await import("@/lib/integrations/twilio-sms");
    const result = await checkTwilioVerification(PHONE, "1234");

    expect(result.success).toBe(true);
    const [entry] = await readMockOutbound();
    expect(entry.meta?.mockStatus).toBe("approved");
  });

  it.each([
    ["pending", false],
    ["canceled", false],
    ["error", false],
  ])("MOCK_TWILIO_VERIFY_RESULT=%s → success=%s", async (status, expected) => {
    vi.stubEnv("MOCK_TWILIO_VERIFY_RESULT", status);
    const { checkTwilioVerification } = await import("@/lib/integrations/twilio-sms");
    const result = await checkTwilioVerification(PHONE, "1234");
    expect(result.success).toBe(expected);
  });
});

describe("twilio-sms — TwilioSMSProvider.send (raw SMS)", () => {
  it("records intent and returns mock SID without fetch", async () => {
    const { TwilioSMSProvider } = await import("@/lib/integrations/twilio-sms");
    const provider = new TwilioSMSProvider();
    const result = await provider.send(PHONE, "Your code is 1234");

    expect(result.success).toBe(true);
    expect(result.sid).toMatch(/^SM_mock_/);
    expect(fetchSpy).not.toHaveBeenCalled();

    const [entry] = await readMockOutbound();
    expect(entry.channel).toBe("sms");
    expect(entry.bodyPreview).toBe("Your code is 1234");
    expect(entry.meta?.type).toBe("raw_sms");
  });

  it("sendSMSOtp wrapper goes through the same mock path (one JSONL entry)", async () => {
    const { sendSMSOtp } = await import("@/lib/integrations/twilio-sms");
    const result = await sendSMSOtp(PHONE, "9876");

    expect(result.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    const entries = await readMockOutbound();
    // Wrapper calls provider.send once → exactly one entry, no double-record.
    expect(entries).toHaveLength(1);
    expect(entries[0].bodyPreview).toMatch(/9876/);
  });
});
