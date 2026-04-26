"use client";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useRef, useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { csrfHeaders } from "@/lib/csrf-client";
import { useAdminSettings } from "@/lib/admin/hooks";
import {
  ErrorBanner,
  FormField,
  PageHeader,
  ToastContainer,
  Toggle,
} from "@/components/admin/shared";
import { INTEGRATION_TYPES } from "@/lib/constants";
import { invalidateLogoCache } from "@/components/shared/Logo";

type ProviderField = {
  key: string;
  label: string;
  type: "text" | "password" | "email";
  placeholder: string;
  required?: boolean;
};

type IntegrationInfo = {
  icon: string;
  label: string;
  providers: readonly string[];
};

type IntegrationRecord = {
  id: string;
  type: string;
  provider: string;
  status: "active" | "inactive" | "error";
  config: Record<string, string>;
  last_synced_at?: string | null;
};

const SECRET_MASK = "••••••••";

const PROVIDER_FIELDS: Record<string, ProviderField[]> = {
  "רווחית (Rivhit)": [
    {
      key: "group_private_token",
      label: "GroupPrivateToken",
      type: "password",
      placeholder: "أدخل GroupPrivateToken",
      required: true,
    },
    {
      key: "max_payments",
      label: "الحد الأقصى للأقساط",
      type: "text",
      placeholder: "12",
    },
    {
      key: "test_mode",
      label: "وضع الاختبار",
      type: "text",
      placeholder: "true أو false",
    },
    {
      key: "document_language",
      label: "لغة المستند",
      type: "text",
      placeholder: "he أو ar",
    },
  ],
  UPay: [
    {
      key: "api_username",
      label: "اسم المستخدم",
      type: "text",
      placeholder: "merchant@example.com",
      required: true,
    },
    {
      key: "api_key",
      label: "مفتاح API",
      type: "password",
      placeholder: "UPay API Key",
      required: true,
    },
    {
      key: "language",
      label: "لغة البوابة",
      type: "text",
      placeholder: "HE أو EN",
    },
    {
      key: "max_payments",
      label: "الحد الأقصى للأقساط",
      type: "text",
      placeholder: "1",
    },
    {
      key: "test_mode",
      label: "وضع الاختبار",
      type: "text",
      placeholder: "true أو false",
    },
  ],
  Resend: [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "re_...",
      required: true,
    },
    {
      key: "from_email",
      label: "بريد المرسل",
      type: "email",
      placeholder: "ClalMobile <noreply@clalmobile.com>",
      required: true,
    },
  ],
  SendGrid: [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "SG.xxxxx",
      required: true,
    },
    {
      key: "from_email",
      label: "بريد المرسل",
      type: "email",
      placeholder: "noreply@clalmobile.com",
      required: true,
    },
  ],
  "Anthropic Claude": [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "sk-ant-...",
      required: true,
    },
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "claude-sonnet-4-20250514",
      required: true,
    },
  ],
  "Google Gemini": [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "AIza...",
      required: true,
    },
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "gemini-2.5-pro",
      required: true,
    },
  ],
  OpenAI: [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "sk-proj-...",
      required: true,
    },
    {
      key: "pricing_api_key",
      label: "Pricing API Key",
      type: "password",
      placeholder: "اتركه فارغًا لاستخدام نفس المفتاح",
    },
    {
      key: "model",
      label: "Model",
      type: "text",
      placeholder: "gpt-4o-mini",
      required: true,
    },
    {
      key: "pricing_model",
      label: "Pricing Model",
      type: "text",
      placeholder: "gpt-4o-mini",
    },
  ],
  "Remove.bg": [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "Remove.bg API Key",
      required: true,
    },
  ],
  "MobileAPI.dev": [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "MobileAPI.dev API Key",
      required: true,
    },
  ],
  Pexels: [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "Pexels API Key",
      required: true,
    },
  ],
  yCloud: [
    {
      key: "api_key",
      label: "API Key",
      type: "password",
      placeholder: "yCloud API Key",
      required: true,
    },
    {
      key: "phone_id",
      label: "Phone Number ID",
      type: "text",
      placeholder: "رقم الهاتف",
      required: true,
    },
    {
      key: "webhook_url",
      label: "Webhook URL",
      type: "text",
      placeholder: "https://clalmobile.com/api/webhook/whatsapp",
    },
    {
      key: "admin_phone",
      label: "رقم إشعارات الطلبات",
      type: "text",
      placeholder: "05X-XXXXXXX",
    },
    {
      key: "reports_phone",
      label: "رقم التقارير",
      type: "text",
      placeholder: "05X-XXXXXXX",
    },
  ],
  "Twilio SMS": [
    {
      key: "account_sid",
      label: "Account SID",
      type: "text",
      placeholder: "AC...",
      required: true,
    },
    {
      key: "auth_token",
      label: "Auth Token",
      type: "password",
      placeholder: "",
      required: true,
    },
    {
      key: "verify_service_sid",
      label: "Verify Service SID",
      type: "text",
      placeholder: "VA...",
      required: true,
    },
    {
      key: "phone_number",
      label: "رقم الإرسال",
      type: "text",
      placeholder: "+1...",
    },
    {
      key: "messaging_service_sid",
      label: "Messaging Service SID",
      type: "text",
      placeholder: "MG...",
    },
  ],
  "Cloudflare R2": [
    {
      key: "account_id",
      label: "Account ID",
      type: "text",
      placeholder: "Cloudflare Account ID",
      required: true,
    },
    {
      key: "access_key_id",
      label: "Access Key ID",
      type: "text",
      placeholder: "R2 access key id",
      required: true,
    },
    {
      key: "secret_access_key",
      label: "Secret Access Key",
      type: "password",
      placeholder: "R2 secret access key",
      required: true,
    },
    {
      key: "bucket_name",
      label: "اسم الحاوية",
      type: "text",
      placeholder: "clalmobile-images",
    },
    {
      key: "public_url",
      label: "الرابط العام",
      type: "text",
      placeholder: "https://cdn.example.com",
      required: true,
    },
  ],
  "Web Push (VAPID)": [
    {
      key: "public_key",
      label: "VAPID Public Key",
      type: "text",
      placeholder: "B...",
      required: true,
    },
    {
      key: "private_key",
      label: "VAPID Private Key",
      type: "password",
      placeholder: "x...",
      required: true,
    },
    {
      key: "subject",
      label: "Subject",
      type: "text",
      placeholder: "mailto:info@clalmobile.com",
    },
  ],
  "Internal Webhooks": [
    {
      key: "verify_token",
      label: "Verify Token",
      type: "password",
      placeholder: "Webhook verify token",
      required: true,
    },
    {
      key: "webhook_secret",
      label: "WhatsApp Signature Secret",
      type: "password",
      placeholder: "yCloud signature secret",
    },
    {
      key: "payment_webhook_secret",
      label: "Payment Signature Secret",
      type: "password",
      placeholder: "iCredit callback signature secret",
    },
  ],
};

