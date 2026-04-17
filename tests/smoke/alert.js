/* eslint-disable no-console */
/**
 * Production smoke-test alert script.
 * Runs via GitHub Actions when smoke tests fail.
 *
 * Sends a WhatsApp message (yCloud) and an email (SendGrid) to the admin
 * with failure details and a link to the failed workflow.
 *
 * This is the ONLY script that sends real outbound messages — and only
 * when a failure has actually occurred.
 */

const YCLOUD_API_KEY = process.env.YCLOUD_API_KEY;
const ALERT_WHATSAPP = process.env.ALERT_WHATSAPP;
const WHATSAPP_PHONE_ID = process.env.WHATSAPP_PHONE_ID || "";
const ALERT_EMAIL = process.env.ALERT_EMAIL;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const SENDGRID_FROM = process.env.SENDGRID_FROM || "noreply@clalmobile.com";

const CONTEXT = {
  repo: process.env.GITHUB_REPOSITORY || "clalmobile",
  runId: process.env.GITHUB_RUN_ID || "",
  runUrl: process.env.GITHUB_SERVER_URL && process.env.GITHUB_REPOSITORY && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : "",
  workflow: process.env.GITHUB_WORKFLOW || "Smoke Tests",
  when: new Date().toISOString(),
};

const TEXT = [
  "🔴 ClalMobile — Production smoke test FAILED",
  "",
  `⚙️  Workflow: ${CONTEXT.workflow}`,
  `🕒 Time: ${CONTEXT.when}`,
  `🔗 Details: ${CONTEXT.runUrl}`,
  "",
  "Please check the workflow logs for what broke.",
].join("\n");

async function sendWhatsApp() {
  if (!YCLOUD_API_KEY || !ALERT_WHATSAPP) {
    console.log("[alert] yCloud config missing — skipping WhatsApp alert");
    return;
  }
  try {
    const res = await fetch("https://api.ycloud.com/v2/whatsapp/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": YCLOUD_API_KEY,
      },
      body: JSON.stringify({
        from: WHATSAPP_PHONE_ID || undefined,
        to: ALERT_WHATSAPP,
        type: "text",
        text: { body: TEXT },
      }),
    });
    console.log(`[alert] WhatsApp sent — status ${res.status}`);
  } catch (err) {
    console.error("[alert] WhatsApp send failed:", err.message);
  }
}

async function sendEmail() {
  if (!SENDGRID_API_KEY || !ALERT_EMAIL) {
    console.log("[alert] SendGrid config missing — skipping email alert");
    return;
  }
  try {
    const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SENDGRID_API_KEY}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: ALERT_EMAIL }] }],
        from: { email: SENDGRID_FROM },
        subject: "🔴 ClalMobile — Production smoke test FAILED",
        content: [
          { type: "text/plain", value: TEXT },
          {
            type: "text/html",
            value: `
              <h2 style="color:#dc2626">🔴 ClalMobile — Production smoke test FAILED</h2>
              <p><strong>Workflow:</strong> ${CONTEXT.workflow}</p>
              <p><strong>Time:</strong> ${CONTEXT.when}</p>
              <p><strong>Run:</strong> <a href="${CONTEXT.runUrl}">${CONTEXT.runUrl}</a></p>
              <p>Please check the workflow logs for what broke.</p>
            `,
          },
        ],
      }),
    });
    console.log(`[alert] Email sent — status ${res.status}`);
  } catch (err) {
    console.error("[alert] Email send failed:", err.message);
  }
}

async function main() {
  console.log("[alert] Sending production smoke-test failure alert…");
  console.log(TEXT);
  await Promise.all([sendWhatsApp(), sendEmail()]);
}

main().catch((err) => {
  console.error("[alert] Fatal:", err);
  process.exit(1);
});
