"use client";

import { useState } from "react";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";

const STATUS_LABELS: Record<string, { ar: string; he: string }> = {
  new: { ar: "جديد", he: "חדש" },
  approved: { ar: "موافق عليه", he: "אושר" },
  processing: { ar: "قيد التجهيز", he: "בהכנה" },
  shipped: { ar: "تم الشحن", he: "נשלח" },
  delivered: { ar: "تم التسليم", he: "נמסר" },
  cancelled: { ar: "ملغي", he: "בוטל" },
  rejected: { ar: "مرفوض", he: "נדחה" },
};

export default function TrackPage() {
  const { t, lang } = useLang();
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
      const res = await fetch(`/api/store/order-status?orderId=${encodeURIComponent(id)}`);
      const data = await res.json();
      if (data.success && data.order) {
        setOrder(data.order);
      } else {
        setError(data.error || (lang === "he" ? "ההזמנה לא נמצאה" : "لم يتم العثور على الطلب"));
      }
    } catch {
      setError(lang === "he" ? "שגיאה בחיבור" : "خطأ في الاتصال");
    } finally {
      setLoading(false);
    }
  };

  const statusLabel = order ? (STATUS_LABELS[order.status] || { ar: order.status, he: order.status })[lang as "ar" | "he"] : "";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <main className="max-w-lg mx-auto px-4 py-12">
        <h1 className="text-2xl font-black text-center mb-2">
          {lang === "he" ? "מעקב הזמנה" : "تتبع الطلب"}
        </h1>
        <p className="text-muted text-sm text-center mb-6">
          {lang === "he" ? "הזן את מספר ההזמנה (למשל CLM-12345)" : "أدخل رقم الطلب (مثال: CLM-12345)"}
        </p>

        <div className="flex gap-2 mb-6">
          <input
            type="text"
            value={orderId}
            onChange={(e) => setOrderId(e.target.value.toUpperCase())}
            placeholder="CLM-12345"
            className="input flex-1"
            dir="ltr"
            onKeyDown={(e) => e.key === "Enter" && handleTrack()}
          />
          <button onClick={handleTrack} disabled={loading} className="btn-primary px-6 disabled:opacity-50">
            {loading ? "..." : lang === "he" ? "חפש" : "تتبع"}
          </button>
        </div>

        {error && (
          <div className="bg-state-error/10 border border-state-error/30 rounded-xl p-4 text-center text-state-error text-sm mb-6">
            {error}
          </div>
        )}

        {order && (
          <div className="card p-6 space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">{lang === "he" ? "מספר הזמנה" : "رقم الطلب"}</span>
              <span className="font-black text-brand">{order.id}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">{lang === "he" ? "סטטוס" : "الحالة"}</span>
              <span className="font-bold">{statusLabel}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">{lang === "he" ? "סה״כ" : "المبلغ"}</span>
              <span className="font-black">₪{Number(order.total).toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted text-sm">{lang === "he" ? "תאריך" : "التاريخ"}</span>
              <span className="text-sm">{new Date(order.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "ar-EG")}</span>
            </div>
          </div>
        )}

        <p className="text-muted text-xs text-center mt-6">
          {lang === "he" ? "לא מצאת את ההזמנה? צור קשר" : "لم تجد الطلب؟ تواصل معنا"}
          {" — "}
          <a href="/store/contact" className="text-brand hover:underline">/store/contact</a>
        </p>
      </main>
      <Footer />
    </div>
  );
}