const INTEGRATION_GROUPS = [
  {
    key: "communication",
    title: "التواصل والذكاء",
    description: "رسائل واتساب وSMS والبريد والمساعد الذكي في مكان واحد.",
    types: ["whatsapp", "sms", "email", "ai_chat", "ai_admin"],
  },
  {
    key: "payments",
    title: "الدفع والتحصيل",
    description: "بوابات الدفع حسب السوق المحلي أو العالمي مع حقول مطابقة للتشغيل الفعلي.",
    types: ["payment", "payment_upay"],
  },
  {
    key: "infrastructure",
    title: "البنية والتوزيع",
    description: "تخزين الصور والإشعارات ومفاتيح التشغيل التي تخدم بقية المنظومة.",
    types: ["push_notifications", "webhook_security"],
  },
  {
    key: "media",
    title: "الصور والبيانات",
    description: "مصادر الصور وتحسينها واستكمال مواصفات الأجهزة من الخدمات الفعلية.",
    types: ["image_enhance", "device_data", "stock_images", "storage"],
  },
] as const;

const INTEGRATION_NOTES: Record<string, string> = {
  whatsapp: "هذا التكامل يدير الرسائل الواردة عبر /api/webhook/whatsapp وإشعارات الأرقام المخصصة.",
  sms: "هذا التكامل يغذي رسائل OTP والرسائل النصية النظامية.",
  payment: "هذا المسار يستخدمه دفع إسرائيل عبر iCredit مباشرة داخل المتجر.",
  payment_upay: "هذا المسار يستخدمه الدفع لفلسطين والعالم عبر UPay.",
  email: "يُستخدم لرسائل الطلبات والتنبيهات ورسائل النماذج.",
  ai_chat: "يغذي البوت والبحث الذكي واستيراد الإكسل وبعض وظائف CRM.",
  storage: "يُستخدم حاليًا لرفع الصور المحسنة إلى Cloudflare R2 مع وجود رجوع احتياطي عند الحاجة.",
  push_notifications: "يغذي مفاتيح الاشتراك العام والإرسال من لوحة الإدارة.",
};

