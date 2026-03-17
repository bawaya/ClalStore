"use client";

import { useState } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";

export default function StoreContactPage() {
  const scr = useScreen();
  const { t } = useLang();
  const { toasts, show } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.message) {
      show(t("storeContact.error"), "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/admin/contact-notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          subject: "store-contact",
          message: form.message,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      setSubmitted(true);
      setForm({ name: "", phone: "", message: "" });
    } catch {
      show(t("storeContact.errorSend"), "error");
    } finally {
      setSending(false);
    }
  };

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />

      <div
        className="mx-auto"
        style={{
          maxWidth: scr.mobile ? "100%" : 520,
          padding: scr.mobile ? "30px 16px 60px" : "50px 28px 80px",
        }}
      >
        {submitted ? (
          /* ===== Thank You State ===== */
          <div className="card text-center" style={{ padding: scr.mobile ? 32 : 56 }}>
            <div className="text-6xl mb-4">✅</div>
            <h1 className="font-black mb-2" style={{ fontSize: scr.mobile ? 22 : 28 }}>
              {t("storeContact.thankTitle")}
            </h1>
            <p className="text-muted mb-8" style={{ fontSize: scr.mobile ? 13 : 15, lineHeight: 1.7 }}>
              {t("storeContact.thankMsg")}
            </p>

            <div className="flex flex-col gap-3 items-center">
              <Link
                href="/store"
                className="btn-primary w-full max-w-[280px] text-center py-3 font-bold"
                style={{ fontSize: scr.mobile ? 13 : 15 }}
              >
                🏪 {t("storeContact.backToStore")}
              </Link>
              <button
                onClick={() => setSubmitted(false)}
                className="btn-outline w-full max-w-[280px] py-3 font-bold"
                style={{ fontSize: scr.mobile ? 12 : 14 }}
              >
                📝 {t("storeContact.sendAnother")}
              </button>
            </div>
          </div>
        ) : (
          /* ===== Contact Form ===== */
          <div className="card" style={{ padding: scr.mobile ? 20 : 32 }}>
            <div className="text-center mb-6">
              <div className="text-4xl mb-2">📩</div>
              <h1 className="font-black mb-1" style={{ fontSize: scr.mobile ? 20 : 26 }}>
                {t("storeContact.title")}
              </h1>
              <p className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>
                {t("storeContact.subtitle")}
              </p>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">
                  {t("storeContact.name")} <span className="text-brand">*</span>
                </label>
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder={t("storeContact.namePH")}
                />
              </div>

              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">
                  {t("storeContact.phone")} <span className="text-brand">*</span>
                </label>
                <input
                  className="input"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="05X-XXXXXXX"
                  dir="ltr"
                />
              </div>

              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">
                  {t("storeContact.message")} <span className="text-brand">*</span>
                </label>
                <textarea
                  className="input min-h-[100px] resize-y"
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                  placeholder={t("storeContact.messagePH")}
                />
              </div>

              <button
                onClick={handleSubmit}
                disabled={sending}
                className="btn-primary w-full mt-2 py-3 font-bold"
                style={{ fontSize: scr.mobile ? 13 : 15 }}
              >
                {sending ? t("storeContact.sending") : t("storeContact.send")}
              </button>
            </div>

            <p className="text-center text-dim mt-4" style={{ fontSize: 10 }}>
              {t("storeContact.note")}
            </p>
          </div>
        )}
      </div>

      {/* Toasts */}
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${
            toast.type === "error"
              ? "border-state-error text-state-error"
              : "border-state-success text-state-success"
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
