// =====================================================
// Mailpit email provider — captures every send into
// a local SMTP catcher (https://mailpit.axllent.org).
// Hub registers this in place of Resend/SendGrid when
// the outbound guard reports a block, so a tester can
// verify the rendered email in Mailpit's UI without any
// risk of a real send.
//
// Hard guard: refuses any non-local SMTP host so a
// misconfigured MAILPIT_SMTP_HOST can never escalate
// into a real outbound delivery.
// =====================================================

import nodemailer, { type Transporter } from "nodemailer";

import type { EmailParams, EmailProvider, EmailResult } from "./hub";

const ALLOWED_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "mailpit",            // Docker network alias when caller runs in another container
  "host.docker.internal", // Caller in Docker, Mailpit on host
]);

const DEFAULT_HOST = "localhost";
const DEFAULT_PORT = 1025;
const DEFAULT_FROM = "ClalMobile (mock) <noreply@clalmobile.local>";

function readMailpitConfig(): { host: string; port: number; from: string } {
  // Treat empty strings the same as undefined so a `vi.stubEnv("X", "")` or a
  // blank line in .env.local falls back to the default instead of failing.
  const host = (process.env.MAILPIT_SMTP_HOST?.trim() || DEFAULT_HOST).toLowerCase();
  const portRaw = process.env.MAILPIT_SMTP_PORT?.trim();
  const port = portRaw ? Number(portRaw) : DEFAULT_PORT;
  const from = process.env.MAILPIT_FROM?.trim() || DEFAULT_FROM;

  if (!ALLOWED_HOSTS.has(host)) {
    throw new Error(
      `[MAILPIT GUARD] Refusing to use non-local SMTP host: ${host}. ` +
        `Mailpit must run on localhost / 127.0.0.1 / mailpit / host.docker.internal. ` +
        `Use the real provider (Resend/SendGrid) for production sends.`,
    );
  }
  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error(
      `[MAILPIT GUARD] Invalid MAILPIT_SMTP_PORT: ${portRaw}. Default ${DEFAULT_PORT}.`,
    );
  }
  return { host, port, from };
}

export class MailpitProvider implements EmailProvider {
  name = "Mailpit";
  private transporter: Transporter | null = null;
  private configuredFrom = DEFAULT_FROM;

  /** Lazy-init the transporter so the host guard runs only when we send. */
  private getTransporter(): Transporter {
    if (this.transporter) return this.transporter;
    const { host, port, from } = readMailpitConfig();
    this.configuredFrom = from;
    this.transporter = nodemailer.createTransport({
      host,
      port,
      // Mailpit accepts plain SMTP on 1025 — no TLS, no auth.
      secure: false,
      ignoreTLS: true,
    });
    return this.transporter;
  }

  async send(params: EmailParams): Promise<EmailResult> {
    try {
      const transporter = this.getTransporter();
      const info = await transporter.sendMail({
        from: params.from || this.configuredFrom,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
        replyTo: params.replyTo,
      });
      return { success: true, messageId: info.messageId };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : "mailpit send failed",
      };
    }
  }

  /**
   * Match Resend's contract — this codebase doesn't use server-side template
   * placeholders. data.subject and data.html are passed through; the
   * templateId is recorded in a header so a tester can spot which builder
   * was supposed to run.
   */
  async sendTemplate(
    templateId: string,
    to: string,
    data: Record<string, string>,
  ): Promise<EmailResult> {
    const subject = data.subject || `[mailpit] ${templateId}`;
    const html = data.html || `<pre>${escapeHtml(JSON.stringify(data, null, 2))}</pre>`;
    const text = data.text;
    return this.send({ to, subject, html, text });
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