Object.assign(INTEGRATION_NOTES, {
  ai_admin: "يغذي أدوات الإدارة المبنية على OpenAI مثل تحسين النصوص ومطابقة الأسعار.",
  image_enhance: "هذا التكامل مسؤول عن إزالة الخلفية وتحسين صور الأجهزة داخل إدارة المنتجات.",
  device_data: "يغذي الاستكمال التلقائي لمواصفات الهواتف والأجهزة من مزود بيانات خارجي.",
  stock_images: "يستخدم لجلب صور إضافية مساعدة للمنتجات والألوان عند الحاجة.",
  webhook_security: "هنا تدار مفاتيح التحقق وأسرار التوقيع لواتساب ونقاط الدفع العائدة.",
});

type StoreField = {
  key: string;
  label: string;
  type: "text" | "color";
  hint?: string;
  placeholder?: string;
};

const STORE_FIELDS: StoreField[] = [
  { key: "store_name", label: "اسم المتجر", type: "text" as const },
  { key: "store_tagline_ar", label: "الوصف العربي", type: "text" as const },
  { key: "store_tagline_he", label: "الوصف العبري", type: "text" as const },
  { key: "phone", label: "رقم الهاتف", type: "text" as const },
  { key: "whatsapp_number", label: "رقم الواتساب", type: "text" as const },
  { key: "email", label: "البريد الإلكتروني", type: "text" as const },
  {
    key: "admin_phone",
    label: "رقم إشعارات الإدارة",
    type: "text" as const,
    hint: "يستقبل إشعارات الطلبات الجديدة والتنبيهات المهمة.",
    placeholder: "05X-XXXXXXX",
  },
  {
    key: "reports_phone",
    label: "رقم التقارير",
    type: "text" as const,
    hint: "يستقبل التقارير اليومية والأسبوعية عبر واتساب.",
    placeholder: "05X-XXXXXXX",
  },
  { key: "delivery_note_ar", label: "ملاحظة التوصيل بالعربية", type: "text" as const },
  { key: "delivery_note_he", label: "ملاحظة التوصيل بالعبرية", type: "text" as const },
  { key: "accent_color", label: "اللون الرئيسي", type: "color" as const },
] as const;

function fieldHasValue(value: unknown): boolean {
  return typeof value === "string" && value.trim().length > 0;
}

