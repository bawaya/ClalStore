// =====================================================
// ClalMobile — yCloud WhatsApp Template Management
// Create, list, delete templates via yCloud API
// Docs: https://docs.ycloud.com/reference/whatsapp_template-create
// =====================================================

import { getIntegrationConfig } from "./hub";

const YCLOUD_API = "https://api.ycloud.com/v2";

async function getApiKey(): Promise<string> {
  const cfg = await getIntegrationConfig("whatsapp");
  const key = cfg.api_key || process.env.YCLOUD_API_KEY || "";
  if (!key) throw new Error("yCloud API key not configured");
  return key;
}

function headers(apiKey: string) {
  return { "Content-Type": "application/json", "X-API-Key": apiKey };
}

/** Fetch WABA ID from yCloud phone numbers endpoint */
export async function getWabaId(): Promise<string> {
  const apiKey = await getApiKey();
  const res = await fetch(`${YCLOUD_API}/whatsapp/phoneNumbers?limit=1`, {
    headers: headers(apiKey),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to fetch WABA ID: ${res.status} — ${err}`);
  }
  const data = await res.json();
  const wabaId = data?.items?.[0]?.wabaId;
  if (!wabaId) throw new Error("No WABA ID found — verify yCloud WhatsApp account setup");
  return wabaId;
}

export interface TemplateInfo {
  name: string;
  language: string;
  category: string;
  status: string;
  components?: Record<string, unknown>[];
}

/** List all templates for the account */
export async function listTemplates(): Promise<TemplateInfo[]> {
  const apiKey = await getApiKey();
  const wabaId = await getWabaId();
  const res = await fetch(`${YCLOUD_API}/whatsapp/templates?wabaId=${wabaId}&limit=100`, {
    headers: headers(apiKey),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Failed to list templates: ${res.status} — ${err}`);
  }
  const data = await res.json();
  return (data?.items || []).map((t: Record<string, unknown>) => ({
    name: t.name as string,
    language: t.language as string,
    category: t.category as string,
    status: t.status as string,
    components: t.components as Record<string, unknown>[],
  }));
}

/** Create a single template */
export async function createTemplate(template: {
  name: string;
  category: string;
  language: string;
  components: Record<string, unknown>[];
}): Promise<{ success: boolean; status?: string; error?: string }> {
  const apiKey = await getApiKey();
  const wabaId = await getWabaId();

  const res = await fetch(`${YCLOUD_API}/whatsapp/templates`, {
    method: "POST",
    headers: headers(apiKey),
    body: JSON.stringify({ wabaId, ...template }),
  });

  const data = await res.json();

  if (!res.ok) {
    const errMsg = data?.message || data?.error?.message || JSON.stringify(data);
    return { success: false, error: `${res.status}: ${errMsg}` };
  }

  return { success: true, status: data.status };
}

/** Delete a template by name */
export async function deleteTemplate(name: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = await getApiKey();
  const wabaId = await getWabaId();

  const res = await fetch(`${YCLOUD_API}/whatsapp/templates/${name}?wabaId=${wabaId}`, {
    method: "DELETE",
    headers: headers(apiKey),
  });

  if (!res.ok) {
    const err = await res.text();
    return { success: false, error: `${res.status}: ${err}` };
  }
  return { success: true };
}

// =====================================================
// Required Templates Definition
// =====================================================

export const REQUIRED_TEMPLATES = [
  {
    name: "clal_admin_alert",
    category: "UTILITY",
    language: "ar",
    components: [
      {
        type: "BODY",
        text: "{{1}}",
        example: { body_text: [["طلب جديد #1234 — ₪500"]] },
      },
    ],
  },
  {
    name: "clal_order_confirmation",
    category: "UTILITY",
    language: "ar",
    components: [
      {
        type: "BODY",
        text: "✅ تم استلام طلبك بنجاح!\n\n📦 رقم الطلب: {{1}}\n💰 المبلغ: {{2}}\n\nسيتواصل معك فريقنا قريباً.\nللاستفسار أرسل رقم طلبك في أي وقت.",
        example: { body_text: [["ORD-1234", "₪500"]] },
      },
    ],
  },
  {
    name: "clal_order_status",
    category: "UTILITY",
    language: "ar",
    components: [
      {
        type: "BODY",
        text: "📦 تحديث طلبك\n\nرقم الطلب: {{1}}\nالحالة الجديدة: {{2}}\n\nللاستفسار تواصل معنا في أي وقت.",
        example: { body_text: [["ORD-1234", "تمت الموافقة"]] },
      },
    ],
  },
  {
    name: "clal_reminder",
    category: "UTILITY",
    language: "ar",
    components: [
      {
        type: "BODY",
        text: "📞 تذكير بخصوص طلبك {{1}}\n\nحاولنا التواصل معك. الرجاء الرد هنا أو عبر الموقع.\n\nclalmobile.com/contact",
        example: { body_text: [["ORD-1234"]] },
      },
    ],
  },
  {
    name: "clal_otp_code",
    category: "AUTHENTICATION",
    language: "ar",
    components: [
      {
        type: "BODY",
        add_security_recommendation: true,
      },
      {
        type: "FOOTER",
        code_expiration_minutes: 10,
      },
      {
        type: "BUTTONS",
        buttons: [
          {
            type: "OTP",
            otp_type: "COPY_CODE",
            text: "نسخ الرمز",
          },
        ],
      },
    ],
  },
];

/** Provision all required templates — skips already-existing ones */
export async function provisionRequiredTemplates(): Promise<{
  results: { name: string; status: string; error?: string }[];
}> {
  const existing = await listTemplates();
  const existingNames = new Set(existing.map((t) => t.name));
  const results: { name: string; status: string; error?: string }[] = [];

  for (const tmpl of REQUIRED_TEMPLATES) {
    if (existingNames.has(tmpl.name)) {
      const match = existing.find((t) => t.name === tmpl.name);
      results.push({ name: tmpl.name, status: match?.status || "EXISTS" });
      continue;
    }

    const res = await createTemplate(tmpl);
    results.push({
      name: tmpl.name,
      status: res.success ? (res.status || "PENDING") : "FAILED",
      error: res.error,
    });
  }

  return { results };
}
