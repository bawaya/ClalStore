"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { useScreen } from "@/lib/hooks";
import { StoreHeader } from "@/components/store/StoreHeader";

function SuccessContent() {
  const scr = useScreen();
  const router = useRouter();
  const params = useSearchParams();
  const orderId = params.get("order") || "";
  const documentId = params.get("document_id") || "";
  const [countdown, setCountdown] = useState(15);

  // Auto-redirect to store after 15s
  useEffect(() => {
    if (countdown <= 0) {
      router.push("/store");
      return;
    }
    const t = setTimeout(() => setCountdown(countdown - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, router]);

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <div className="mx-auto" style={{ maxWidth: scr.mobile ? "100%" : 600, padding: scr.mobile ? "30px 16px" : "50px 28px" }}>

        {/* Success Banner */}
        <div className="rounded-2xl p-6 desktop:p-10 mb-6 text-center"
          style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.12), rgba(6,182,212,0.06))", border: "1px solid rgba(34,197,94,0.2)" }}>
          <div className="text-6xl mb-3">✅</div>
          <div className="font-black text-state-success mb-2" style={{ fontSize: scr.mobile ? 22 : 32 }}>
            تم الدفع بنجاح!
          </div>
          {orderId && (
            <div className="font-black text-brand mb-2" style={{ fontSize: scr.mobile ? 28 : 42 }}>
              {orderId}
            </div>
          )}
          <div className="text-muted" style={{ fontSize: scr.mobile ? 12 : 15 }}>
            شكراً لك — تم استلام طلبك وسيتم تجهيزه للشحن
          </div>
        </div>

        {/* Details */}
        <div className="card text-right mb-4" style={{ padding: scr.mobile ? 16 : 24 }}>
          <div className="font-bold mb-3" style={{ fontSize: scr.mobile ? 13 : 16 }}>📋 ماذا بعد؟</div>
          <div className="space-y-3">
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">📦</span>
              <div>
                <div className="font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>تجهيز الطلب</div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>سيتم تجهيز طلبك خلال يوم عمل</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">🚚</span>
              <div>
                <div className="font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>الشحن والتوصيل</div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>التوصيل خلال 1-2 يوم عمل (الأحد - الخميس)</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg flex-shrink-0">📱</span>
              <div>
                <div className="font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>إشعار واتساب</div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>ستصلك رسالة تأكيد على الواتساب</div>
              </div>
            </div>
            {documentId && (
              <div className="flex items-start gap-2">
                <span className="text-lg flex-shrink-0">🧾</span>
                <div>
                  <div className="font-semibold" style={{ fontSize: scr.mobile ? 11 : 13 }}>חשבונית מס</div>
                  <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>تم إصدار فاتورة ضريبية رقم {documentId}</div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <button onClick={() => router.push("/store")} className="btn-primary flex-1">
            🛒 متابعة التسوّق
          </button>
          <button onClick={() => router.push("/contact")} className="btn-outline flex-1">
            📞 تواصل معنا
          </button>
        </div>

        <div className="text-center text-dim mt-4" style={{ fontSize: scr.mobile ? 9 : 11 }}>
          سيتم تحويلك للمتجر خلال {countdown} ثانية...
        </div>
      </div>
    </div>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense fallback={
      <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">⏳</div>
          <div className="text-muted">جاري التحقق من الدفع...</div>
        </div>
      </div>
    }>
      <SuccessContent />
    </Suspense>
  );
}
