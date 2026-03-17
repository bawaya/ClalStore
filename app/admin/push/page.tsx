"use client";

export const dynamic = 'force-dynamic';

// =====================================================
// ClalMobile — Admin Push Notifications
// Send push to all subscribers + history
// =====================================================

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PageHeader, FormField, EmptyState } from "@/components/admin/shared";

interface PushNotification {
  id: string;
  title: string;
  body: string;
  url?: string;
  icon?: string;
  sent_count: number;
  target: string;
  sent_at: string;
}

export default function AdminPushPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [notifications, setNotifications] = useState<PushNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [url, setUrl] = useState("https://clalmobile.com");

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/push/send");
      const json = await res.json();
      setNotifications(json.notifications || []);
    } catch {}
    setLoading(false);
  };

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      show("يرجى إدخال العنوان والنص", "error");
      return;
    }

    setSending(true);
    try {
      const res = await fetch("/api/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body, url }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      show(`✅ ${json.message}`);
      setTitle("");
      setBody("");
      setUrl("https://clalmobile.com");
      load();
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    }
    setSending(false);
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <PageHeader title="🔔 إشعارات Push" count={notifications.length} />

      {/* Send Form */}
      <div className="card mb-4" style={{ padding: scr.mobile ? 14 : 20 }}>
        <h3 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 13 : 15 }}>
          📤 إرسال إشعار جديد
        </h3>

        <div className="space-y-2.5">
          <FormField label="عنوان الإشعار *">
            <input
              className="input text-xs"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="🔥 عرض خاص!"
              dir="auto"
            />
          </FormField>

          <FormField label="نص الإشعار *">
            <textarea
              className="input text-xs min-h-[60px] resize-y"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="خصم 30% على جميع أجهزة Samsung!"
              dir="auto"
            />
          </FormField>

          <FormField label="رابط (عند النقر)">
            <input
              className="input text-xs"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://clalmobile.com/deals"
              dir="ltr"
            />
          </FormField>

          {/* Preview */}
          <div className="bg-surface-elevated rounded-xl p-3">
            <div className="text-[9px] text-muted mb-1.5">معاينة الإشعار:</div>
            <div className="flex items-start gap-2">
              <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center text-white text-sm">🔔</div>
              <div>
                <div className="font-bold text-xs">{title || "عنوان الإشعار"}</div>
                <div className="text-muted text-[10px]">{body || "نص الإشعار..."}</div>
              </div>
            </div>
          </div>

          <button
            onClick={send}
            disabled={sending}
            className="btn-primary w-full text-sm py-2.5 rounded-xl font-bold disabled:opacity-50"
          >
            {sending ? "⏳ جاري الإرسال..." : "📤 إرسال لجميع المشتركين"}
          </button>
        </div>
      </div>

      {/* History */}
      <h3 className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 13 : 15 }}>
        📋 سجل الإشعارات
      </h3>

      {notifications.length === 0 ? (
        <EmptyState icon="🔔" title="لا توجد إشعارات مرسلة بعد" />
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <div key={n.id} className="card flex items-center gap-3" style={{ padding: scr.mobile ? 10 : 14 }}>
              <div className="w-10 h-10 bg-surface-elevated rounded-lg flex items-center justify-center text-xl flex-shrink-0">🔔</div>
              <div className="flex-1 text-right min-w-0">
                <div className="font-bold truncate text-xs">{n.title}</div>
                <div className="text-muted text-[10px] truncate">{n.body}</div>
                <div className="flex gap-2 text-[9px] text-muted mt-0.5">
                  <span>📤 {n.sent_count} مشترك</span>
                  <span>📅 {new Date(n.sent_at).toLocaleDateString("ar")}</span>
                  <span>{new Date(n.sent_at).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
