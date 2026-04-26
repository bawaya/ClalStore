import { NextRequest } from "next/server";
import { apiError, apiSuccess } from "@/lib/api-response";
import { getIntegrationConfig } from "@/lib/integrations/hub";
import { getIntegrationByTypeWithSecrets } from "@/lib/integrations/secrets";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { createAdminSupabase } from "@/lib/supabase";
import { verifyResendWebhookSignature } from "@/lib/webhook-verify";

const RESEND_API = "https://api.resend.com";
const RESEND_USER_AGENT = "clalmobile-resend-webhook/1.0";

type ResendReceivedWebhookEvent = {
  type?: string;
  created_at?: string;
  data?: {
    email_id?: string;
    created_at?: string;
    from?: string;
    to?: string[];
    cc?: string[];
    bcc?: string[];
    message_id?: string;
    subject?: string;
    attachments?: Array<{
      id?: string;
      filename?: string;
      content_type?: string;
      content_disposition?: string | null;
      content_id?: string | null;
    }>;
  };
};

type ResendReceivedEmail = {
  id?: string;
  to?: string[];
  from?: string;
  created_at?: string;
  subject?: string | null;
  html?: string | null;
  text?: string | null;
  headers?: Record<string, string>;
  bcc?: string[];
  cc?: string[];
  reply_to?: string[];
  message_id?: string;
  attachments?: Array<{
    id?: string;
    filename?: string;
    content_type?: string;
    content_disposition?: string | null;
    content_id?: string | null;
  }>;
  raw?: {
    download_url?: string;
    expires_at?: string;
  } | null;
};

function stripHtml(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|tr|h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function parseMailbox(value?: string | null): { name: string | null; email: string | null } {
  const input = String(value || "").trim();
  if (!input) return { name: null, email: null };

  const match = input.match(/^(.*?)<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "") || null;
    const email = match[2].trim().toLowerCase();
    return { name, email };
  }

  if (input.includes("@")) {
    return { name: null, email: input.toLowerCase() };
  }

  return { name: input, email: null };
}

function pickMessageContent(
  receivedEmail: ResendReceivedEmail | null,
  event: ResendReceivedWebhookEvent
): string {
  const text = String(receivedEmail?.text || "").trim();
  if (text) return text;

  const html = String(receivedEmail?.html || "").trim();
  if (html) {
    const stripped = stripHtml(html);
    if (stripped) return stripped;
  }

  const subject = String(receivedEmail?.subject || event.data?.subject || "").trim();
  if (subject) return `الموضوع: ${subject}`;

  return "رسالة بريد واردة بدون نص ظاهر.";
}

async function getResendReceivingApiKey(): Promise<string> {
  const { integration, config } = await getIntegrationByTypeWithSecrets("email");
  const dbApiKey = String(config.api_key || "").trim();

  if (dbApiKey && (!integration?.provider || integration.provider === "Resend")) {
    return dbApiKey;
  }

  return String(process.env.RESEND_API_KEY || "").trim();
}

