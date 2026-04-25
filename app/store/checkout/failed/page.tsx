"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Footer } from "@/components/website/sections";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useScreen } from "@/lib/hooks";

function FailedContent() {
  const scr = useScreen();
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order") || "";
  const errorCode = params.get("error_code") || "";

  useEffect(() => {
    try {
      sessionStorage.removeItem("clal_pending_order");
    } catch {}
  }, []);

  const reasons = [
    "الرصيد غير كافٍ في البطاقة",
    "بيانات البطاقة غير صحيحة",
    "البطاقة منتهية أو محجوبة",
    "البنك رفض العملية مؤقتًا",
    "انتهت صلاحية جلسة الدفع",
  ];

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
        <section className="mb-5 rounded-[30px] border border-[#6a2232] bg-[linear-gradient(135deg,#2a1016,#17171b)] px-5 py-8 text-center shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-10">
          <div className="text-6xl">✕</div>
          <h1 className="mt-4 text-2xl font-black text-white md:text-[2.5rem]">
            فشلت عملية الدفع
          </h1>
          {orderId && (
            <div className="mt-3 text-xl font-black text-[#ff8297] md:text-2xl">
              الطلب: {orderId}
            </div>
          )}
          <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-[#f0c6cf] md:text-base">
            لم يتم خصم أي مبلغ من حسابك، ويمكنك العودة إلى السلة والمحاولة مرة أخرى أو
            التواصل مع الدعم مباشرة.
          </p>
        </section>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6 md:py-6">
            <div className="text-sm font-black text-white">أسباب محتملة</div>
            <div className="mt-4 space-y-3">
              {reasons.map((reason) => (
                <div
                  key={reason}
                  className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4 text-sm leading-7 text-[#b8b8c2]"
                >
                  {reason}
                </div>
              ))}
            </div>

            {errorCode && (
              <div className="mt-4 rounded-[22px] border border-[#6a2232] bg-[#2a1016] px-4 py-4 text-sm font-semibold text-[#ff8297]">
                رمز الخطأ: {errorCode}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            <div className="rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <div className="text-sm font-black text-white">خطوات مقترحة</div>
              <div className="mt-4 grid gap-3">
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">1</div>
                  <div className="mt-2 text-sm font-bold text-white">راجع بيانات البطاقة</div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">2</div>
                  <div className="mt-2 text-sm font-bold text-white">حاول من جديد من السلة</div>
                </div>
                <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                  <div className="text-xs font-semibold text-[#8f8f99]">3</div>
                  <div className="mt-2 text-sm font-bold text-white">تواصل مع الدعم إذا تكرر الخطأ</div>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => router.push("/store/cart")}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f]"
              >
                العودة إلى السلة والمحاولة مجددًا
              </button>
              <button
                type="button"
                onClick={() => router.push("/store/contact")}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-5 text-sm font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
              >
                التواصل مع الدعم
              </button>
              <button
                type="button"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `مرحبًا، واجهت مشكلة في الدفع للطلب ${orderId}. أحتاج إلى مساعدة.`
                  );
                  window.open(`https://wa.me/972502404412?text=${msg}`, "_blank");
                }}
                className="inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#1f6d47] bg-[#0d2419] px-5 text-sm font-bold text-[#8ce2ae] transition-colors hover:brightness-110"
              >
                واتساب الدعم
              </button>
            </div>
          </aside>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense
      fallback={
        <div
          dir="rtl"
          className="font-arabic flex min-h-screen items-center justify-center bg-[#111114] text-white"
        >
          <div className="text-center">
            <div className="text-4xl">⏳</div>
            <div className="mt-3 text-sm text-[#b8b8c2]">جارٍ التحقق...</div>
          </div>
        </div>
      }
    >
      <FailedContent />
    </Suspense>
  );
}
