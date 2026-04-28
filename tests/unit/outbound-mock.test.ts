import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  recordMockOutbound,
  readMockOutbound,
  clearMockOutbound,
} from "@/lib/outbound-mock";

let tempDir: string;
let originalDir: string | undefined;

beforeEach(async () => {
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "outbound-mock-"));
  originalDir = process.env.MOCK_OUTBOUND_LOG_DIR;
  process.env.MOCK_OUTBOUND_LOG_DIR = tempDir;
});

afterEach(async () => {
  if (originalDir === undefined) delete process.env.MOCK_OUTBOUND_LOG_DIR;
  else process.env.MOCK_OUTBOUND_LOG_DIR = originalDir;
  await fs.rm(tempDir, { recursive: true, force: true });
});

describe("recordMockOutbound", () => {
  it("appends a JSONL line and returns success/mocked", async () => {
    const result = await recordMockOutbound({
      channel: "email",
      reason: "mock_outbound_flag",
      to: "test@example.com",
      subject: "Order #123",
      bodyPreview: "<html>…</html>",
    });

    expect(result).toEqual({
      success: true,
      mocked: true,
      reason: "mock_outbound_flag",
    });

    const entries = await readMockOutbound();
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      channel: "email",
      reason: "mock_outbound_flag",
      to: "test@example.com",
      subject: "Order #123",
    });
    expect(entries[0].ts).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("appends multiple entries to the same daily file", async () => {
    await recordMockOutbound({
      channel: "sms",
      reason: "non_production_no_escape_hatch",
      to: "+972541234567",
      subject: null,
      bodyPreview: "Your OTP is 1234",
    });
    await recordMockOutbound({
      channel: "whatsapp",
      reason: "suspicious_api_key",
      to: "+972541234567",
      subject: null,
      bodyPreview: "Welcome to ClalMobile",
    });

    const entries = await readMockOutbound();
    expect(entries).toHaveLength(2);
    expect(entries[0].channel).toBe("sms");
    expect(entries[1].channel).toBe("whatsapp");
  });

  it("truncates very long bodies in the preview field", async () => {
    const longBody = "a".repeat(1000);
    await recordMockOutbound({
      channel: "email",
      reason: "mock_outbound_flag",
      to: "test@example.com",
      subject: "Big",
      bodyPreview: longBody,
    });

    const [entry] = await readMockOutbound();
    expect(entry.bodyPreview.length).toBeLessThan(longBody.length);
    expect(entry.bodyPreview.endsWith("[truncated]")).toBe(true);
  });

  it("preserves arbitrary meta fields in the JSONL", async () => {
    await recordMockOutbound({
      channel: "whatsapp",
      reason: "mock_outbound_flag",
      to: "+972541234567",
      subject: null,
      bodyPreview: "tpl render",
      meta: { templateName: "order_confirm", params: ["#123"] },
    });

    const [entry] = await readMockOutbound();
    expect(entry.meta).toEqual({
      templateName: "order_confirm",
      params: ["#123"],
    });
  });
});

describe("readMockOutbound", () => {
  it("returns [] when no log file exists yet", async () => {
    const entries = await readMockOutbound();
    expect(entries).toEqual([]);
  });
});

describe("clearMockOutbound", () => {
  it("removes today's log file", async () => {
    await recordMockOutbound({
      channel: "email",
      reason: "mock_outbound_flag",
      to: "x@y.com",
      subject: "s",
      bodyPreview: "b",
    });
    expect((await readMockOutbound()).length).toBe(1);

    await clearMockOutbound();
    expect(await readMockOutbound()).toEqual([]);
  });

  it("is a no-op when the file does not exist", async () => {
    await expect(clearMockOutbound()).resolves.not.toThrow();
  });
});
