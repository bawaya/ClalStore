"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminSettings } from "@/lib/admin/hooks";
import { FormField, Toggle, ErrorBanner, ToastContainer } from "@/components/admin/shared";
import { INTEGRATION_TYPES } from "@/lib/constants";
import { invalidateLogoCache } from "@/components/shared/Logo";

// ===== Provider Config Fields =====
const PROVIDER_FIELDS: Record<string, { key: string; label: string; type: string; placeholder: string }[]> = {
  // --- Payment ---
  "רווחית (Rivhit)": [
    { key: "api_key", label: "API Key", type: "password", placeholder: "أدخل Rivhit API Key" },
    { key: "business_id", label: "Business ID", type: "text", placeholder: "رقم العمل" },
  ],
  Tranzila: [
    { key: "terminal", label: "Terminal Name", type: "text", placeholder: "اسم الطرفية" },
    { key: "password", label: "Password", type: "password", placeholder: "كلمة المرور" },
  ],
  PayPlus: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "PayPlus API Key" },
    { key: "secret_key", label: "Secret Key", type: "password", placeholder: "PayPlus Secret" },
  ],
  Stripe: [
    { key: "api_key", label: "Secret Key", type: "password", placeholder: "sk_live_xxxxx" },
    { key: "publishable_key", label: "Publishable Key", type: "text", placeholder: "pk_live_xxxxx" },
  ],
  // --- WhatsApp ---
  yCloud: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "yCloud API Key" },
    { key: "phone_id", label: "رقم الهاتف المسجّل", type: "text", placeholder: "+972XXXXXXXXX" },
    { key: "webhook_url", label: "Webhook URL", type: "text", placeholder: "https://clalmobile.com/api/webhook/whatsapp" },
    { key: "admin_phone", label: "📱 رقم الأدمن (إشعارات الطلبات)", type: "text", placeholder: "05X-XXXXXXX" },
    { key: "reports_phone", label: "📊 رقم التقارير", type: "text", placeholder: "05X-XXXXXXX" },
  ],
  "Meta API": [
    { key: "access_token", label: "Access Token", type: "password", placeholder: "" },
    { key: "phone_id", label: "Phone Number ID", type: "text", placeholder: "" },
    { key: "verify_token", label: "Verify Token", type: "text", placeholder: "" },
  ],
  Twilio: [
    { key: "account_sid", label: "Account SID", type: "text", placeholder: "AC..." },
    { key: "auth_token", label: "Auth Token", type: "password", placeholder: "" },
    { key: "phone_number", label: "From Number", type: "text", placeholder: "+1..." },
  ],
  // --- SMS / OTP ---
  "Twilio SMS": [
    { key: "account_sid", label: "Account SID", type: "text", placeholder: "AC..." },
    { key: "auth_token", label: "Auth Token", type: "password", placeholder: "" },
    { key: "verify_service_sid", label: "Verify Service SID (OTP)", type: "text", placeholder: "VA..." },
    { key: "phone_number", label: "From Number (اختياري)", type: "text", placeholder: "+972..." },
    { key: "messaging_service_sid", label: "Messaging Service SID (اختياري)", type: "text", placeholder: "MG..." },
  ],
  // --- Email ---
  Resend: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "re_xxxxx" },
    { key: "from_email", label: "بريد المرسل", type: "email", placeholder: "ClalMobile <noreply@clalmobile.com>" },
  ],
  SendGrid: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "SG.xxxxx" },
    { key: "from_email", label: "بريد المرسل", type: "email", placeholder: "noreply@clalmobile.com" },
  ],
  Mailgun: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "key-xxxxx" },
    { key: "domain", label: "Domain", type: "text", placeholder: "mg.clalmobile.com" },
    { key: "from_email", label: "بريد المرسل", type: "email", placeholder: "noreply@clalmobile.com" },
  ],
  "Amazon SES": [
    { key: "access_key", label: "Access Key ID", type: "password", placeholder: "" },
    { key: "secret_key", label: "Secret Access Key", type: "password", placeholder: "" },
    { key: "region", label: "Region", type: "text", placeholder: "eu-west-1" },
    { key: "from_email", label: "بريد المرسل", type: "email", placeholder: "noreply@clalmobile.com" },
  ],
  SMTP: [
    { key: "host", label: "SMTP Host", type: "text", placeholder: "smtp.example.com" },
    { key: "port", label: "Port", type: "text", placeholder: "587" },
    { key: "username", label: "Username", type: "text", placeholder: "" },
    { key: "password", label: "Password", type: "password", placeholder: "" },
    { key: "from_email", label: "بريد المرسل", type: "email", placeholder: "noreply@clalmobile.com" },
  ],
  // --- AI (Bot + Search) ---
  "Anthropic Claude": [
    { key: "api_key", label: "API Key", type: "password", placeholder: "sk-ant-xxxxx" },
    { key: "api_key_bot", label: "API Key — بوت (اختياري)", type: "password", placeholder: "مفتاح منفصل للبوت" },
    { key: "api_key_store", label: "API Key — متجر (اختياري)", type: "password", placeholder: "مفتاح منفصل للبحث الذكي" },
  ],
  // --- AI (Admin) ---
  OpenAI: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "sk-xxxxx" },
    { key: "api_key_admin", label: "API Key — أدمن (اختياري)", type: "password", placeholder: "مفتاح منفصل لترجمة المنتجات" },
  ],
  // --- Payment UPay ---
  UPay: [
    { key: "api_username", label: "API Username (Email)", type: "text", placeholder: "email@example.com" },
    { key: "api_key", label: "API Key", type: "password", placeholder: "UPay API Key" },
    { key: "max_payments", label: "عدد التقسيطات الأقصى", type: "text", placeholder: "1" },
    { key: "language", label: "اللغة", type: "text", placeholder: "HE / EN" },
    { key: "test_mode", label: "وضع الاختبار (true/false)", type: "text", placeholder: "false" },
  ],
  // --- Storage ---
  "Cloudflare R2": [
    { key: "account_id", label: "Account ID", type: "text", placeholder: "Cloudflare Account ID" },
    { key: "access_key", label: "Access Key ID", type: "password", placeholder: "R2 Access Key" },
    { key: "secret_key", label: "Secret Access Key", type: "password", placeholder: "R2 Secret Key" },
    { key: "bucket_name", label: "Bucket Name", type: "text", placeholder: "clalmobile-images" },
    { key: "public_url", label: "Public URL", type: "text", placeholder: "https://your-r2-url.com" },
  ],
  // --- Image Processing ---
  RemoveBG: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "RemoveBG API Key" },
  ],
  // --- Device Specs ---
  MobileAPI: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "MobileAPI Token" },
  ],
  // --- Image Search ---
  Pexels: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "Pexels API Key" },
  ],
  // --- Push Notifications ---
  "Web Push (VAPID)": [
    { key: "vapid_public", label: "VAPID Public Key", type: "text", placeholder: "BKs7L8mH_Z_Ra..." },
    { key: "vapid_private", label: "VAPID Private Key", type: "password", placeholder: "مفتاح خاص" },
  ],
  // --- Analytics ---
  "Google Analytics": [
    { key: "measurement_id", label: "Measurement ID", type: "text", placeholder: "G-XXXXXXXX" },
  ],
  Mixpanel: [
    { key: "project_token", label: "Project Token", type: "text", placeholder: "" },
  ],
  // --- CRM ---
  HubSpot: [
    { key: "api_key", label: "API Key", type: "password", placeholder: "HubSpot Private App Token" },
  ],
  Salesforce: [
    { key: "client_id", label: "Client ID", type: "text", placeholder: "" },
    { key: "client_secret", label: "Client Secret", type: "password", placeholder: "" },
    { key: "instance_url", label: "Instance URL", type: "text", placeholder: "https://xxx.salesforce.com" },
  ],
};

