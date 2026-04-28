// =====================================================
// ClalMobile — yCloud WhatsApp Client (Season 5)
// Send/receive via yCloud + new engine integration
// =====================================================

import { processMessage, type BotResponse } from "./engine";
import { getIntegrationConfig } from "@/lib/integrations/hub";
import { isOutboundBlocked } from "@/lib/outbound-guard";
import { recordMockOutbound } from "@/lib/outbound-mock";

const YCLOUD_API = "https://api.ycloud.com/v2";

/**
 * Mock send result returned when the outbound guard blocks a YCloud call.
 * Includes the YCloud-style `id` field so callers like
 * app/api/crm/inbox/[id]/send/route.ts that capture `result?.id` keep
 * working without modification.
 */
function mockWhatsAppResult(reason: string) {
  return {
    success: true,
    mocked: true,
    reason,
    id: `mock-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    status: "sent",
  };
}

/** Read yCloud credentials — DB first, env fallback */
async function getYCloudConfig() {
  const dbCfg = await getIntegrationConfig("whatsapp");
  const apiKey = dbCfg.api_key || process.env.YCLOUD_API_KEY || "";
  const phoneId = dbCfg.phone_id || process.env.WHATSAPP_PHONE_ID || "";
  if (!apiKey) throw new Error("YCLOUD_API_KEY not set");
  return { apiKey, phoneId };
}

/** Build yCloud API headers */
async function getHeaders() {
  const { apiKey } = await getYCloudConfig();
  return {
    "Content-Type": "application/json",
    "X-API-Key": apiKey,
  };
}

/** Get the WhatsApp sender phone ID */
async function getFromPhone() {
  const { phoneId } = await getYCloudConfig();
  return phoneId;
}

// ===== Normalize Israeli Phone =====
export function normalizePhone(phone: string): string {
  let clean = phone.replace(/[-\s()]/g, "");
  if (clean.startsWith("05")) clean = "+972" + clean.slice(1);
  if (clean.startsWith("9725")) clean = "+" + clean;
  if (!clean.startsWith("+")) clean = "+" + clean;
  return clean;
}

// ===== Send Text Message =====
export async function sendWhatsAppText(to: string, text: string, fromOverride?: string) {
  const phone = normalizePhone(to);
  const guard = isOutboundBlocked("whatsapp");
  if (guard.blocked && guard.reason) {
    await recordMockOutbound({
      channel: "whatsapp",
      reason: guard.reason,
      to: phone,
      subject: null,
      bodyPreview: text,
      meta: { type: "text", fromOverride: fromOverride || null },
    });
    return mockWhatsAppResult(guard.reason);
  }
  const headers = await getHeaders();
  const from = fromOverride || await getFromPhone();
  const res = await fetch(`${YCLOUD_API}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: phone,
      type: "text",
      text: { body: text },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("yCloud send error:", err);
    throw new Error(`yCloud error: ${res.status}`);
  }

  return res.json();
}

// ===== Send Interactive Buttons =====
export async function sendWhatsAppButtons(
  to: string,
  bodyText: string,
  buttons: { id: string; title: string }[]
) {
  const phone = normalizePhone(to);
  const guard = isOutboundBlocked("whatsapp");
  if (guard.blocked && guard.reason) {
    await recordMockOutbound({
      channel: "whatsapp",
      reason: guard.reason,
      to: phone,
      subject: null,
      bodyPreview: bodyText,
      meta: { type: "buttons", buttons: buttons.map((b) => b.id) },
    });
    return mockWhatsAppResult(guard.reason);
  }
  const headers = await getHeaders();
  const from = await getFromPhone();
  const res = await fetch(`${YCLOUD_API}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: phone,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.slice(0, 3).map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title.slice(0, 20) },
          })),
        },
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("yCloud buttons error:", err);
  }

  return res.json();
}

// ===== Send Template =====
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  params: string[]
) {
  const phone = normalizePhone(to);
  const guard = isOutboundBlocked("whatsapp");
  if (guard.blocked && guard.reason) {
    await recordMockOutbound({
      channel: "whatsapp",
      reason: guard.reason,
      to: phone,
      subject: null,
      bodyPreview: `[template: ${templateName}] params=${JSON.stringify(params)}`,
      meta: { type: "template", templateName, params },
    });
    return mockWhatsAppResult(guard.reason);
  }
  const headers = await getHeaders();
  const from = await getFromPhone();
  const res = await fetch(`${YCLOUD_API}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: phone,
      type: "template",
      template: {
        name: templateName,
        language: { code: "ar" },
        components: [
          {
            type: "body",
            parameters: params.map((p) => ({ type: "text", text: p })),
          },
        ],
      },
    }),
  });

  return res.json();
}

