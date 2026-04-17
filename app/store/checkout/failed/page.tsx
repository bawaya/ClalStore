"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect } from "react";
import { useScreen } from "@/lib/hooks";
import { StoreHeader } from "@/components/store/StoreHeader";

function FailedContent() {
  const scr = useScreen();
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order") || "";
  const errorCode = params.get("error_code") || "";

  useEffect(() => {
    try {
      sessionStorage.removeItem("clal_pending_order");
    } catch {
      /* ignore */
    }
  }, []);

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <div className="mx-auto" style={{ maxWidth: scr.mobile ? "100%" : 600, padding: scr.mobile ? "30px 16px" : "50px 28px" }}>

        {/* Failed Banner */}
        <div className="rounded-2xl p-6 desktop:p-10 mb-6 text-center"
          style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.12), rgba(196,16,64,0.06))", border: "1px solid rgba(239,68,68,0.2)" }}>
          <div className="text-6xl mb-3">❌</div>
          <div className="font-black text-state-error mb-2" style={{ fontSize: scr.mobile ? 22 : 32 }}>
            فشلت عملية الدفع
          </div>
          {orderId && (
            <div className="text-muted mb-2" style={{ fontSize: scr.mobile ? 12 : 15 }}>
              طلب رقم: <span className="font-bold text-white">{orderId}</span>
            </div>
          )}
          <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 14 }}>
            لم يتم خصم أي مبلغ من حسابك — يمكنك المحاولة مجدداً
          </div>
        </div>

        {/* Possible Reasons */}
        <div className="card text-right mb-4" style={{ padding: scr.mobile ? 16 : 24 }}>
          <div className="font-bold mb-3" style={{ fontSize: scr.mobile ? 13 : 16 }}>🔍 أسباب محتملة</div>
          <div className="space-y-2">
            {[
              "رصيد غير كافٍ في البطاقة",
              "بيانات البطاقة غير صحيحة",
              "البطاقة محجوبة أو منتهية الصلاحية",
              "البنك رفض العملية — حاول مع بطاقة أخرى",
              "انتهت صلاحية صفحة الدفع",
            ].map((reason, i) => (
              <div key={i} className="flex items-center gap-2 text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                <span className="text-state-error">•</span>
                <span>{reason}</span>
              </div>
            ))}
          </div>
          {errorCode && (
            <div className="mt-3 text-dim" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              رمز الخطأ: {errorCode}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => router.push("/store/cart")}
            className="btn-primary w-full"
            style={{ fontSize: scr.mobile ? 14 : 16, padding: "14px 20px" }}
          >
            🔄 العودة للدفع والمحاولة مجدداً
          </button>
          <button onClick={() => router.push("/contact")} className="btn-outline w-full">
            📞 تواصل مع الدعم
          </button>
          <button
            onClick={() => {
              const msg = encodeURIComponent(`مرحباً، واجهت مشكلة في الدفع للطلب ${orderId}. أحتاج مساعدة.`);
              window.open(`https://wa.me/972502404412?text=${msg}`, "_blank");
            }}
            className="w-full py-3 rounded-xl border border-state-success/30 bg-state-success/5 text-state-success font-bold cursor-pointer text-sm"
          >
            💬 واتساب الدعم
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CheckoutFailedPage() {
  return (
    <Suspense fallback={
      <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-muted">جاري التحقق...</div>
        </div>
      </div>
    }>
      <FailedContent />
    </Suspense>
  );
}