function IntegrationCard({
  type,
  info,
  integ,
  note,
  scr,
  onUpdate,
  show,
}: {
  type: string;
  info: IntegrationInfo;
  integ?: IntegrationRecord;
  note?: string;
  scr: ReturnType<typeof useScreen>;
  onUpdate: (
    type: string,
    updates: { provider?: string; config?: Record<string, string>; status?: string }
  ) => Promise<void>;
  show: (msg: string, type?: "success" | "error" | "warning" | "info") => void;
}) {
  const [selectedProvider, setSelectedProvider] = useState(integ?.provider || info.providers[0] || "");
  const [configDraft, setConfigDraft] = useState<Record<string, string>>(integ?.config || {});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    setSelectedProvider(integ?.provider || info.providers[0] || "");
    setConfigDraft((integ?.config as Record<string, string>) || {});
    setShowSecrets({});
    setTestResult(null);
  }, [info.providers, integ]);

  const fields = PROVIDER_FIELDS[selectedProvider] || [];

  const hasSavedKey = (key: string) => Boolean(configDraft[`_has_${key}`]);

  const configuredCount = fields.filter((field) => {
    return fieldHasValue(configDraft[field.key]) || hasSavedKey(field.key);
  }).length;

  const hasRequiredFields = fields
    .filter((field) => field.required)
    .every((field) => fieldHasValue(configDraft[field.key]) || hasSavedKey(field.key));

  const handleSelectProvider = async (provider: string) => {
    if (provider === selectedProvider && provider === integ?.provider) return;

    setSelectedProvider(provider);
    setConfigDraft(provider === integ?.provider ? integ?.config || {} : {});
    setShowSecrets({});
    setTestResult(null);

    if (provider !== integ?.provider) {
      await onUpdate(type, { provider, config: {}, status: "inactive" });
      show(`تم اختيار ${provider}`);
    }
  };

  const handleFieldChange = (key: string, value: string) => {
    setConfigDraft((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const clearMaskedValue = (key: string) => {
    setConfigDraft((prev) => {
      const next = { ...prev, [key]: "" };
      delete next[`_has_${key}`];
      return next;
    });
  };

  const cleanConfigForRequest = () => {
    const configToSend = { ...configDraft };
    for (const key of Object.keys(configToSend)) {
      if (key.startsWith("_has_")) delete configToSend[key];
    }
    return configToSend;
  };

  const handleSaveConfig = async () => {
    if (!selectedProvider) {
      show("اختر مزودًا أولًا", "warning");
      return;
    }

    setSaving(true);
    try {
      const configToSend = cleanConfigForRequest();
      const nextStatus = fields.length === 0 || hasRequiredFields ? "active" : integ?.status || "inactive";

      await onUpdate(type, {
        provider: selectedProvider,
        config: configToSend,
        status: nextStatus,
      });

      show(nextStatus === "active" ? "تم حفظ الإعدادات وتفعيلها" : "تم حفظ الإعدادات");
    } catch {
      show("فشل حفظ إعدادات التكامل", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleToggleStatus = async (active: boolean) => {
    await onUpdate(type, { provider: selectedProvider, status: active ? "active" : "inactive" });
    show(active ? "تم تفعيل التكامل" : "تم إيقاف التكامل");
  };

  const handleTest = async () => {
    if (!selectedProvider) {
      show("اختر مزودًا أولًا", "warning");
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          type,
          provider: selectedProvider,
          config: cleanConfigForRequest(),
        }),
      });

      const json = await res.json();
      const ok = Boolean(json.data?.ok ?? json.ok);
      const message =
        json.data?.message || json.message || json.error || "لم تصل رسالة واضحة من الخادم";

      setTestResult({ ok, message });
      if (!res.ok && !ok) show(message, "error");
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "فشل اختبار التكامل";
      setTestResult({ ok: false, message });
      show(message, "error");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="card" style={{ padding: scr.mobile ? 14 : 18 }}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          {integ?.provider && (
            <Toggle value={integ.status === "active"} onChange={handleToggleStatus} />
          )}
          <span
            className="text-[9px] px-2 py-0.5 rounded-md font-bold"
            style={{
              background:
                integ?.status === "active"
                  ? "rgba(34,197,94,0.15)"
                  : integ?.status === "error"
                    ? "rgba(239,68,68,0.15)"
                    : "rgba(63,63,70,0.15)",
              color:
                integ?.status === "active"
                  ? "#22c55e"
                  : integ?.status === "error"
                    ? "#ef4444"
                    : "#a1a1aa",
            }}
          >
            {integ?.status === "active"
              ? "فعال"
              : integ?.status === "error"
                ? "خطأ"
                : "غير فعال"}
          </span>
        </div>

        <div className="text-right">
          <div className="font-black" style={{ fontSize: scr.mobile ? 13 : 15 }}>
            {info.icon} {info.label}
          </div>
          {integ?.last_synced_at && (
            <div className="text-muted" style={{ fontSize: scr.mobile ? 8 : 10 }}>
              آخر تحديث: {new Date(integ.last_synced_at).toLocaleString("ar")}
            </div>
          )}
        </div>
      </div>

      {note && (
        <div
          className="rounded-xl px-3 py-2 mb-3 text-right text-muted"
          style={{
            fontSize: scr.mobile ? 9 : 11,
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {note}
        </div>
      )}

      <div className="flex gap-1.5 flex-wrap mb-3">
        {info.providers.map((provider) => (
          <button
            key={provider}
            onClick={() => void handleSelectProvider(provider)}
            className={`chip text-[10px] ${selectedProvider === provider ? "chip-active" : ""}`}
          >
            {provider}
          </button>
        ))}
      </div>

      {selectedProvider && fields.length > 0 ? (
        <div className="rounded-2xl bg-surface-elevated border border-surface-border p-3">
          <div className="flex items-center justify-between mb-3">
            <span
              className="text-[9px] px-2 py-0.5 rounded-md font-bold"
              style={{
                background: configuredCount ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.06)",
                color: configuredCount ? "#22c55e" : "#a1a1aa",
              }}
            >
              {configuredCount}/{fields.length} حقول مكتملة
            </span>
            <div className="font-bold text-muted text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              إعدادات {selectedProvider}
            </div>
          </div>

          <div className="space-y-2.5">
            {fields.map((field) => {
              const isSensitive = field.type === "password";
              const currentValue = configDraft[field.key] || "";
              const isMasked = isSensitive && currentValue.includes(SECRET_MASK);

              return (
                <div key={field.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1">
                      {hasSavedKey(field.key) && (
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}
                        >
                          محفوظ
                        </span>
                      )}
                      {field.required && (
                        <span
                          className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                          style={{ background: "rgba(196,16,64,0.12)", color: "#fda4af" }}
                        >
                          مطلوب
                        </span>
                      )}
                    </div>
                    <label className="text-muted text-right" style={{ fontSize: scr.mobile ? 9 : 10 }}>
                      {field.label}
                    </label>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <input
                      type={isSensitive && !showSecrets[field.key] ? "password" : field.type === "email" ? "email" : "text"}
                      className="input flex-1"
                      style={{ fontSize: scr.mobile ? 11 : 13 }}
                      dir="ltr"
                      placeholder={hasSavedKey(field.key) ? "أدخل قيمة جديدة إذا أردت الاستبدال" : field.placeholder}
                      value={currentValue}
                      onChange={(event) => handleFieldChange(field.key, event.target.value)}
                      onFocus={() => {
                        if (isMasked) clearMaskedValue(field.key);
                      }}
                    />

                    {isSensitive && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowSecrets((prev) => ({ ...prev, [field.key]: !prev[field.key] }))
                        }
                        className="w-8 h-8 rounded-lg border border-surface-border bg-transparent text-muted cursor-pointer flex items-center justify-center text-xs"
                        title={showSecrets[field.key] ? "إخفاء" : "إظهار"}
                      >
                        {showSecrets[field.key] ? "🙈" : "👁️"}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-surface-border">
            <button
              onClick={() => void handleTest()}
              disabled={testing || !hasRequiredFields}
              className="btn-outline"
              style={{
                fontSize: scr.mobile ? 10 : 12,
                padding: scr.mobile ? "8px 12px" : "10px 16px",
                opacity: testing || !hasRequiredFields ? 0.55 : 1,
              }}
            >
              {testing ? "جارٍ الاختبار..." : "اختبار"}
            </button>
            <button
              onClick={() => void handleSaveConfig()}
              disabled={saving}
              className="btn-primary flex-1"
              style={{
                fontSize: scr.mobile ? 10 : 12,
                padding: scr.mobile ? "8px 12px" : "10px 16px",
                opacity: saving ? 0.6 : 1,
              }}
            >
              {saving ? "جارٍ الحفظ..." : "حفظ الإعدادات"}
            </button>
          </div>

          {testResult && (
            <div
              className="rounded-xl px-3 py-2 text-center font-bold mt-3"
              style={{
                fontSize: scr.mobile ? 10 : 12,
                background: testResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
                color: testResult.ok ? "#22c55e" : "#ef4444",
                border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
              }}
            >
              {testResult.message}
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-xl px-3 py-2 text-right text-muted bg-surface-elevated border border-surface-border">
          اختر مزودًا حتى تظهر الحقول المرتبطة به.
        </div>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const { settings, integrations, loading, error, clearError, updateSetting, updateIntegration } =
    useAdminSettings();
  const [tab, setTab] = useState<"store" | "integrations">("store");
  const [storeDraft, setStoreDraft] = useState<Record<string, string>>({});
  const [savingSettingKey, setSavingSettingKey] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setStoreDraft(settings);
  }, [settings]);

  const logoSize = parseInt(storeDraft.logo_size || settings.logo_size || "48", 10);
  const logoUrl = storeDraft.logo_url || settings.logo_url || "";

  const integrationSummary = useMemo(() => {
    const active = integrations.filter((integration) => integration.status === "active").length;
    const configured = integrations.filter((integration) => {
      return Object.keys(integration.config || {}).some(
        (key) => !key.startsWith("_has_") && fieldHasValue(integration.config[key]),
      );
    }).length;

    return {
      total: integrations.length,
      active,
      configured,
    };
  }, [integrations]);

  if (loading) {
    return <div className="text-center py-20 text-muted">جارٍ تحميل الإعدادات...</div>;
  }

  const tabs = [
    { key: "store" as const, icon: "🏪", label: "المتجر" },
    { key: "integrations" as const, icon: "🔌", label: "التكاملات" },
  ];

  const saveStoreField = async (key: string, successMessage?: string) => {
    const nextValue = storeDraft[key] || "";
    if ((settings[key] || "") === nextValue) return;

    setSavingSettingKey(key);
    try {
      await updateSetting(key, nextValue);
      show(successMessage || "تم حفظ الإعداد");
    } catch {
      show("فشل حفظ الإعداد", "error");
    } finally {
      setSavingSettingKey(null);
    }
  };

  const handleUpdateIntegration = async (
    type: string,
    updates: { provider?: string; config?: Record<string, string>; status?: string },
  ) => {
    const integration = integrations.find((item) => item.type === type);
    if (!integration) return;

    await updateIntegration(integration.id, {
      ...(updates.provider !== undefined && { provider: updates.provider }),
      ...(updates.config !== undefined && { config: updates.config }),
      ...(updates.status !== undefined && { status: updates.status }),
      last_synced_at: new Date().toISOString(),
    });
  };

  const handleLogoUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      show("الحد الأقصى لملف الشعار هو 2MB", "error");
      return;
    }

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);

      const res = await fetch("/api/admin/upload-logo", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok || !data.url) {
        show(data.error || "فشل رفع الشعار", "error");
        return;
      }

      setStoreDraft((prev) => ({ ...prev, logo_url: data.url }));
      await updateSetting("logo_url", data.url);
      invalidateLogoCache();
      show("تم رفع الشعار بنجاح");
    } catch {
      show("فشل رفع الشعار", "error");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const handleLogoDelete = async () => {
    try {
      await fetch("/api/admin/upload-logo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: logoUrl }),
      });
      setStoreDraft((prev) => ({ ...prev, logo_url: "" }));
      await updateSetting("logo_url", "");
      invalidateLogoCache();
      show("تم حذف الشعار");
    } catch {
      show("فشل حذف الشعار", "error");
    }
  };

  return (
    <div>
      <PageHeader title="الإعدادات" />

      <div className="flex gap-1.5 mb-4">
        {tabs.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`chip ${tab === item.key ? "chip-active" : ""}`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      <ErrorBanner message={error} onDismiss={clearError} />

      {tab === "store" && (
        <div className="space-y-4">
          <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-right">
                <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                  هوية المتجر
                </div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  الشعار والحجم والألوان والبيانات العامة.
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="chip chip-active text-[10px]">{logoSize}px</span>
                <span className="chip text-[10px]">{storeDraft.accent_color || settings.accent_color || "#c41040"}</span>
              </div>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "140px 1fr" }}>
              <div className="rounded-2xl border border-dashed border-surface-border bg-surface-elevated flex items-center justify-center overflow-hidden min-h-[140px]">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    className="object-contain"
                    style={{ width: logoSize, height: logoSize }}
                  />
                ) : (
                  <div className="text-center text-muted">
                    <div className="text-3xl mb-1">🖼️</div>
                    <div style={{ fontSize: 10 }}>لا يوجد شعار</div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void handleLogoUpload(file);
                  }}
                />

                <div className="flex gap-2 flex-wrap">
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="btn-primary"
                    style={{ opacity: uploading ? 0.6 : 1 }}
                  >
                    {uploading ? "جارٍ الرفع..." : "رفع شعار"}
                  </button>
                  {logoUrl && (
                    <button onClick={() => void handleLogoDelete()} className="btn-outline">
                      حذف الشعار
                    </button>
                  )}
                </div>

                <div className="text-muted" style={{ fontSize: 10 }}>
                  الصيغ المدعومة: JPG, PNG, WebP, SVG — الحد الأقصى 2MB.
                </div>

                <FormField label="حجم الشعار">
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={24}
                      max={120}
                      step={4}
                      value={logoSize}
                      className="flex-1 accent-brand"
                      onChange={(event) => {
                        setStoreDraft((prev) => ({ ...prev, logo_size: event.target.value }));
                      }}
                      onMouseUp={() => void saveStoreField("logo_size", "تم حفظ حجم الشعار")}
                      onTouchEnd={() => void saveStoreField("logo_size", "تم حفظ حجم الشعار")}
                    />
                    <span className="text-muted text-xs font-mono w-12 text-center">{logoSize}px</span>
                  </div>
                </FormField>
              </div>
            </div>
          </div>

          <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
            <div className="flex items-center justify-between gap-3 mb-4">
              <div className="text-right">
                <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                  بيانات المتجر
                </div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  التعديل صار محليًا أولًا ثم يُحفظ عند الخروج من الحقل بدل الحفظ مع كل حرف.
                </div>
              </div>
            </div>

            {STORE_FIELDS.map((field) => (
              <FormField key={field.key} label={field.label}>
                {field.type === "color" ? (
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={storeDraft[field.key] || "#c41040"}
                      onChange={(event) => {
                        const value = event.target.value;
                        setStoreDraft((prev) => ({ ...prev, [field.key]: value }));
                        void updateSetting(field.key, value)
                          .then(() => show("تم حفظ اللون الرئيسي"))
                          .catch(() => show("فشل حفظ اللون", "error"));
                      }}
                      className="w-10 h-10 rounded-lg cursor-pointer border border-surface-border"
                    />
                    <span className="text-muted text-xs font-mono">
                      {storeDraft[field.key] || "#c41040"}
                    </span>
                  </div>
                ) : (
                  <>
                    <input
                      className="input"
                      dir={field.key.endsWith("_he") ? "rtl" : "auto"}
                      value={storeDraft[field.key] || ""}
                      placeholder={field.placeholder}
                      onChange={(event) =>
                        setStoreDraft((prev) => ({ ...prev, [field.key]: event.target.value }))
                      }
                      onBlur={() => void saveStoreField(field.key)}
                      disabled={savingSettingKey === field.key}
                    />
                    {field.hint && (
                      <p className="text-dim mt-0.5" style={{ fontSize: 9, lineHeight: 1.4 }}>
                        {field.hint}
                      </p>
                    )}
                  </>
                )}
              </FormField>
            ))}
          </div>
        </div>
      )}

      {tab === "integrations" && (
        <div className="space-y-4">
          <div className="card" style={{ padding: scr.mobile ? 14 : 18 }}>
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="text-right">
                <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                  مركز التكاملات
                </div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  رتبنا الصفحة حسب الوظيفة وربطنا الحقول مع مسارات التشغيل الفعلية قدر الإمكان.
                </div>
              </div>

              <div className="flex gap-2 flex-wrap">
                <span className="chip chip-active text-[10px]">الإجمالي: {integrationSummary.total}</span>
                <span className="chip text-[10px]">الفعالة: {integrationSummary.active}</span>
                <span className="chip text-[10px]">المكتملة: {integrationSummary.configured}</span>
              </div>
            </div>
          </div>

          {INTEGRATION_GROUPS.map((group) => (
            <div key={group.key} className="card" style={{ padding: scr.mobile ? 14 : 18 }}>
              <div className="mb-4 text-right">
                <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                  {group.title}
                </div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {group.description}
                </div>
              </div>

              <div className="space-y-3">
                {group.types.map((type) => {
                  const info = INTEGRATION_TYPES[type as keyof typeof INTEGRATION_TYPES];
                  const integration = integrations.find((item) => item.type === type) as
                    | IntegrationRecord
                    | undefined;

                  if (!info) return null;

                  return (
                    <IntegrationCard
                      key={type}
                      type={type}
                      info={info}
                      integ={integration}
                      note={INTEGRATION_NOTES[type]}
                      scr={scr}
                      onUpdate={handleUpdateIntegration}
                      show={show}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
