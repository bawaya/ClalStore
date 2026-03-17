"use client";

import { useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { Navbar, Footer } from "@/components/website/sections";

export default function ContactPage() {
  const scr = useScreen();
  const { t } = useLang();
  const { toasts, show } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.message) {
      show(t("contact.error"), "error");
      return;
    }
    setSending(true);
    try {
      // Send WhatsApp notification to admin (primary notification)
      const notifyRes = await fetch('/api/admin/contact-notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          email: form.email,
          subject: form.subject,
          message: form.message,
        })
      });
      if (!notifyRes.ok) throw new Error('Notify failed');

      // Send email (non-blocking, best-effort)
      fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'info@clalmobile.com',
          subject: `Contact from ${form.name}`,
          html: `
            <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif">
              <h2>New contact form message</h2>
              <p><strong>Name:</strong> ${form.name}</p>
              <p><strong>Phone:</strong> ${form.phone}</p>
              <p><strong>Email:</strong> ${form.email || "—"}</p>
              <p><strong>Subject:</strong> ${form.subject || "—"}</p>
              <p><strong>Message:</strong></p>
              <p>${form.message}</p>
            </div>
          `
        })
      }).catch(() => {}); // fire-and-forget

      setSubmitted(true);
      setForm({ name: "", phone: "", email: "", subject: "", message: "" });
    } catch {
      show("❌ حدث خطأ، يرجى المحاولة مرة أخرى", "error");
    } finally {
      setSending(false);
    }
  };

  const contactCards = [
    { icon: "📞", title: t("contact.phoneLabel"), value: "053-3337653", href: "tel:0533337653" },
    { icon: "💬", title: t("contact.whatsapp"), value: "053-3337653", href: "https://wa.me/972533337653" },
    { icon: "📧", title: t("contact.emailLabel"), value: "info@clalmobile.com", href: "mailto:info@clalmobile.com" },
  ];

  const days = [
    { key: "sun", hours: "9:00 — 18:00", active: true },
    { key: "mon", hours: "9:00 — 18:00", active: true },
    { key: "tue", hours: "9:00 — 18:00", active: true },
    { key: "wed", hours: "9:00 — 18:00", active: true },
    { key: "thu", hours: "9:00 — 18:00", active: true },
    { key: "fri", hours: t("contact.closed"), active: false },
    { key: "sat", hours: t("contact.closed"), active: false },
  ];

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto" style={{ paddingTop: scr.mobile ? 80 : 100, padding: scr.mobile ? "80px 16px 40px" : "100px 24px 64px" }}>
        <h1 className="font-black text-center mb-2" style={{ fontSize: scr.mobile ? 24 : 36 }}>{t("contact.title")}</h1>
        <p className="text-center text-muted mb-6" style={{ fontSize: scr.mobile ? 12 : 14 }}>{t("contact.subtitle")}</p>

        {/* Contact cards */}
        <div className="grid gap-2 mb-6" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr 1fr" }}>
          {contactCards.map((c) => (
            <a key={c.title} href={c.href} className="card text-center hover:border-brand/30 transition-all" style={{ padding: scr.mobile ? 16 : 24 }}>
              <div className="text-3xl mb-2">{c.icon}</div>
              <div className="font-bold text-sm mb-0.5">{c.title}</div>
              <div className="text-brand text-sm font-bold">{c.value}</div>
            </a>
          ))}
        </div>

        {/* Thank you state after submission */}
        {submitted ? (
          <div className="card text-center" style={{ padding: scr.mobile ? 32 : 48 }}>
            <div className="text-5xl mb-4">✅</div>
            <h2 className="font-black text-xl mb-2">{t("contact.thankYouTitle")}</h2>
            <p className="text-muted mb-6" style={{ fontSize: scr.mobile ? 13 : 15 }}>
              {t("contact.thankYouMsg")}
            </p>
            <div className="flex gap-3 justify-center flex-wrap">
              <a href="/store" className="btn-primary px-6 py-3 text-sm font-bold">
                🏪 {t("contact.backToStore")}
              </a>
              <button onClick={() => setSubmitted(false)} className="btn-outline px-6 py-3 text-sm font-bold">
                📝 {t("contact.sendAnother")}
              </button>
            </div>
          </div>
        ) : (
        <>
        {/* Hours + Form */}
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
          {/* Working hours */}
          <div className="card mb-3" style={{ padding: scr.mobile ? 16 : 24, flex: scr.desktop ? "0 0 240px" : undefined }}>
            <h3 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 16 }}>{t("contact.hours")}</h3>
            {days.map((d) => (
              <div key={d.key} className="flex justify-between py-1 border-b border-surface-border last:border-0">
                <span className={`text-xs ${d.active ? "text-state-success" : "text-dim"}`}>{d.hours}</span>
                <span className="text-xs text-muted">{t(`contact.${d.key}`)}</span>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 16 : 24 }}>
            <h3 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 16 }}>{t("contact.sendMsg")}</h3>

            <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">{t("contact.name")} <span className="text-brand">*</span></label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">{t("contact.phone")} <span className="text-brand">*</span></label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05X-XXXXXXX" dir="ltr" />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-muted text-[10px] font-semibold mb-1">{t("contact.email")}</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div className="mt-2">
              <label className="block text-muted text-[10px] font-semibold mb-1">{t("contact.subject")}</label>
              <select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                <option value="">{t("contact.choose")}</option>
                <option value="order">{t("contact.subOrder")}</option>
                <option value="product">{t("contact.subProduct")}</option>
                <option value="plan">{t("contact.subPlan")}</option>
                <option value="support">{t("contact.subSupport")}</option>
                <option value="complaint">{t("contact.subComplaint")}</option>
                <option value="other">{t("contact.subOther")}</option>
              </select>
            </div>
            <div className="mt-2">
              <label className="block text-muted text-[10px] font-semibold mb-1">{t("contact.message")} <span className="text-brand">*</span></label>
              <textarea className="input min-h-[80px] resize-y" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>

            <button onClick={handleSubmit} disabled={sending} className="btn-primary w-full mt-3" style={{ fontSize: scr.mobile ? 12 : 14 }}>
              {sending ? t("contact.sending") : t("contact.send")}
            </button>
          </div>
        </div>
        </>
        )}
      </div>
      <Footer />

      {toasts.map((toast) => <div key={toast.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${toast.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{toast.message}</div>)}
    </div>
  );
}