// ===== Send Image Message =====
export async function sendWhatsAppImage(
  to: string,
  imageUrl: string,
  caption?: string
) {
  const phone = normalizePhone(to);
  const guard = isOutboundBlocked("whatsapp");
  if (guard.blocked && guard.reason) {
    await recordMockOutbound({
      channel: "whatsapp",
      reason: guard.reason,
      to: phone,
      subject: null,
      bodyPreview: caption || `[image: ${imageUrl}]`,
      meta: { type: "image", imageUrl, caption: caption || null },
    });
    return mockWhatsAppResult(guard.reason);
  }
  const headers = await getHeaders();
  const from = await getFromPhone();
  const res = await fetch(`${YCLOUD_API}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: phone,
      type: "image",
      image: {
        link: imageUrl,
        ...(caption ? { caption } : {}),
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("yCloud image error:", err);
    throw new Error(`yCloud image error: ${res.status}`);
  }

  return res.json();
}

// ===== Send Document Message =====
export async function sendWhatsAppDocument(
  to: string,
  documentUrl: string,
  filename: string,
  caption?: string
) {
  const phone = normalizePhone(to);
  const guard = isOutboundBlocked("whatsapp");
  if (guard.blocked && guard.reason) {
    await recordMockOutbound({
      channel: "whatsapp",
      reason: guard.reason,
      to: phone,
      subject: null,
      bodyPreview: caption || `[document: ${filename}]`,
      meta: { type: "document", documentUrl, filename, caption: caption || null },
    });
    return mockWhatsAppResult(guard.reason);
  }
  const headers = await getHeaders();
  const from = await getFromPhone();
  const res = await fetch(`${YCLOUD_API}/whatsapp/messages/sendDirectly`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      from,
      to: phone,
      type: "document",
      document: {
        link: documentUrl,
        filename,
        ...(caption ? { caption } : {}),
      },
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("yCloud document error:", err);
    throw new Error(`yCloud doc error: ${res.status}`);
  }

  return res.json();
}

// ===== Legacy Notify Team (DO NOT USE — use admin-notify.ts instead) =====
// Kept for backward compat with index.ts export
export async function notifyTeam(message: string) {
  // Redirect to admin-notify to ensure report phone is used
  const { notifyTeam: notifyFromReport } = await import("./admin-notify");
  await notifyFromReport(message);
}

// ===== Parse Incoming Webhook =====
export interface WhatsAppIncoming {
  from: string;
  name?: string;
  messageId: string;
  type: "text" | "button" | "image" | "document" | "audio" | "video" | "other";
  text?: string;
  buttonId?: string;
  buttonText?: string;
  mediaUrl?: string;
  mediaFilename?: string;
  mediaMimeType?: string;
  timestamp: string;
}

export function parseWebhook(body: unknown): WhatsAppIncoming | null {
  try {
    const payload = body as Record<string, unknown>;
    const msg = payload?.whatsappInboundMessage as Record<string, unknown> | undefined;
    if (!msg) return null;

    const from = (msg.from as string) || "";
    const profile = msg.customerProfile as Record<string, string> | undefined;
    const name = profile?.name || "";
    const messageId = (msg.id as string) || "";
    const timestamp = (msg.createTime as string) || new Date().toISOString();

    if (msg.type === "text") {
      const textObj = msg.text as Record<string, string> | undefined;
      return { from, name, messageId, type: "text", text: textObj?.body || "", timestamp };
    }

    if (msg.type === "button") {
      const btn = msg.button as Record<string, string> | undefined;
      return {
        from, name, messageId, type: "button",
        buttonId: btn?.payload || "", buttonText: btn?.text || "",
        text: btn?.text || "", timestamp,
      };
    }

    if (msg.type === "interactive") {
      const inter = msg.interactive as Record<string, Record<string, string>> | undefined;
      const reply = inter?.buttonReply || inter?.listReply;
      return {
        from, name, messageId, type: "button",
        buttonId: reply?.id || "", buttonText: reply?.title || "",
        text: reply?.title || "", timestamp,
      };
    }

    if (msg.type === "image") {
      const img = msg.image as Record<string, string> | undefined;
      return {
        from, name, messageId, type: "image",
        text: img?.caption || "",
        mediaUrl: img?.link || img?.url || "",
        mediaMimeType: img?.mime_type || "image/jpeg",
        timestamp,
      };
    }

    if (msg.type === "document") {
      const doc = msg.document as Record<string, string> | undefined;
      return {
        from, name, messageId, type: "document",
        text: doc?.caption || "",
        mediaUrl: doc?.link || doc?.url || "",
        mediaFilename: doc?.filename || "document",
        mediaMimeType: doc?.mime_type || "application/pdf",
        timestamp,
      };
    }

    if (msg.type === "audio") {
      const audio = msg.audio as Record<string, string> | undefined;
      return {
        from, name, messageId, type: "audio",
        text: "",
        mediaUrl: audio?.link || audio?.url || "",
        mediaMimeType: audio?.mime_type || "audio/ogg",
        timestamp,
      };
    }

    if (msg.type === "video") {
      const video = msg.video as Record<string, string> | undefined;
      return {
        from, name, messageId, type: "video",
        text: video?.caption || "",
        mediaUrl: video?.link || video?.url || "",
        mediaMimeType: video?.mime_type || "video/mp4",
        timestamp,
      };
    }

    return { from, name, messageId, type: "other", text: "", timestamp };
  } catch {
    return null;
  }
}

// ===== Handle Incoming WhatsApp Message (new engine) =====
export async function handleWhatsAppMessage(incoming: WhatsAppIncoming): Promise<BotResponse> {
  const text = incoming.text || incoming.buttonText || "";
  if (!text) return { text: "" };

  const visitorId = `wa_${normalizePhone(incoming.from)}`;
  const response = await processMessage(visitorId, text, "whatsapp", {
    customerPhone: incoming.from,
    customerName: incoming.name,
    source: "whatsapp",
    mediaType: incoming.type !== "text" && incoming.type !== "button" ? incoming.type : undefined,
  });

  return response;
}

// ===== Send Bot Response via WhatsApp =====
export async function sendBotResponse(to: string, response: BotResponse): Promise<void> {
  if (response.quickReplies && response.quickReplies.length > 0) {
    const buttons = response.quickReplies.slice(0, 3).map((label, i) => ({
      id: `btn_${i}`,
      title: label,
    }));
    try {
      await sendWhatsAppButtons(to, response.text, buttons);
      return;
    } catch {
      // fallback to plain text
    }
  }

  await sendWhatsAppText(to, response.text);
}
