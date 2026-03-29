"use client";

import { useRouter } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

interface OrderResult {
  id: string;
  total: number;
  items: { name: string; name_he?: string; price: number }[];
  city: string;
  address: string;
  customer: string;
  phone: string;
  notes: string;
  hasDevice: boolean;
  date: string;
  installments: number;
  monthlyAmount: number;
  bankName: string;
}

export function ConfirmStep({ order }: { order: OrderResult | null }) {
  const scr = useScreen();
  const { lang } = useLang();
  const router = useRouter();

  return (
    <div className="text-center">
      <div className="glass-brand-glow p-6 desktop:p-10 mb-4">
        <div className="text-5xl mb-2">✅</div>
        <div className="font-black text-state-success mb-1" style={{ fontSize: scr.mobile ? 20 : 28 }}>
          تم إرسال الطلب!
        </div>
        <div className="font-black text-brand mb-2" style={{ fontSize: scr.mobile ? 28 : 40 }}>
          {order?.id}
        </div>
        <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 14 }}>
          {order?.hasDevice
            ? "📋 طلبك قيد المراجعة — الفريق سيتواصل معك خلال يوم عمل"
            : "✅ تم تأكيد الطلب — قيد التجهيز للشحن"}
        </div>
      </div>

      <div className="glass-card-static text-right mb-3" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="font-bold mb-2" style={{ fontSize: scr.mobile ? 12 : 14 }}>
          📦 تفاصيل الطلب
        </div>
        {order?.items.map((it, idx) => (
          <div key={`item-${idx}`} className="flex justify-between py-1.5 border-b border-glass-border">
            <span className="text-brand" style={{ fontSize: scr.mobile ? 11 : 13 }}>
              ₪{it.price}
            </span>
            <span style={{ fontSize: scr.mobile ? 11 : 13 }}>
              {lang === "he" ? (it.name_he || it.name) : it.name}
            </span>
          </div>
        ))}
        <div className="flex justify-between pt-2 mt-1">
          <span className="font-black text-state-success" style={{ fontSize: scr.mobile ? 16 : 20 }}>
            ₪{order?.total.toLocaleString()}
          </span>
          <span className="font-bold">المجموع</span>
        </div>
        {order?.hasDevice && (
          <div className="border-t border-glass-border pt-2 mt-2">
            <div className="flex justify-between text-muted text-xs">
              <span>{order.bankName}</span>
              <span>🏦 طريقة الدفع: حوالة بنكية</span>
            </div>
            {order.installments > 1 && (
              <div className="flex justify-between mt-1">
                <span
                  className="text-state-success font-bold"
                  style={{ fontSize: scr.mobile ? 13 : 15 }}
                >
                  ₪{order.monthlyAmount.toLocaleString()} × {order.installments} شهر
                </span>
                <span className="text-muted text-xs">📅 تقسيط</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="glass-card-static text-right mb-3" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="font-bold mb-1.5" style={{ fontSize: scr.mobile ? 12 : 14 }}>
          📍 التوصيل
        </div>
        <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>
          {order?.customer} • {order?.phone}
        </div>
        <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>
          {order?.city} — {order?.address}
        </div>
        <div className="text-dim mt-1" style={{ fontSize: scr.mobile ? 10 : 12 }}>
          🚚 التوصيل: الأحد - الخميس (1-2 يوم عمل)
        </div>
      </div>

      {order?.notes && (
        <div
          className="glass-card-static text-right mb-3 p-2.5 text-muted"
          style={{ fontSize: scr.mobile ? 10 : 12 }}
        >
          📝 ملاحظاتك: {order.notes}
        </div>
      )}

      <button onClick={() => router.push("/store")} className="btn-primary w-full">
        🛒 متابعة التسوّق
      </button>
    </div>
  );
}
