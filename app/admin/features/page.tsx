"use client";

export const dynamic = 'force-dynamic';

// =====================================================
// ClalMobile — Admin Features Control Panel
// Toggle & configure all platform features
// =====================================================

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { Toggle, FormField } from "@/components/admin/shared";

interface FeatureConfig {
  key: string;
  icon: string;
  label: string;
  description: string;
  settingKey: string;
  configFields?: { key: string; label: string; type: string; placeholder: string }[];
}

const FEATURES: FeatureConfig[] = [
  {
    key: "abandoned_cart", icon: "🛒", label: "السلة المهجورة",
    description: "إرسال تذكير واتساب تلقائي للزبائن اللي ما أكملوا الطلب",
    settingKey: "feature_abandoned_cart",
    configFields: [
      { key: "abandoned_cart_delay_minutes", label: "وقت الانتظار (دقائق)", type: "number", placeholder: "60" },
      { key: "abandoned_cart_message", label: "نص الرسالة", type: "textarea", placeholder: "نسيت سلتك؟ عندك منتجات بانتظارك! 🛒" },
    ],
  },
  {
    key: "reviews", icon: "⭐", label: "تقييمات المنتجات",
    description: "السماح للزبائن بتقييم المنتجات بعد الشراء (تحتاج موافقة الأدمن)",
    settingKey: "feature_reviews",
  },
  {
    key: "push", icon: "🔔", label: "إشعارات Push",
    description: "إرسال إشعارات فورية لمتصفحات الزبائن عن العروض والمنتجات الجديدة",
    settingKey: "feature_push_notifications",
  },
  {
    key: "analytics", icon: "📊", label: "Google Analytics + Pixels",
    description: "تتبع زيارات الموقع وتحويلات الشراء",
    settingKey: "feature_analytics",
    configFields: [
      { key: "ga_measurement_id", label: "Google Analytics Measurement ID", type: "text", placeholder: "G-XXXXXXXX" },
      { key: "meta_pixel_id", label: "Meta (Facebook) Pixel ID", type: "text", placeholder: "1234567890" },
    ],
  },
  {
    key: "deals", icon: "🔥", label: "صفحة العروض",
    description: "صفحة عروض خاصة مع عداد تنازلي وخصومات محدودة",
    settingKey: "feature_deals",
  },
  {
    key: "pdf", icon: "📄", label: "تصدير PDF",
    description: "تصدير التقارير والفواتير كملفات PDF",
    settingKey: "feature_pdf_export",
  },
];

export default function FeaturesPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, any>>({});

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        const sd = json.data ?? json;
        setSettings(sd.settings || sd || {});

        // Load feature stats
        const statsRes = await fetch("/api/admin/features/stats");
        if (statsRes.ok) {
          const s = await statsRes.json();
          setStats(s.data ?? s);
        }
      } catch {}
      setLoading(false);
    }
    load();
  }, []);

  const updateSetting = async (key: string, value: string) => {
    try {
      await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "setting", key, value }),
      });
      setSettings((prev) => ({ ...prev, [key]: value }));
      show("✅ تم الحفظ");
    } catch {
      show("❌ خطأ في الحفظ", "error");
    }
  };

  const toggleFeature = async (settingKey: string, enabled: boolean) => {
    await updateSetting(settingKey, enabled ? "true" : "false");
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <h1 className="font-black mb-2" style={{ fontSize: scr.mobile ? 16 : 22 }}>🎛️ إدارة الميزات</h1>
      <p className="text-muted text-right mb-4" style={{ fontSize: scr.mobile ? 10 : 12 }}>
        تحكم كامل في جميع ميزات المنصة — فعّل أو عطّل أي ميزة بنقرة واحدة
      </p>

      <div className="space-y-3">
        {FEATURES.map((f) => {
          const isEnabled = settings[f.settingKey] === "true";
          const featureStats = stats[f.key];

          return (
            <div key={f.key} className="card" style={{ padding: scr.mobile ? 14 : 20, opacity: isEnabled ? 1 : 0.7, transition: "opacity 0.3s" }}>
              {/* Header */}
              <div className="flex items-center justify-between mb-2">
                <Toggle value={isEnabled} onChange={(v) => toggleFeature(f.settingKey, v)} />
                <div className="text-right flex-1 mr-3">
                  <div className="font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>
                    {f.icon} {f.label}
                  </div>
                  <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                    {f.description}
                  </div>
                </div>
              </div>

              {/* Stats */}
              {isEnabled && featureStats && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {Object.entries(featureStats).map(([k, v]) => (
                    <div key={k} className="bg-surface-elevated rounded-lg px-3 py-1.5 text-center">
                      <div className="font-bold text-brand" style={{ fontSize: 16 }}>{String(v)}</div>
                      <div className="text-muted" style={{ fontSize: 9 }}>{k}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Config Fields */}
              {isEnabled && f.configFields && (
                <div className="mt-3 bg-surface-elevated rounded-xl p-3 space-y-2.5">
                  <div className="font-bold text-right text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                    ⚙️ إعدادات {f.label}
                  </div>
                  {f.configFields.map((cf) => (
                    <FormField key={cf.key} label={cf.label}>
                      {cf.type === "textarea" ? (
                        <textarea
                          className="input min-h-[60px] resize-y"
                          style={{ fontSize: scr.mobile ? 11 : 13 }}
                          value={settings[cf.key] || ""}
                          placeholder={cf.placeholder}
                          onChange={(e) => setSettings((prev) => ({ ...prev, [cf.key]: e.target.value }))}
                          onBlur={(e) => updateSetting(cf.key, e.target.value)}
                          dir="auto"
                        />
                      ) : (
                        <input
                          className="input"
                          type={cf.type}
                          style={{ fontSize: scr.mobile ? 11 : 13 }}
                          value={settings[cf.key] || ""}
                          placeholder={cf.placeholder}
                          onChange={(e) => setSettings((prev) => ({ ...prev, [cf.key]: e.target.value }))}
                          onBlur={(e) => updateSetting(cf.key, e.target.value)}
                          dir="ltr"
                        />
                      )}
                    </FormField>
                  ))}
                </div>
              )}

              {/* Quick links */}
              {isEnabled && f.key === "reviews" && (
                <div className="mt-2">
                  <a href="/admin/reviews" className="text-brand text-xs font-bold hover:underline">
                    📋 إدارة التقييمات →
                  </a>
                </div>
              )}
              {isEnabled && f.key === "deals" && (
                <div className="mt-2">
                  <a href="/admin/deals" className="text-brand text-xs font-bold hover:underline">
                    🔥 إدارة العروض →
                  </a>
                </div>
              )}
              {isEnabled && f.key === "push" && (
                <div className="mt-2">
                  <a href="/admin/push" className="text-brand text-xs font-bold hover:underline">
                    🔔 إرسال إشعار جديد →
                  </a>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
