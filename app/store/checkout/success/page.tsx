"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer } from "@/components/website/sections";
import { StoreHeader } from "@/components/store/StoreHeader";
import { trackPurchase } from "@/components/shared/Analytics";
import { useScreen } from "@/lib/hooks";
import { useCart } from "@/lib/store/cart";

function SuccessContent() {
  const scr = useScreen();
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order") || "";
  const customerCode = params.get("customer_code") || "";
  const valueParam = params.get("value");
  const value = valueParam ? parseFloat(valueParam) : 0;
  const documentId = params.get("document_id") || "";
  const [countdown, setCountdown] = useState(15);
  const clearCart = useCart((state) => state.clearCart);
  const tracked = useRef(false);

  useEffect(() => {
    try {
      sessionStorage.removeItem("clal_pending_order");
    } catch {}
    if (orderId) clearCart();
  }, [clearCart, orderId]);

  useEffect(() => {
    if (orderId && value > 0 && !tracked.current) {
      tracked.current = true;
      trackPurchase(value, "ILS", orderId);
    }
  }, [orderId, value]);

  useEffect(() => {
    if (countdown <= 0) {
      router.push("/store");
      return;
    }
    const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown, router]);

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
        <section className="mb-5 rounded-[30px] border border-[#1f6d47] bg-[linear-gradient(135deg,#0d2419,#101c24)] px-5 py-8 text-center shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-10">
          <div className="text-6xl">✓</div>
          <h1 className="mt-4 text-2xl font-black text-white md:text-[2.5rem]">
            تم الدفع بنجاح
          </h1>
          {orderId && (
            <div className="mt-3 text-3xl font-black text-[#ff3351] md:text-[3rem]">
              {orderId}
            </div>
          )}
          {customerCode && (
            <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-4 py-2 text-sm font-bold text-[#ff8da0]">
              <span>{customerCode}</span>
            </div>
          )}
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[#c5d7cc] md:text-base">
            تم استلام الطلب بنجاح، وبدأت الآن مرحلة التجهيز والمتابعة للشحن.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6 md:py-6">
            <div className="text-sm font-black text-white">
              ماذا يحدث بعد الدفع؟
            </div>

            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <div className="text-2xl">📦</div>
                <div className="mt-3 text-sm font-bold text-white">تجهيز الطلب</div>
                <div className="mt-2 text-sm leading-7 text-[#b8b8c2]">
                  يتم تجهيز الطلب خلال يوم عمل واحد في أغلب الحالات.
                </div>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <div className="text-2xl">🚚</div>
                <div className="mt-3 text-sm font-bold text-white">الشحن والتسليم</div>
                <div className="mt-2 text-sm leading-7 text-[#b8b8c2]">
                  التوصيل خلال 1-2 يوم عمل عادة بين الأحد والخميس.
                </div>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <div className="text-2xl">📱</div>
                <div className="mt-3 text-sm font-bold text-white">إشعارات المتابعة</div>
                <div className="mt-2 text-sm leading-7 text-[#b8b8c2]">
                  ستصلك تحديثات المتابعة على الهاتف أو واتساب عند الحاجة.
                </div>
              </div>
            </div>

            {documentId && (
              <div className="mt-4 rounded-[22px] border border-[#2f2f38] bg-white/[0.03] px-4 py-4 text-right">
                <div className="text-sm font-bold text-white">الفاتورة الضريبية</div>
                <div className="mt-2 text-sm text-[#b8b8c2]">
                  تم إصدار فاتورة ضريبية برقم {documentId}.
                </div>
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <div className="text-sm font-black text-white">ملخص سريع</div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">رقم الطلب</div>
                  <div className="mt-2 text-lg font-black text-[#ff3351]">
                    {orderId || "—"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">قيمة العملية</div>
                  <div className="mt-2 text-lg font-black text-white">
                    {value > 0 ? `₪${value.toLocaleString()}` : "—"}
                  </div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">العودة التلقائية</div>
                  <div className="mt-2 text-lg font-black text-white">{countdown} ثانية</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push("/store")}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f]"
              >
                متابعة التسوق
              </button>
              <button
                type="button"
                onClick={() => router.push("/store/contact")}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-5 text-sm font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
              >
                تواصل معنا
              </button>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="font-arabic flex min-h-screen items-center justify-center bg-[#111114] text-white"
        >
          <div className="text-center">
            <div className="text-4xl">⏳</div>
            <div className="mt-3 text-sm text-[#b8b8c2]">جارٍ التحقق من الدفع...</div>
          </div>
        </div>
      }
    >
      <SuccessContent />
    </Suspense>
  );
}
