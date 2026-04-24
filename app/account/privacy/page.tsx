"use client";

// =====================================================
// /account/privacy — Data Subject Rights UI
// Lets the customer:
//  • Export their data (JSON download)
//  • Manage marketing/cookie consent flags
//  • Delete their account (soft + 7yr tax retention notice)
// =====================================================

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { reopenCookieConsent } from "@/components/shared/CookieConsent";

interface ConsentState {
  consent_functional: boolean;
  consent_analytics: boolean;
  consent_advertising: boolean;
  consent_marketing_email: boolean;
  consent_marketing_sms: boolean;
  consent_marketing_whatsapp: boolean;
  privacy_version_accepted?: string | null;
  privacy_accepted_at?: string | null;
}

const EMPTY: ConsentState = {
  consent_functional: false,
  consent_analytics: false,
  consent_advertising: false,
  consent_marketing_email: false,
  consent_marketing_sms: false,
  consent_marketing_whatsapp: false,
};

export default function AccountPrivacyPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const router = useRouter();
  const isHe = lang === "he";

  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [consent, setConsent] = useState<ConsentState>(EMPTY);
  const [confirmDelete, setConfirmDelete] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem("clal_customer_token");
    if (!t) {
      router.push("/store/account");
      return;
    }
    setToken(t);
  }, [router]);

  useEffect(() => {
    if (!token) return;
    (async () => {
      try {
        const res = await fetch("/api/customer/consent", {
          headers: { Authorization: `Bearer ${token}` },
        });
        const json = await res.json();
        if (json.success) setConsent({ ...EMPTY, ...(json.data ?? json) });
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const update = (k: keyof ConsentState, v: boolean) => setConsent((p) => ({ ...p, [k]: v }));

  const save = async () => {
    if (!token) return;
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch("/api/customer/consent", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(consent),
      });
      const json = await res.json();
      if (json.success) {
        setMsg(isHe ? "✅ נשמר" : "✅ تم الحفظ");
      } else {
        setMsg(json.error || (isHe ? "שגיאה" : "خطأ"));
      }
    } catch {
      setMsg(isHe ? "שגיאת רשת" : "خطأ في الشبكة");
    } finally {
      setSaving(false);
      setTimeout(() => setMsg(""), 3000);
    }
  };

  const exportData = async () => {
    if (!token) return;
    setExporting(true);
    try {
      const res = await fetch("/api/customer/data/export", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setMsg(j.error || (isHe ? "שגיאה" : "خطأ"));
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `clalmobile-data-${Date.now()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg(isHe ? "✅ הקובץ הורד" : "✅ تم تنزيل الملف");
    } catch {
      setMsg(isHe ? "שגיאת רשת" : "خطأ في الشبكة");
    } finally {
      setExporting(false);
      setTimeout(() => setMsg(""), 4000);
    }
  };

  const deleteAccount = async () => {
    if (!token) return;
    const phrase = confirmDelete.trim();
    if (!["DELETE", "מחק", "احذف", "حذف"].includes(phrase)) {
      setMsg(isHe ? 'יש להקליד "מחק" או "DELETE"' : 'اكتب "حذف" أو "DELETE" للتأكيد');
      return;
    }
    setDeleting(true);
    try {
      const res = await fetch("/api/customer/data/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirm: phrase }),
      });
      const json = await res.json();
      if (json.success) {
        // Clear local session and redirect home
        localStorage.removeItem("clal_customer_token");
        localStorage.removeItem("clal_customer");
        alert(isHe ? "החשבון נמחק. תועבר לדף הבית." : "تم حذف الحساب. سيتم نقلك للصفحة الرئيسية.");
        router.push("/");
      } else {
        setMsg(json.error || (isHe ? "שגיאה" : "خطأ"));
      }
    } catch {
      setMsg(isHe ? "שגיאת רשת" : "خطأ في الشبكة");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <>
        <StoreHeader />
        <main dir="rtl" className="min-h-screen bg-surface-bg p-8 text-center text-muted">
          ⏳ {isHe ? "טוען..." : "جاري التحميل..."}
        </main>
      </>
    );
  }

  return (
    <>
      <StoreHeader />
      <main dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
        <div className="max-w-3xl mx-auto" style={{ padding: scr.mobile ? "16px 14px 80px" : "32px 28px 100px" }}>
          <div className="text-center mb-6">
            <h1 className="font-black text-white mb-2" style={{ fontSize: scr.mobile ? 22 : 28 }}>
              🔐 {isHe ? "הפרטיות שלי" : "خصوصيّتي"}
            </h1>
            <p className="text-muted text-xs">
              {isHe
                ? "ניהול הסכמות, ייצוא נתונים, ומחיקת חשבון — לפי תיקון 13 לחוק הגנת הפרטיות"
                : "إدارة الموافقات، تصدير البيانات، وحذف الحساب — بموجب تيكون 13 لقانون حماية الخصوصية"}
            </p>
          </div>

          {msg && (
            <div className="card mb-3 border-state-info/30 bg-state-info/5 text-state-info" style={{ padding: 12 }}>
              <div className="text-sm text-center">{msg}</div>
            </div>
          )}

          {/* ───── Consent toggles ───── */}
          <Card title={isHe ? "ניהול הסכמות" : "إدارة الموافقات"}>
            <Toggle
              label={isHe ? "עוגיות פונקציונליות" : "العوّكيز الوظيفية"}
              desc={isHe ? "זיכרון העדפות, שפה, תצוגה" : "تذكّر التفضيلات، اللغة، العرض"}
              value={consent.consent_functional}
              onChange={(v) => update("consent_functional", v)}
            />
            <Toggle
              label={isHe ? "אנליטיקה (Google Analytics)" : "التحليلات (Google Analytics)"}
              desc={isHe ? "מסייע לנו להבין שימוש באתר" : "يساعدنا على فهم استخدام الموقع"}
              value={consent.consent_analytics}
              onChange={(v) => update("consent_analytics", v)}
            />
            <Toggle
              label={isHe ? "פרסום (Meta Pixel)" : "الإعلانات (Meta Pixel)"}
              desc={isHe ? "פרסום ממוקד ושיווק מחדש" : "الإعلانات المخصّصة وإعادة الاستهداف"}
              value={consent.consent_advertising}
              onChange={(v) => update("consent_advertising", v)}
            />
            <div className="border-t border-surface-border my-3" />
            <Toggle
              label={isHe ? "שיווק במייל" : "التسويق بالبريد الإلكتروني"}
              desc={isHe ? "מבצעים, מוצרים חדשים" : "العروض والمنتجات الجديدة"}
              value={consent.consent_marketing_email}
              onChange={(v) => update("consent_marketing_email", v)}
            />
            <Toggle
              label={isHe ? "שיווק ב-SMS" : "التسويق بالرسائل القصيرة (SMS)"}
              desc={isHe ? "התראות מבצעים בלבד" : "تنبيهات العروض فقط"}
              value={consent.consent_marketing_sms}
              onChange={(v) => update("consent_marketing_sms", v)}
            />
            <Toggle
              label={isHe ? "שיווק בוואטסאפ" : "التسويق عبر واتساب"}
              desc={isHe ? "התראות מבצעים בוואטסאפ" : "تنبيهات العروض على واتساب"}
              value={consent.consent_marketing_whatsapp}
              onChange={(v) => update("consent_marketing_whatsapp", v)}
            />
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="btn-primary w-full mt-4 disabled:opacity-50"
              style={{ fontSize: 14, padding: "12px" }}
            >
              {saving ? "⏳ ..." : isHe ? "💾 שמור הסכמות" : "💾 حفظ الموافقات"}
            </button>
            <button
              type="button"
              onClick={reopenCookieConsent}
              className="w-full mt-2 rounded-xl border border-surface-border bg-surface-elevated py-2.5 text-xs text-muted"
            >
              ⚙️ {isHe ? "פתח באנר עוגיות" : "افتح بانر العوّكيز"}
            </button>
          </Card>

          {/* ───── Data export ───── */}
          <Card title={isHe ? "ייצוא נתונים" : "تصدير بياناتك"}>
            <p className="text-muted text-xs leading-relaxed mb-3">
              {isHe
                ? "ניתן להוריד את כל המידע שאנו מחזיקים עליך בפורמט JSON. כולל פרופיל, הזמנות, רישום הסכמות וקישורי HOT."
                : "يمكنك تنزيل كل المعلومات التي نحتفظ بها عنك بصيغة JSON. تشمل الملف الشخصي، الطلبات، سجل الموافقات، وروابط HOT."}
            </p>
            <button
              type="button"
              onClick={exportData}
              disabled={exporting}
              className="rounded-xl border border-brand bg-brand/10 px-4 py-2.5 text-sm font-bold text-brand disabled:opacity-50"
            >
              {exporting ? "⏳ ..." : isHe ? "⬇️ הורד את הנתונים שלי" : "⬇️ نزّل بياناتي"}
            </button>
          </Card>

          {/* ───── Delete account ───── */}
          <div className="card border-state-error/30 bg-state-error/5 mb-3" style={{ padding: 14 }}>
            <h3 className="font-bold text-state-error mb-2 text-base">
              ⚠️ {isHe ? "מחיקת חשבון" : "حذف الحساب"}
            </h3>
            <p className="text-muted text-xs leading-relaxed mb-3">
              {isHe
                ? "פעולה זו תמחק את הפרופיל שלך, את הסכמותיך ואת המועדפים. החשבוניות וההזמנות יישמרו 7 שנים על פי פקודת מס הכנסה. הפעולה אינה הפיכה."
                : "هذه العملية ستحذف ملفّك الشخصي، موافقاتك، والمفضّلة. الفواتير والطلبات تبقى 7 سنوات وفقاً لقانون ضريبة الدخل. لا يمكن التراجع."}
            </p>
            <input
              type="text"
              value={confirmDelete}
              onChange={(e) => setConfirmDelete(e.target.value)}
              placeholder={isHe ? "הקלד \"מחק\" לאישור" : "اكتب \"حذف\" للتأكيد"}
              className="input w-full mb-2"
              dir={isHe ? "rtl" : "rtl"}
            />
            <button
              type="button"
              onClick={deleteAccount}
              disabled={deleting || !confirmDelete}
              className="w-full rounded-xl border-2 border-state-error bg-state-error py-2.5 text-sm font-bold text-white disabled:opacity-50"
            >
              {deleting ? "⏳ ..." : isHe ? "🗑 מחק חשבון לצמיתות" : "🗑 حذف الحساب نهائياً"}
            </button>
          </div>

          <div className="text-center mt-6">
            <Link href="/privacy" className="text-brand text-xs underline">
              📄 {isHe ? "קרא את מדיניות הפרטיות המלאה" : "اقرأ سياسة الخصوصية الكاملة"}
            </Link>
          </div>
        </div>
        <Footer />
      </main>
    </>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-3" style={{ padding: 14 }}>
      <h3 className="font-bold text-white mb-3 text-base">{title}</h3>
      {children}
    </div>
  );
}

function Toggle({
  label,
  desc,
  value,
  onChange,
}: {
  label: string;
  desc: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-surface-border last:border-b-0">
      <button
        type="button"
        onClick={() => onChange(!value)}
        className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors cursor-pointer"
        style={{ background: value ? "#c41040" : "#3f3f46" }}
        aria-checked={value}
        role="switch"
        aria-label={label}
      >
        <span
          className="absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform"
          style={{ transform: value ? "translateX(-22px)" : "translateX(-2px)" }}
        />
      </button>
      <div className="flex-1 text-right">
        <div className="font-bold text-white text-sm">{label}</div>
        <p className="text-muted text-[11px] leading-relaxed mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
