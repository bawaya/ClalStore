"use client";

import { useMemo, useState } from "react";
import { Footer } from "@/components/website/sections";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useLang } from "@/lib/i18n";

const STATUS_LABELS: Record<string, { ar: string; he: string }> = {
  new: { ar: "جديد", he: "חדש" },
  approved: { ar: "موافق عليه", he: "אושר" },
  processing: { ar: "قيد التجهيز", he: "בהכנה" },
  shipped: { ar: "تم الشحن", he: "נשלח" },
  delivered: { ar: "تم التسليم", he: "נמסר" },
  cancelled: { ar: "ملغي", he: "בוטל" },
  rejected: { ar: "مرفوض", he: "נדחה" },
};

const STATUS_ORDER = ["new", "approved", "processing", "shipped", "delivered"];

export default function TrackPage() {
  const { lang } = useLang();
  const [orderId, setOrderId] = useState("");
  const [loading, setLoading] = useState(false);
  const [order, setOrder] = useState<{
    id: string;
    status: string;
    total: number;
    created_at: string;
    payment_status?: string;
  } | null>(null);
  const [error, setError] = useState("");

  const handleTrack = async () => {
    const id = orderId.trim().toUpperCase();
    if (!id) {
      setError(lang === "he" ? "הזן מספר הזמנה" : "أدخل رقم الطلب");
      return;
    }

    setError("");
    setOrder(null);
    setLoading(true);
    try {
      const response = await fetch(
        `/api/store/order-status?orderId=${encodeURIComponent(id)}`
      );
      const json = await response.json();
      const data = json.data ?? json;

      if (json.success && data.order) {
        setOrder(data.order);
      } else {
        setError(
          json.error ||
            data.error ||
            (lang === "he" ? "ההזמנה לא נמצאה" : "لم يتم العثور على الطلب")
        );
      }
    } catch {
      setError(lang === "he" ? "שגיאת חיבור" : "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = order
    ? (STATUS_LABELS[order.status] || {
        ar: order.status,
        he: order.status,
      })[lang as "ar" | "he"]
    : "";

  const currentStageIndex = useMemo(() => {
    if (!order) return -1;
    return STATUS_ORDER.indexOf(order.status);
  }, [order]);

  const intro =
    lang === "he"
      ? {
          badge: "מעקב הזמנות",
          title: "בדיקת מצב ההזמנה ממסך ברור אחד",
          subtitle:
            "הקלידו את מספר ההזמנה וקבלו במהירות את הסטטוס, הסכום ותמונת ההתקדמות הנוכחית.",
          placeholder: "CLM-12345",
          cta: "חפש",
          orderId: "מספר הזמנה",
          amount: "סכום",
          date: "תאריך",
          status: "מצב",
          payment: "תשלום",
          helper: "לא מצאתם את ההזמנה? צרו קשר עם החנות.",
        }
      : {
          badge: "تتبع الطلبات",
          title: "افحص حالة طلبك من شاشة واحدة واضحة",
          subtitle:
            "أدخل رقم الطلب لتعرف مباشرة الحالة الحالية، قيمة الطلب، ومرحلة المعالجة دون الحاجة إلى التواصل أولًا.",
          placeholder: "CLM-12345",
          cta: "تتبع",
          orderId: "رقم الطلب",
          amount: "المبلغ",
          date: "التاريخ",
          status: "الحالة",
          payment: "الدفع",
          helper: "إذا لم تجد الطلب تواصل مع المتجر مباشرة.",
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
      <StoreHeader />

      <main className="mx-auto max-w-4xl px-4 pb-24 pt-6">
        <section className="mb-5 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px] md:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {intro.badge}
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight md:text-[2.4rem]">
                {intro.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                {intro.subtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">24/7</strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "גישה למעקב" : "وصول مستمر"}
                </span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">CLM</strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "פורמט הזמנה" : "صيغة الطلب"}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="mb-4 rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6 md:py-6">
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
            <input
              type="text"
              value={orderId}
              onChange={(event) => setOrderId(event.target.value.toUpperCase())}
              placeholder={intro.placeholder}
              className="w-full rounded-2xl border border-[#4a4a54] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none placeholder:text-[#8f8f99]"
              dir="ltr"
              onKeyDown={(event) => event.key === "Enter" && void handleTrack()}
            />
            <button
              type="button"
              onClick={() => void handleTrack()}
              disabled={loading}
              className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-6 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f] disabled:opacity-60"
            >
              {loading ? "..." : intro.cta}
            </button>
          </div>
        </section>

        {error && (
          <div className="mb-4 rounded-[24px] border border-[#6a2232] bg-[#2a1016] px-5 py-4 text-center text-sm font-semibold text-[#ff8297]">
            {error}
          </div>
        )}

        {order && (
          <section className="space-y-4">
            <div className="rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6 md:py-6">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">{intro.orderId}</div>
                  <div className="mt-2 text-lg font-black text-[#ff3351]">{order.id}</div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">{intro.status}</div>
                  <div className="mt-2 text-lg font-black text-white">{statusLabel}</div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">{intro.amount}</div>
                  <div className="mt-2 text-lg font-black text-white">
                    ₪{Number(order.total).toLocaleString()}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">{intro.date}</div>
                  <div className="mt-2 text-lg font-black text-white">
                    {new Date(order.created_at).toLocaleDateString(
                      lang === "he" ? "he-IL" : "ar-EG"
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6 md:py-6">
              <div className="mb-4 text-sm font-bold text-white">
                {lang === "he" ? "התקדמות ההזמנה" : "تقدم الطلب"}
              </div>

              <div className="grid gap-3 md:grid-cols-5">
                {STATUS_ORDER.map((status, index) => {
                  const label = STATUS_LABELS[status][lang as "ar" | "he"];
                  const isActive = currentStageIndex >= index;
                  const isCurrent = order.status === status;

                  return (
                    <div
                      key={status}
                      className={`rounded-[22px] border px-4 py-4 text-right ${
                        isCurrent
                          ? "border-[#ff3351]/45 bg-[#ff3351]/10"
                          : isActive
                            ? "border-[#1f6d47] bg-[#0d2419]"
                            : "border-[#2f2f38] bg-white/[0.02]"
                      }`}
                    >
                      <div
                        className={`text-xs font-semibold ${
                          isCurrent
                            ? "text-[#ff8da0]"
                            : isActive
                              ? "text-[#8ce2ae]"
                              : "text-[#8f8f99]"
                        }`}
                      >
                        {`0${index + 1}`.slice(-2)}
                      </div>
                      <div className="mt-2 text-sm font-black text-white">{label}</div>
                    </div>
                  );
                })}
              </div>

              {order.payment_status && (
                <div className="mt-4 rounded-[22px] border border-[#2c2c35] bg-white/[0.03] px-4 py-4 text-right">
                  <div className="text-xs font-semibold text-[#8f8f99]">
                    {intro.payment}
                  </div>
                  <div className="mt-2 text-sm font-black text-white">
                    {order.payment_status}
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        <p className="mt-6 text-center text-xs leading-7 text-[#8f8f99]">
          {intro.helper}{" "}
          <a href="/store/contact" className="text-[#ff6b82] hover:underline">
            /store/contact
          </a>
        </p>
      </main>

      <Footer />
    </div>
  );
}
