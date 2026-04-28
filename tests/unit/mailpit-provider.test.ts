import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Capture every nodemailer.createTransport call and let each test assert on
// the config + the sendMail body. We mock at module boundary so no real
// network connection is ever attempted. vi.hoisted is required because
// vi.mock factories run before regular const initialisers.
const { sendMailMock, createTransportMock } = vi.hoisted(() => {
  const sendMailMock = vi.fn();
  const createTransportMock = vi.fn(() => ({ sendMail: sendMailMock }));
  return { sendMailMock, createTransportMock };
});

vi.mock("nodemailer", () => ({
  default: {
    createTransport: createTransportMock,
  },
  createTransport: createTransportMock,
}));

import { MailpitProvider } from "@/lib/integrations/mailpit";

beforeEach(() => {
  sendMailMock.mockReset();
  createTransportMock.mockClear();
  vi.stubEnv("MAILPIT_SMTP_HOST", "");
  vi.stubEnv("MAILPIT_SMTP_PORT", "");
  vi.stubEnv("MAILPIT_FROM", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("MailpitProvider — host whitelist guard", () => {
  it.each([
    ["localhost"],
    ["127.0.0.1"],
    ["mailpit"],
    ["host.docker.internal"],
  ])("accepts allowed host: %s", async (host) => {
    vi.stubEnv("MAILPIT_SMTP_HOST", host);
    sendMailMock.mockResolvedValueOnce({ messageId: "<id-123>" });

    const provider = new MailpitProvider();
    const result = await provider.send({
      to: "user@example.com",
      subject: "ok",
      html: "<p>hi</p>",
    });

    expect(result.success).toBe(true);
    expect(createTransportMock).toHaveBeenCalledWith(
      expect.objectContaining({ host, port: 1025 }),
    );
  });

  it("refuses non-local SMTP hosts (production-looking domain)", async () => {
    vi.stubEnv("MAILPIT_SMTP_HOST", "smtp.real-server.com");

    const provider = new MailpitProvider();
    const result = await provider.send({
      to: "user@example.com",
      subject: "x",
      html: "<p>x</p>",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/MAILPIT GUARD/);
    expect(result.error).toMatch(/smtp\.real-server\.com/);
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it("refuses an obviously malicious host (e.g. AWS endpoint)", async () => {
    vi.stubEnv("MAILPIT_SMTP_HOST", "email-smtp.us-east-1.amazonaws.com");

    const provider = new MailpitProvider();
    const result = await provider.send({
      to: "x@y.com",
      subject: "s",
      html: "h",
    });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/MAILPIT GUARD/);
  });

  it("normalises host case (LOCALHOST → localhost)", async () => {
    vi.stubEnv("MAILPIT_SMTP_HOST", "LOCALHOST");
    sendMailMock.mockResolvedValueOnce({ messageId: "<id-1>" });

    const provider = new MailpitProvider();
    const result = await provider.send({
      to: "user@example.com",
      subject: "ok",
      html: "<p>hi</p>",
    });

    expect(result.success).toBe(true);
  });

  it("refuses an out-of-range port", async () => {
    vi.stubEnv("MAILPIT_SMTP_HOST", "localhost");
    vi.stubEnv("MAILPIT_SMTP_PORT", "999999");

    const provider = new MailpitProvider();
    const result = await provider.send({
      to: "x@y.com",
      subject: "s",
      html: "h",
    });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Invalid MAILPIT_SMTP_PORT/);
  });
});

describe("MailpitProvider — send / sendTemplate", () => {
  it("forwards subject + html + text to nodemailer", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "<id-42>" });
    const provider = new MailpitProvider();
    await provider.send({
      to: "user@example.com",
      subject: "Test subject",
      html: "<p>HTML body</p>",
      text: "Plain body",
      replyTo: "support@example.com",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "user@example.com",
        subject: "Test subject",
        html: "<p>HTML body</p>",
        text: "Plain body",
        replyTo: "support@example.com",
      }),
    );
  });

  it("uses the configured MAILPIT_FROM by default", async () => {
    vi.stubEnv("MAILPIT_FROM", "QA Bot <qa@clalmobile.local>");
    sendMailMock.mockResolvedValueOnce({ messageId: "<id-1>" });

    const provider = new MailpitProvider();
    await provider.send({
      to: "user@example.com",
      subject: "s",
      html: "h",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({ from: "QA Bot <qa@clalmobile.local>" }),
    );
  });

  it("returns the same { success, messageId } shape Resend/SendGrid return", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "<abcd>" });
    const provider = new MailpitProvider();
    const result = await provider.send({ to: "u@e.com", subject: "s", html: "h" });

    expect(result).toMatchObject({ success: true, messageId: "<abcd>" });
    // The interface keys must exist (and only those keys when successful)
    expect(Object.keys(result).sort()).toEqual(["messageId", "success"]);
  });

  it("returns { success: false, error } when sendMail throws", async () => {
    sendMailMock.mockRejectedValueOnce(new Error("ECONNREFUSED 1025"));
    const provider = new MailpitProvider();
    const result = await provider.send({ to: "u@e.com", subject: "s", html: "h" });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/ECONNREFUSED/);
  });

  it("sendTemplate falls back to data.html / data.subject (Resend-compatible)", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "<id-tpl>" });
    const provider = new MailpitProvider();
    await provider.sendTemplate("order_confirm", "user@example.com", {
      subject: "Order #123",
      html: "<h1>Thanks!</h1>",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Order #123",
        html: "<h1>Thanks!</h1>",
      }),
    );
  });

  it("sendTemplate falls back to a JSON dump when no html/subject provided", async () => {
    sendMailMock.mockResolvedValueOnce({ messageId: "<id-fallback>" });
    const provider = new MailpitProvider();
    await provider.sendTemplate("welcome", "user@example.com", {
      customer_name: "Mohammed",
    });

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "[mailpit] welcome",
        html: expect.stringContaining("customer_name"),
      }),
    );
  });
});
