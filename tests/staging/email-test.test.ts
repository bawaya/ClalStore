/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Layer 3 — Email provider smoke test.
 *
 * Skips unless `EMAIL_TEST_ADDRESS` is set, so we never send to a real
 * customer by accident. Tries SendGrid first (if `SENDGRID_API_KEY` is
 * configured), then Resend (`RESEND_API_KEY`).
 *
 * Only asserts 2xx from the provider — does NOT verify actual delivery.
 */
import { describe, it, expect } from "vitest";
import { TEST_PREFIX } from "./setup";

const EMAIL_TO = process.env.EMAIL_TEST_ADDRESS;
const SENDGRID = process.env.SENDGRID_API_KEY;
const RESEND = process.env.RESEND_API_KEY;

const localSkip = !EMAIL_TO
  ? "EMAIL_TEST_ADDRESS not set"
  : !SENDGRID && !RESEND
    ? "no email provider API key set"
    : null;

describe.skipIf(localSkip)("Layer 3 · Email (real provider)", () => {
  it("sends a plaintext email and gets a 2xx", async () => {
    const to = EMAIL_TO!;
    const subject = `${TEST_PREFIX}staging smoke ${new Date().toISOString()}`;
    const text = `${TEST_PREFIX}This is an automated staging test. No action needed.`;

    if (SENDGRID) {
      const fromEmail = process.env.SENDGRID_FROM || "noreply@clalmobile.com";
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${SENDGRID}`,
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: to }] }],
          from: { email: fromEmail, name: "ClalMobile Staging" },
          subject,
          content: [{ type: "text/plain", value: text }],
        }),
      });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      return;
    }

    if (RESEND) {
      const fromEmail =
        process.env.RESEND_FROM || "ClalMobile <noreply@clalmobile.com>";
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND}`,
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [to],
          subject,
          text,
        }),
      });
      expect(res.status).toBeGreaterThanOrEqual(200);
      expect(res.status).toBeLessThan(300);
      return;
    }

    throw new Error("unreachable — no email provider configured");
  });
});