// ===== Integration Card =====
function IntegrationCard({
  type, info, integ, scr, onUpdate, show,
}: {
  type: string;
  info: { icon: string; label: string; providers: readonly string[] };
  integ: any;
  scr: { mobile: boolean };
  onUpdate: (type: string, updates: { provider?: string; config?: Record<string, string>; status?: string }) => Promise<void>;
  show: (msg: string) => void;
}) {
  const [configDraft, setConfigDraft] = useState<Record<string, string>>(integ?.config || {});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  const selectedProvider = integ?.provider || "";
  const fields = PROVIDER_FIELDS[selectedProvider] || [];

  const hasSavedKey = (key: string) => !!configDraft[`_has_${key}`];
  const MASK = "••••••••";

  const fieldHasValue = (key: string) => {
    const val = configDraft[key];
    return (val && val.length > 0) || hasSavedKey(key);
  };

  const handleSelectProvider = async (provider: string) => {
    const newConfig = provider === selectedProvider ? configDraft : {};
    setConfigDraft(newConfig);
    setTestResult(null);
    await onUpdate(type, { provider, config: newConfig, status: "inactive" });
    show(`✅ تم اختيار ${provider}`);
  };

  const handleSaveConfig = async () => {
    setSaving(true);
    try {
      const configToSend = { ...configDraft };
      for (const key of Object.keys(configToSend)) {
        if (key.startsWith("_has_")) delete configToSend[key];
      }
      const hasValues = Object.entries(configToSend).some(([, v]) => v && !v.includes(MASK));
      const newStatus = hasValues ? "active" : (integ?.status || "inactive");
      await onUpdate(type, { config: configToSend, status: newStatus });
      show("✅ تم حفظ الإعدادات" + (newStatus === "active" ? " وتفعيلها" : ""));
    } catch { show("❌ خطأ في الحفظ"); }
    setSaving(false);
  };

  const handleToggleStatus = async (active: boolean) => {
    await onUpdate(type, { status: active ? "active" : "inactive" });
    show(active ? "✅ تم التفعيل" : "⏸️ تم الإيقاف");
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const configToTest = { ...configDraft };
      for (const key of Object.keys(configToTest)) {
        if (key.startsWith("_has_")) delete configToTest[key];
      }
      const res = await fetch("/api/admin/integrations/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, provider: selectedProvider, config: configToTest }),
      });
      const data = await res.json();
      setTestResult({ ok: data.ok, message: data.message || data.error || "" });
      if (data.ok) {
        await onUpdate(type, { status: "active" });
      }
    } catch (err: any) {
      setTestResult({ ok: false, message: err.message });
    }
    setTesting(false);
  };

  const configuredCount = fields.filter((f) => fieldHasValue(f.key)).length;
  const allConfigured = fields.length > 0 && configuredCount === fields.length;
  const hasAnyField = configuredCount > 0;

  const statusColor = integ?.status === "active" ? "#22c55e" : integ?.status === "error" ? "#ef4444" : "#71717a";
  const statusBg = integ?.status === "active" ? "rgba(34,197,94,0.12)" : integ?.status === "error" ? "rgba(239,68,68,0.12)" : "rgba(63,63,70,0.12)";
  const statusText = integ?.status === "active" ? "فعّال" : integ?.status === "error" ? "خطأ" : "غير فعّال";
  const statusIcon = integ?.status === "active" ? "🟢" : integ?.status === "error" ? "🔴" : "⚪";

  return (
    <div className="card" style={{ padding: scr.mobile ? 14 : 20, borderRight: `3px solid ${statusColor}` }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-2.5">
        <div className="flex items-center gap-2">
          {integ && (
            <span className="text-[9px] px-2 py-0.5 rounded-md font-bold" style={{ background: statusBg, color: statusColor }}>
              {statusIcon} {statusText}
            </span>
          )}
          {integ?.provider && <Toggle value={integ.status === "active"} onChange={handleToggleStatus} />}
        </div>
        <div className="text-right">
          <div className="font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>{info.icon} {info.label}</div>
          {integ?.provider && (
            <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 10 }}>
              {integ.provider}
              {integ.last_synced_at && ` — ${new Date(integ.last_synced_at).toLocaleString("ar")}`}
            </div>
          )}
        </div>
      </div>

      {/* Provider chips */}
      <div className="flex gap-1.5 flex-wrap mb-2">
        {info.providers.map((provider) => (
          <button key={provider} onClick={() => handleSelectProvider(provider)}
            className={`chip text-[10px] ${integ?.provider === provider ? "chip-active" : ""}`}>
            {provider}
          </button>
        ))}
      </div>

      {/* Config fields */}
      {selectedProvider && fields.length > 0 && (
        <div className="mt-3 bg-surface-elevated rounded-xl p-3 space-y-2.5">
          {/* Config header with summary */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {allConfigured ? (
                <span className="text-[9px] px-2 py-0.5 rounded-md font-bold" style={{ background: "rgba(34,197,94,0.12)", color: "#22c55e" }}>
                  ✅ {fields.length}/{fields.length} مُعد
                </span>
              ) : hasAnyField ? (
                <span className="text-[9px] px-2 py-0.5 rounded-md font-bold" style={{ background: "rgba(234,179,8,0.12)", color: "#eab308" }}>
                  ⚠️ {configuredCount}/{fields.length} مُعد
                </span>
              ) : (
                <span className="text-[9px] px-2 py-0.5 rounded-md font-bold" style={{ background: "rgba(239,68,68,0.12)", color: "#ef4444" }}>
                  ❌ لم يتم الإعداد
                </span>
              )}
            </div>
            <div className="font-bold text-right text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              🔑 إعدادات {selectedProvider}
            </div>
          </div>

          {fields.map((f) => {
            const isSensitive = f.type === "password";
            const isSaved = hasSavedKey(f.key);
            const currentVal = configDraft[f.key] || "";
            const isStillMasked = isSensitive && currentVal.includes(MASK);
            const hasVal = fieldHasValue(f.key);

            return (
              <div key={f.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1">
                    {hasVal ? (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: "rgba(34,197,94,0.1)", color: "#22c55e" }}>
                        {isSaved ? "🔒 محفوظ" : "✓ مُعبأ"}
                      </span>
                    ) : (
                      <span className="text-[8px] px-1.5 py-0.5 rounded font-bold"
                        style={{ background: "rgba(239,68,68,0.08)", color: "#ef4444" }}>
                        فارغ
                      </span>
                    )}
                  </div>
                  <label className="text-muted text-right" style={{ fontSize: scr.mobile ? 9 : 10 }}>{f.label}</label>
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type={isSensitive && !showSecrets[f.key] ? "password" : "text"}
                    className="input flex-1"
                    style={{
                      fontSize: scr.mobile ? 11 : 13,
                      borderColor: hasVal ? "rgba(34,197,94,0.2)" : undefined,
                    }}
                    placeholder={isSaved ? "اضغط لتحديث القيمة..." : f.placeholder}
                    value={currentVal}
                    onChange={(e) => setConfigDraft((prev) => ({ ...prev, [f.key]: e.target.value }))}
                    onFocus={() => {
                      if (isStillMasked) setConfigDraft((prev) => ({ ...prev, [f.key]: "" }));
                    }}
                    dir="ltr"
                  />
                  {isSensitive && (
                    <button onClick={() => setShowSecrets((p) => ({ ...p, [f.key]: !p[f.key] }))}
                      className="w-8 h-8 rounded-lg border border-surface-border bg-transparent text-muted cursor-pointer flex items-center justify-center text-xs"
                      title={showSecrets[f.key] ? "إخفاء" : "إظهار"}>
                      {showSecrets[f.key] ? "🙈" : "👁️"}
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 pt-2 border-t border-surface-border">
            <button onClick={handleSaveConfig} disabled={saving} className="btn-primary flex-1"
              style={{ fontSize: scr.mobile ? 10 : 12, padding: scr.mobile ? "8px 12px" : "10px 16px", opacity: saving ? 0.6 : 1 }}>
              {saving ? "⏳ جاري الحفظ..." : "💾 حفظ"}
            </button>
            <button onClick={handleTest} disabled={testing || !hasAnyField} className="btn-outline"
              style={{
                fontSize: scr.mobile ? 10 : 12,
                padding: scr.mobile ? "8px 12px" : "10px 16px",
                opacity: testing || !hasAnyField ? 0.5 : 1,
                minWidth: scr.mobile ? 90 : 120,
              }}>
              {testing ? (
                <span className="flex items-center gap-1 justify-center">
                  <span className="animate-spin inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full" />
                  جاري الاختبار...
                </span>
              ) : "🔌 اختبار الاتصال"}
            </button>
          </div>

          {/* Test result with animation */}
          {testResult && (
            <div className="rounded-lg px-3 py-2.5 font-bold animate-fade-in" style={{
              fontSize: scr.mobile ? 10 : 12,
              background: testResult.ok ? "rgba(34,197,94,0.1)" : "rgba(239,68,68,0.1)",
              color: testResult.ok ? "#22c55e" : "#ef4444",
              border: `1px solid ${testResult.ok ? "rgba(34,197,94,0.25)" : "rgba(239,68,68,0.25)"}`,
            }}>
              <div className="flex items-center gap-2">
                <span style={{ fontSize: 18 }}>{testResult.ok ? "✅" : "❌"}</span>
                <div className="flex-1 text-right">
                  <div>{testResult.ok ? "الاتصال ناجح" : "فشل الاتصال"}</div>
                  <div style={{ fontSize: scr.mobile ? 9 : 10, opacity: 0.8, fontWeight: 400, marginTop: 2 }}>
                    {testResult.message}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* No-config provider hint */}
      {selectedProvider && fields.length === 0 && (
        <div className="mt-2 bg-surface-elevated rounded-xl p-2 text-muted text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>
          ℹ️ هذا المزوّد لا يتطلب إعدادات إضافية حالياً
        </div>
      )}
    </div>
  );
}

// ===== Main Settings Page =====
export default function SettingsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const { settings, integrations, loading, error, clearError, updateSetting, updateIntegration } = useAdminSettings();
  const [tab, setTab] = useState<"store" | "integrations">("store");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const logoSize = parseInt(settings.logo_size || "48", 10);

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  const tabs = [
    { key: "store" as const, icon: "🏪", label: "المتجر" },
    { key: "integrations" as const, icon: "🔌", label: "التكاملات" },
  ];

  const settingFields = [
    { key: "store_name", label: "اسم المتجر", type: "text" },
    { key: "store_tagline_ar", label: "الوصف (عربي)", type: "text" },
    { key: "store_tagline_he", label: "הסיסמה (עברית)", type: "text" },
    { key: "phone", label: "📞 رقم الهاتف", type: "text" },
    { key: "whatsapp_number", label: "💬 رقم الواتساب", type: "text" },
    { key: "email", label: "📧 البريد الإلكتروني", type: "text" },
    { key: "admin_phone", label: "👨‍💼 رقم الأدمن (الإشعارات)", type: "text", hint: "يستقبل تنبيهات الطلبات الجديدة والمشاكل" },
    { key: "reports_phone", label: "📊 رقم التقارير", type: "text", hint: "يستقبل التقارير اليومية والأسبوعية عبر واتساب" },
    { key: "delivery_note_ar", label: "ملاحظة التوصيل (عربي)", type: "text" },
    { key: "delivery_note_he", label: "הערת משלוח (עברית)", type: "text" },
    { key: "accent_color", label: "🎨 اللون الرئيسي", type: "color" },
  ];

  const handleUpdateIntegration = async (
    type: string,
    updates: { provider?: string; config?: Record<string, string>; status?: string }
  ) => {
    const integ = integrations.find((i) => i.type === type);
    if (!integ) return;
    await updateIntegration(integ.id, {
      ...(updates.provider !== undefined && { provider: updates.provider }),
      ...(updates.config !== undefined && { config: updates.config }),
      ...(updates.status !== undefined && { status: updates.status }),
      last_synced_at: new Date().toISOString(),
    });
  };

  return (
    <div>
      <h1 className="font-black mb-4" style={{ fontSize: scr.mobile ? 16 : 22 }}>⚙️ الإعدادات</h1>
      <ErrorBanner error={error} onDismiss={clearError} />

      {/* Tabs */}
      <div className="flex gap-1.5 mb-4">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`chip ${tab === t.key ? "chip-active" : ""}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Store Settings */}
      {tab === "store" && (
        <div className="space-y-3">
          {/* Logo Upload Section */}
          <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
            <h2 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 16 }}>🖼️ شعار المتجر</h2>

            <div className="flex items-center gap-4 flex-wrap">
              {/* Preview */}
              <div className="w-24 h-24 rounded-xl border-2 border-dashed border-surface-border flex items-center justify-center bg-surface-elevated shrink-0 overflow-hidden">
                {settings.logo_url ? (
                  <img src={settings.logo_url} alt="Logo" className="object-contain" style={{ width: logoSize, height: logoSize }} />
                ) : (
                  <div className="text-center text-muted">
                    <div className="text-2xl mb-0.5">🖼️</div>
                    <div style={{ fontSize: 9 }}>لا يوجد شعار</div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex-1 space-y-2">
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp,image/svg+xml" className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { show("❌ الحد الأقصى 2MB"); return; }
                    setUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append("file", file);
                      const res = await fetch("/api/admin/upload-logo", { method: "POST", body: fd });
                      const data = await res.json();
                      if (data.url) {
                        await updateSetting("logo_url", data.url);
                        invalidateLogoCache();
                        show("✅ تم رفع الشعار");
                      } else {
                        show(`❌ ${data.error || "خطأ"}`);
                      }
                    } catch { show("❌ خطأ في الرفع"); }
                    setUploading(false);
                    if (fileRef.current) fileRef.current.value = "";
                  }}
                />
                <div className="flex gap-2">
                  <button onClick={() => fileRef.current?.click()} disabled={uploading}
                    className="btn-primary" style={{ fontSize: scr.mobile ? 10 : 12, padding: "8px 16px", opacity: uploading ? 0.6 : 1 }}>
                    {uploading ? "⏳ جاري الرفع..." : "📤 رفع شعار"}
                  </button>
                  {settings.logo_url && (
                    <button className="btn-outline" style={{ fontSize: scr.mobile ? 10 : 12, padding: "8px 16px" }}
                      onClick={async () => {
                        try {
                          await fetch("/api/admin/upload-logo", {
                            method: "DELETE",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ url: settings.logo_url }),
                          });
                          await updateSetting("logo_url", "");
                          invalidateLogoCache();
                          show("✅ تم حذف الشعار");
                        } catch { show("❌ خطأ في الحذف"); }
                      }}>
                      🗑️ حذف
                    </button>
                  )}
                </div>
                <p className="text-muted" style={{ fontSize: 9 }}>JPG, PNG, WebP, SVG — حد أقصى 2MB</p>
              </div>
            </div>

            {/* Size Slider */}
            <div className="mt-4">
              <FormField label="📐 حجم الشعار (بكسل)">
                <div className="flex items-center gap-3">
                  <input type="range" min={24} max={120} step={4} value={logoSize}
                    className="flex-1 accent-brand"
                    onChange={async (e) => {
                      await updateSetting("logo_size", e.target.value);
                    }}
                    onMouseUp={() => show("✅ تم الحفظ")}
                    onTouchEnd={() => show("✅ تم الحفظ")}
                  />
                  <span className="text-muted text-xs font-mono w-10 text-center">{logoSize}px</span>
                </div>
              </FormField>
            </div>
          </div>

          {/* Store Fields */}
          <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
            <h2 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 16 }}>🏪 إعدادات المتجر</h2>
          {settingFields.map((f) => (
            <FormField key={f.key} label={f.label}>
              {f.type === "color" ? (
                <div className="flex items-center gap-2">
                  <input type="color" value={settings[f.key] || "#c41040"}
                    onChange={async (e) => { await updateSetting(f.key, e.target.value); show("✅"); }}
                    className="w-10 h-10 rounded-lg cursor-pointer border border-surface-border" />
                  <span className="text-muted text-xs font-mono">{settings[f.key] || "#c41040"}</span>
                </div>
              ) : (
                <>
                  <input className="input" value={settings[f.key] || ""}
                    onChange={(e) => updateSetting(f.key, e.target.value)}
                    onBlur={() => show("✅ تم الحفظ")}
                    dir={f.key.endsWith("_he") ? "rtl" : "auto"}
                    placeholder={f.key === "admin_phone" || f.key === "reports_phone" ? "05X-XXXXXXX" : undefined}
                  />
                  {"hint" in f && f.hint && (
                    <p className="text-dim mt-0.5" style={{ fontSize: 9, lineHeight: 1.4 }}>{f.hint}</p>
                  )}
                </>
              )}
            </FormField>
          ))}
        </div>
        </div>
      )}

      {/* Integrations Hub */}
      {tab === "integrations" && (
        <div>
          <p className="text-muted text-right mb-3" style={{ fontSize: scr.mobile ? 10 : 12 }}>
            اختر المزوّد المناسب لكل خدمة وأدخل بيانات الاتصال. يمكنك التبديل لاحقاً بدون تغيير الكود.
          </p>
          <div className="space-y-3">
            {Object.entries(INTEGRATION_TYPES).map(([type, info]) => {
              const integ = integrations.find((i) => i.type === type);
              return (
                <IntegrationCard key={type} type={type} info={info} integ={integ}
                  scr={scr} onUpdate={handleUpdateIntegration} show={show} />
              );
            })}
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} />
    </div>
  );
}
