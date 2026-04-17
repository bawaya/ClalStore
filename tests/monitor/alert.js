/* eslint-disable no-console */
/**
 * Layer 5 — Monitor alert.
 * Runs after check.js exits with non-zero status.
 * Sends WhatsApp + email alert to admin.
 */

const YCLOUD_API_KEY = process.env.YCLOUD_API_KEY;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const ALERT_WHATSAPP = process.env.ALERT_WHATSAPP;
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM || "noreply@clalmobile.com";

const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
  ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
  : "";

const TEXT = [
  "🔴 ClalMobile — Hourly monitor detected an issue",
  "",
  `🕒 ${new Date().toISOString()}`,
  runUrl ? `🔗 ${runUrl}` : "",
  "",
  "Something is wrong with production. Check the workflow run for details.",
]
  .filter(Boolean)
  .join("\n");

async function sendWhatsApp() {
  if (!YCLOUD_API_KEY || !ALERT_WHATSAPP) {
    console.log("[alert] yCloud config missing — skipping WhatsApp");
    return;
  }
  try {
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": YCLOUD_API_KEY },
      body: JSON.stringify({
        from: WHATSAPP_PHONE_ID || undefined,
        to: ALERT_WHATSAPP,
        type: "text",
        text: { body: TEXT },
      }),
    });
    console.log(`[alert] WhatsApp sent — status ${res.status}`);
  } catch (err) {
    console.error("[alert] WhatsApp failed:", err.message);
  }
}

async function sendEmail() {
  if (!SENDGRID_API_KEY || !ALERT_EMAIL) {
    console.log("[alert] SendGrid config missing — skipping email");
    return;
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${SENDGRID_API_KEY}` },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ALERT_EMAIL }] }],
        from: { email: SENDGRID_FROM },
        subject: "🔴 ClalMobile — Production monitor failed",
        content: [{ type: "text/plain", value: TEXT }],
      }),
    });
    console.log(`[alert] Email sent — status ${res.status}`);
  } catch (err) {
    console.error("[alert] Email failed:", err.message);
  }
}

async function main() {
  console.log("[alert] Sending monitor alert…");
  await Promise.all([sendWhatsApp(), sendEmail()]);
}

main().catch((err) => {
  console.error("[alert] Fatal:", err);
  process.exit(1);
});
