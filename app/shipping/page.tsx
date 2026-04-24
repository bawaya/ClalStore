"use client";

import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

export default function ShippingPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const isHe = lang === "he";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <div className="max-w-3xl mx-auto" style={{ padding: scr.mobile ? "16px 14px 80px" : "32px 28px 100px" }}>
        <div className="text-center mb-6">
          <h1 className="font-black text-white mb-2" style={{ fontSize: scr.mobile ? 24 : 32 }}>
            🚚 {isHe ? "מדיניות משלוחים" : "سياسة الشحن والتوصيل"}
          </h1>
        </div>

        <Card title={isHe ? "אזורי משלוח" : "مناطق التوصيل"}>
          <P>
            {isHe
              ? "אנו משלחים לכל הארץ — ערים, מושבים, קיבוצים ויישובים — ללא תוספת עלות."
              : "نحن نُشحن إلى كل إسرائيל — المدن، الموشاف، الكيبوتس والقرى — بدون تكلفة إضافية."}
          </P>
        </Card>

        <Card title={isHe ? "זמני אספקה" : "أوقات التوصيل"}>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc">
            <li className="mb-1">
              {isHe
                ? "הזמנות עד 14:00 — משלוח באותו יום או למחרת."
                : "الطلبات قبل الساعة 14:00 — توصيل في نفس اليوم أو الذي يليه."}
            </li>
            <li className="mb-1">
              {isHe
                ? "הזמנות לאחר 14:00 — משלוח בתוך 1-2 ימי עסקים."
                : "الطلبات بعد 14:00 — توصيل خلال 1-2 يوم عمل."}
            </li>
            <li className="mb-1">
              {isHe
                ? "ימי פעילות: ראשון-חמישי."
                : "أيام العمل: الأحد – الخميس."}
            </li>
            <li className="mb-1">
              {isHe
                ? "אין משלוחים בימי שישי, שבת וחגים."
                : "لا يوجد توصيل يوم الجمعة والسبت والأعياد."}
            </li>
          </ul>
        </Card>

        <Card title={isHe ? "עלות משלוח" : "تكلفة الشحن"}>
          <P>
            {isHe
              ? "משלוח חינם על כל ההזמנות — לכל הארץ, ללא מינימום."
              : "الشحن مجاناً على جميع الطلبات — لكل إسرائيל، بدون حد أدنى."}
          </P>
        </Card>

        <Card title={isHe ? "מעקב אחר ההזמנה" : "تتبّع الطلب"}>
          <P>
            {isHe
              ? "לאחר שליחת ההזמנה תקבל SMS/וואטסאפ עם פרטי השליח וזמן משוער. ניתן לעקוב גם מאזור \"ההזמנות שלי\" בחשבונך."
              : "بعد إرسال الطلب ستتلقى رسالة SMS/واتساب فيها تفاصيل مندوب الشحن والوقت التقريبي. يمكنك أيضاً المتابعة من قسم \"طلباتي\" في حسابك."}
          </P>
        </Card>

        <Card title={isHe ? "מוצר פגום / נזק בהובלה" : "منتج تالف / ضرر أثناء الشحن"}>
          <P>
            {isHe
              ? "אם המוצר הגיע פגום או לא תקין — אנא פנה אלינו תוך 48 שעות עם תמונות. אנו מחליפים או מחזירים את הכסף ללא עלות משלוח חזרה."
              : "إذا وصل المنتج تالفاً أو غير سليم — تواصل معنا خلال 48 ساعة مع صور. نُبدِّل المنتج أو نُعيد المبلغ بدون أي تكلفة شحن."}
          </P>
        </Card>
      </div>
      <Footer />
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-3" style={{ padding: 14 }}>
      <h3 className="font-bold text-white mb-2 text-base">{title}</h3>
      {children}
    </div>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-muted text-sm leading-relaxed mb-2">{children}</p>;
}
