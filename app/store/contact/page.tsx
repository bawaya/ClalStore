"use client";

import Link from "next/link";
import { useState } from "react";
import { Footer } from "@/components/website/sections";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export default function StoreContactPage() {
  const scr = useScreen();
  const { t, lang } = useLang();
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
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          phone: form.phone,
          subject: "store-contact",
          message: form.message,
        }),
      });
      if (!response.ok) throw new Error("failed");
      setSubmitted(true);
      setForm({ name: "", phone: "", message: "" });
    } catch {
      show(t("storeContact.errorSend"), "error");
    } finally {
      setSending(false);
    }
  };

  const copy =
    lang === "he"
      ? {
          badge: "יצירת קשר",
          title: "דברו עם החנות מתוך מסך ברור אחד",
          subtitle:
            "כתבו לנו כאן ונחזור אליכם במהירות בנוגע למוצר, הזמנה, מלאי או כל שאלה לפני רכישה.",
          statOne: "מענה מסודר",
          statTwo: "שיחה מהירה",
        }
      : {
          badge: "تواصل مع المتجر",
          title: "راسلنا من واجهة واضحة ومباشرة",
          subtitle:
            "اكتب لنا هنا وسنعود إليك بسرعة بخصوص منتج، طلب، توفر، أو أي استفسار قبل الشراء.",
          statOne: "رد منظم",
          statTwo: "متابعة سريعة",
        };

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
      }}
    >
      <StoreHeader showBack />

      <div
        className="mx-auto max-w-5xl"
        style={{ padding: scr.mobile ? "16px 14px 80px" : "24px 24px 110px" }}
      >
        <section className="mb-5 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {copy.badge}
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight md:text-[2.4rem]">
                {copy.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                {copy.subtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">24/7</strong>
                <span className="text-sm text-[#b8b8c2]">{copy.statOne}</span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">HOT</strong>
                <span className="text-sm text-[#b8b8c2]">{copy.statTwo}</span>
              </div>
            </div>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[30px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-6 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6">
            {submitted ? (
              <div className="py-8 text-center">
                <div className="text-6xl">✓</div>
                <h2 className="mt-4 text-2xl font-black text-white">
                  {t("storeContact.thankTitle")}
                </h2>
                <p className="mt-3 text-sm leading-8 text-[#b8b8c2] md:text-base">
                  {t("storeContact.thankMsg")}
                </p>

                <div className="mt-6 flex flex-col items-center gap-3">
                  <Link
                    href="/store"
                    className="inline-flex min-h-[52px] w-full max-w-[320px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-6 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f]"
                  >
                    {t("storeContact.backToStore")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => setSubmitted(false)}
                    className="inline-flex min-h-[52px] w-full max-w-[320px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-6 text-sm font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
                  >
                    {t("storeContact.sendAnother")}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mb-6 text-center">
                  <div className="text-5xl">✉</div>
                  <h2 className="mt-3 text-xl font-black text-white md:text-2xl">
                    {t("storeContact.title")}
                  </h2>
                  <p className="mt-2 text-sm leading-7 text-[#b8b8c2]">
                    {t("storeContact.subtitle")}
                  </p>
                </div>

                <div className="space-y-4">
                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-[#9d9daa] desktop:text-xs">
                      {t("storeContact.name")}
                    </span>
                    <input
                      className="w-full rounded-2xl border border-[#4a4a54] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-[#8f8f99]"
                      value={form.name}
                      onChange={(event) =>
                        setForm({ ...form, name: event.target.value })
                      }
                      placeholder={t("storeContact.namePH")}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-[#9d9daa] desktop:text-xs">
                      {t("storeContact.phone")}
                    </span>
                    <input
                      className="w-full rounded-2xl border border-[#4a4a54] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-[#8f8f99]"
                      value={form.phone}
                      onChange={(event) =>
                        setForm({ ...form, phone: event.target.value })
                      }
                      placeholder="05X-XXXXXXX"
                      dir="ltr"
                    />
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-[11px] font-semibold text-[#9d9daa] desktop:text-xs">
                      {t("storeContact.message")}
                    </span>
                    <textarea
                      className="min-h-[140px] w-full resize-y rounded-2xl border border-[#4a4a54] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-[#8f8f99]"
                      value={form.message}
                      onChange={(event) =>
                        setForm({ ...form, message: event.target.value })
                      }
                      placeholder={t("storeContact.messagePH")}
                    />
                  </label>

                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={sending}
                    className="inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-6 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f] disabled:opacity-60"
                  >
                    {sending ? t("storeContact.sending") : t("storeContact.send")}
                  </button>
                </div>

                <p className="mt-5 text-center text-xs leading-7 text-[#8f8f99]">
                  {t("storeContact.note")}
                </p>
              </>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[26px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <div className="text-sm font-black text-white">
                {lang === "he" ? "ערוצי תקשורת" : "قنوات التواصل"}
              </div>
              <div className="mt-4 space-y-3">
                <a
                  href="tel:04-1234567"
                  className="block rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4 text-right transition-colors hover:border-[#ff3351]/35"
                >
                  <div className="text-sm font-bold text-white">
                    {lang === "he" ? "טלפון" : "هاتف"}
                  </div>
                  <div className="mt-1 text-sm text-[#b8b8c2]" dir="ltr">
                    04-1234567
                  </div>
                </a>
                <a
                  href="https://wa.me/972502404412"
                  target="_blank"
                  rel="noreferrer"
                  className="block rounded-[22px] border border-[#1f6d47] bg-[#0d2419] px-4 py-4 text-right transition-colors hover:brightness-110"
                >
                  <div className="text-sm font-bold text-[#8ce2ae]">
                    WhatsApp
                  </div>
                  <div className="mt-1 text-sm text-[#b8b8c2]" dir="ltr">
                    +972 50-240-4412
                  </div>
                </a>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <div className="text-sm font-black text-white">
                {lang === "he" ? "לפני שאתם שולחים" : "قبل الإرسال"}
              </div>
              <ul className="mt-4 space-y-2 text-sm leading-7 text-[#b8b8c2]">
                <li>{lang === "he" ? "כתבו מספר הזמנה אם קיים." : "اكتب رقم الطلب إن وجد."}</li>
                <li>{lang === "he" ? "ציינו דגם או מותג אם שאלתכם על מוצר." : "اذكر الموديل أو العلامة إذا كان السؤال عن منتج."}</li>
                <li>{lang === "he" ? "השאירו מספר טלפון זמין למענה." : "اترك رقم هاتف متاحًا للمتابعة."}</li>
              </ul>
            </div>
          </aside>
        </div>
      </div>

      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fixed bottom-5 left-1/2 z-[999] -translate-x-1/2 rounded-2xl border px-6 py-3 text-sm font-bold shadow-[0_20px_40px_rgba(0,0,0,0.35)] ${
            toast.type === "error"
              ? "border-[#6a2232] bg-[#2a1016] text-[#ff8297]"
              : "border-[#1f6d47] bg-[#0e241a] text-[#8ce2ae]"
          }`}
        >
          {toast.message}
        </div>
      ))}

      <Footer />
    </div>
  );
}