async function fetchReceivedEmail(emailId: string): Promise<ResendReceivedEmail | null> {
  const apiKey = await getResendReceivingApiKey();
  if (!apiKey) {
    console.warn("Resend inbound webhook: missing API key for received email lookup");
    return null;
  }

  const response = await fetch(`${RESEND_API}/emails/receiving/${emailId}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "User-Agent": RESEND_USER_AGENT,
    },
  });

  if (!response.ok) {
    const details = await response.text().catch(() => "");
    console.error(`Resend inbound webhook: failed to fetch email ${emailId} (${response.status})`, details);
    return null;
  }

  const payload = await response.json().catch(() => null);
  if (!payload || typeof payload !== "object") return null;

  return ("data" in payload ? payload.data : payload) as ResendReceivedEmail;
}

async function upsertInboundEmailConversation(params: {
  event: ResendReceivedWebhookEvent;
  receivedEmail: ResendReceivedEmail | null;
  svixId: string | null;
}) {
  const sb = createAdminSupabase();
  const eventData = params.event.data || {};
  const mailbox = parseMailbox(params.receivedEmail?.from || eventData.from);
  const senderEmail = mailbox.email || `resend:${eventData.email_id || params.svixId || Date.now()}`;
  const senderName = mailbox.name || mailbox.email?.split("@")[0] || "مرسل غير معروف";
  const subject = String(params.receivedEmail?.subject || eventData.subject || "").trim();
  const content = pickMessageContent(params.receivedEmail, params.event);

  if (params.svixId) {
    const { data: existingMessage, error: lookupError } = await sb
      .from("inbox_messages")
      .select("id, conversation_id")
      .contains("metadata", { resend_svix_id: params.svixId })
      .limit(1)
      .maybeSingle();

    if (lookupError) {
      console.error("Resend inbound webhook: duplicate lookup failed", lookupError);
    } else if (existingMessage) {
      return { duplicate: true, conversationId: existingMessage.conversation_id as string | null };
    }
  }

  const { data: existingConversation, error: existingError } = await sb
    .from("inbox_conversations")
    .select("id, unread_count")
    .eq("customer_phone", senderEmail)
    .neq("status", "archived")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    console.error("Resend inbound webhook: conversation lookup failed", existingError);
  }

  const baseMetadata = {
    transport: "email",
    sender_email: senderEmail,
    sender_name: senderName,
    recipient_emails: params.receivedEmail?.to || eventData.to || [],
    cc: params.receivedEmail?.cc || eventData.cc || [],
    bcc: params.receivedEmail?.bcc || eventData.bcc || [],
    subject: subject || null,
    resend_email_id: params.receivedEmail?.id || eventData.email_id || null,
    resend_message_id: params.receivedEmail?.message_id || eventData.message_id || null,
    resend_svix_id: params.svixId,
    attachments: params.receivedEmail?.attachments || eventData.attachments || [],
    raw_download_url: params.receivedEmail?.raw?.download_url || null,
    reply_to: params.receivedEmail?.reply_to || [],
    headers: params.receivedEmail?.headers || {},
  };

  let conversationId = existingConversation?.id as string | undefined;
  if (conversationId) {
    const currentUnread = Number(existingConversation?.unread_count || 0);
    const { error: updateError } = await sb
      .from("inbox_conversations")
      .update({
        channel: "webchat",
        customer_name: senderName,
        status: "waiting",
        unread_count: currentUnread + 1,
        last_message_at: new Date().toISOString(),
        last_message_text: content.substring(0, 200),
        last_message_direction: "inbound",
        source: "resend_email",
        metadata: baseMetadata,
      } as never)
      .eq("id", conversationId);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: insertedConversation, error: insertConversationError } = await sb
      .from("inbox_conversations")
      .insert({
        customer_phone: senderEmail,
        customer_name: senderName,
        channel: "webchat",
        status: "waiting",
        unread_count: 1,
        last_message_at: new Date().toISOString(),
        last_message_text: content.substring(0, 200),
        last_message_direction: "inbound",
        source: "resend_email",
        metadata: baseMetadata,
      } as never)
      .select("id")
      .single();

    if (insertConversationError) {
      throw insertConversationError;
    }

    conversationId = insertedConversation?.id as string | undefined;
  }

  if (!conversationId) {
    throw new Error("Failed to resolve inbox conversation for Resend inbound email");
  }

  const { error: insertMessageError } = await sb.from("inbox_messages").insert({
    conversation_id: conversationId,
    direction: "inbound",
    sender_type: "customer",
    sender_name: senderName,
    message_type: "text",
    content,
    status: "delivered",
    metadata: baseMetadata,
  } as never);

  if (insertMessageError) {
    throw insertMessageError;
  }

  return { duplicate: false, conversationId };
}

export async function GET() {
  return apiSuccess({
    ok: true,
    provider: "Resend Inbound",
    endpoint: `${getPublicSiteUrl()}/api/webhook/resend`,
    accepts: ["email.received"],
  });
}

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();
    const webhookCfg = await getIntegrationConfig("webhook_security");
    const resendWebhookSecret = String(
      webhookCfg.resend_webhook_secret || process.env.RESEND_WEBHOOK_SECRET || ""
    ).trim();

    if (resendWebhookSecret) {
      const valid = await verifyResendWebhookSignature(
        rawBody,
        {
          id: req.headers.get("svix-id"),
          timestamp: req.headers.get("svix-timestamp"),
          signature: req.headers.get("svix-signature"),
        },
        resendWebhookSecret
      );

      if (!valid) {
        return apiError("Invalid webhook signature", 401);
      }
    }

    const event = JSON.parse(rawBody) as ResendReceivedWebhookEvent;
    if (event.type !== "email.received") {
      return apiSuccess({ received: true, ignored: true, eventType: event.type || null });
    }

    const emailId = String(event.data?.email_id || "").trim();
    const receivedEmail = emailId ? await fetchReceivedEmail(emailId) : null;
    const result = await upsertInboundEmailConversation({
      event,
      receivedEmail,
      svixId: req.headers.get("svix-id"),
    });

    return apiSuccess({
      received: true,
      duplicate: result.duplicate,
      conversationId: result.conversationId || null,
    });
  } catch (error) {
    console.error("Resend inbound webhook error:", error);
    return apiError("Failed to process inbound email webhook", 500);
  }
}
