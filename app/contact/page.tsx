"use client";

import { useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { Navbar, Footer } from "@/components/website/sections";

export default function ContactPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", subject: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async () => {
    if (!form.name || !form.phone || !form.message) {
      show("❌ عبّي الحقول المطلوبة", "error");
      return;
    }
    setSending(true);
    try {
      const res = await fetch('/api/email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: 'info@clalmobile.com',
          subject: `رسالة تواصل من ${form.name}`,
          html: `
            <div dir="rtl" style="font-family:Tahoma,Arial,sans-serif">
              <h2>رسالة جديدة من نموذج التواصل</h2>
              <p><strong>الاسم:</strong> ${form.name}</p>
              <p><strong>الهاتف:</strong> ${form.phone}</p>
              <p><strong>الإيميل:</strong> ${form.email || "—"}</p>
              <p><strong>الموضوع:</strong> ${form.subject || "—"}</p>
              <p><strong>الرسالة:</strong></p>
              <p>${form.message}</p>
            </div>
          `
        })
      });
      if (!res.ok) throw new Error('فشل الإرسال');
      show("✅ تم إرسال رسالتك بنجاح! سنرد عليك قريباً.");
      setForm({ name: "", phone: "", email: "", subject: "", message: "" });
    } catch {
      show("❌ حدث خطأ. حاول مرة أخرى أو تواصل مباشرة على 054-9414448", "error");
    } finally {
      setSending(false);
    }
  };

  const contactCards = [
    { icon: "📞", title: "هاتف", value: "054-9414448", href: "tel:0549414448" },
    { icon: "💬", title: "واتساب", value: "054-9414448", href: "https://wa.me/972549414448" },
    { icon: "📧", title: "إيميل", value: "info@clalmobile.com", href: "mailto:info@clalmobile.com" },
  ];

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <Navbar />
      <div className="max-w-4xl mx-auto" style={{ paddingTop: scr.mobile ? 80 : 100, padding: scr.mobile ? "80px 16px 40px" : "100px 24px 64px" }}>
        <h1 className="font-black text-center mb-2" style={{ fontSize: scr.mobile ? 24 : 36 }}>تواصل معنا 💬</h1>
        <p className="text-center text-muted mb-6" style={{ fontSize: scr.mobile ? 12 : 14 }}>نسعد بخدمتك — اختر الطريقة المناسبة</p>

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

        {/* Hours + Form */}
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
          {/* Working hours */}
          <div className="card mb-3" style={{ padding: scr.mobile ? 16 : 24, flex: scr.desktop ? "0 0 240px" : undefined }}>
            <h3 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 16 }}>⏰ ساعات العمل</h3>
            {[
              { day: "الأحد", hours: "9:00 — 18:00", active: true },
              { day: "الاثنين", hours: "9:00 — 18:00", active: true },
              { day: "الثلاثاء", hours: "9:00 — 18:00", active: true },
              { day: "الأربعاء", hours: "9:00 — 18:00", active: true },
              { day: "الخميس", hours: "9:00 — 18:00", active: true },
              { day: "الجمعة", hours: "مغلق", active: false },
              { day: "السبت", hours: "مغلق", active: false },
            ].map((d) => (
              <div key={d.day} className="flex justify-between py-1 border-b border-surface-border last:border-0">
                <span className={`text-xs ${d.active ? "text-state-success" : "text-dim"}`}>{d.hours}</span>
                <span className="text-xs text-muted">{d.day}</span>
              </div>
            ))}
          </div>

          {/* Contact form */}
          <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 16 : 24 }}>
            <h3 className="font-bold text-right mb-3" style={{ fontSize: scr.mobile ? 14 : 16 }}>📝 أرسل رسالة</h3>

            <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">الاسم <span className="text-brand">*</span></label>
                <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <label className="block text-muted text-[10px] font-semibold mb-1">الهاتف <span className="text-brand">*</span></label>
                <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="05X-XXXXXXX" dir="ltr" />
              </div>
            </div>
            <div className="mt-2">
              <label className="block text-muted text-[10px] font-semibold mb-1">البريد الإلكتروني</label>
              <input className="input" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" />
            </div>
            <div className="mt-2">
              <label className="block text-muted text-[10px] font-semibold mb-1">الموضوع</label>
              <select className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                <option value="">اختر...</option>
                <option value="order">استفسار عن طلب</option>
                <option value="product">استفسار عن منتج</option>
                <option value="plan">استفسار عن باقة</option>
                <option value="support">دعم فني</option>
                <option value="complaint">شكوى</option>
                <option value="other">أخرى</option>
              </select>
            </div>
            <div className="mt-2">
              <label className="block text-muted text-[10px] font-semibold mb-1">الرسالة <span className="text-brand">*</span></label>
              <textarea className="input min-h-[80px] resize-y" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </div>

            <button onClick={handleSubmit} disabled={sending} className="btn-primary w-full mt-3" style={{ fontSize: scr.mobile ? 12 : 14 }}>
              {sending ? "⏳ جاري الإرسال..." : "📨 إرسال"}
            </button>
          </div>
        </div>
      </div>
      <Footer />

      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
