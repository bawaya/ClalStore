"use client";

// =====================================================
// Returns & Cancellation Policy (ביטול עסקה והחזרת מוצר)
// Under: חוק הגנת הצרכן, התשמ"א-1981, §14ג-14ה
// + תקנות הגנת הצרכן (ביטול עסקה), התשע"א-2010
// =====================================================

import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import Link from "next/link";

export default function ReturnsPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const isHe = lang === "he";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <div className="max-w-3xl mx-auto" style={{ padding: scr.mobile ? "16px 14px 80px" : "32px 28px 100px" }}>
        <div className="text-center mb-6">
          <h1 className="font-black text-white mb-2" style={{ fontSize: scr.mobile ? 24 : 32 }}>
            ↩️ {isHe ? "ביטול עסקה והחזרת מוצר" : "سياسة الإلغاء والإرجاع"}
          </h1>
          <p className="text-muted text-xs">
            {isHe
              ? "בהתאם לחוק הגנת הצרכן, התשמ״א-1981 ותקנות ביטול עסקה, התשע״א-2010"
              : "وفقاً لقانون حماية المستهلك الإسرائيلي 1981 ولوائح إلغاء العقود 2010"}
          </p>
        </div>

        <Card title={isHe ? "חלון הביטול — 14 יום" : "فترة الإلغاء — 14 يوماً"}>
          <P>
            {isHe
              ? "בעסקת מכר מרחוק (אינטרנט/טלפון) ניתן לבטל תוך 14 ימים מקבלת המוצר, או ממועד המסמך המפורט אם הומצא לאחר הקבלה — לפי המאוחר."
              : "في عقد البيع عن بُعد (إنترنت/هاتف)، يمكن الإلغاء خلال 14 يوماً من استلام المنتج أو من تاريخ المستند المفصّل إذا أُرسل بعد الاستلام — أيّهما أحدث."}
          </P>
        </Card>

        <Card title={isHe ? "חלון מורחב — 4 חודשים" : "فترة ممتدة — 4 شهور"}>
          <P>
            {isHe
              ? "למי שמעל גיל 65, אנשים עם מוגבלות, ועולים חדשים (עד 5 שנים מקבלת תעודת עולה) — חלון הביטול הוא 4 חודשים, בתנאי שהעסקה כללה שיחה טלפונית או תכתובת עם המוכר."
              : "لمن فوق 65 سنة، ذوي الإعاقة، والمهاجرين الجدد (حتى 5 سنوات من تاريخ شهادة العولة) — فترة الإلغاء 4 شهور، بشرط أن تكون العملية تضمّنت محادثة هاتفية أو مراسلات مع البائع."}
          </P>
        </Card>

        <Card title={isHe ? "דמי ביטול" : "رسوم الإلغاء"}>
          <P>
            {isHe
              ? "בעת ביטול שאינו בעקבות פגם, אנו רשאים לגבות דמי ביטול בסך 5% ממחיר המוצר או ₪100 — הנמוך מביניהם."
              : "عند الإلغاء لغير عيب، يحق لنا تحصيل رسوم إلغاء بمقدار 5% من ثمن المنتج أو 100₪ — أيّهما أقل."}
          </P>
          <P>
            {isHe
              ? "ביטול בעקבות פגם או אי-התאמה — ללא דמי ביטול וללא עלות משלוח חזרה."
              : "الإلغاء بسبب عيب أو عدم مطابقة — بدون أي رسوم وبدون تكاليف الشحن العكسي."}
          </P>
        </Card>

        <Card title={isHe ? "מוצרים שאינם ניתנים לביטול" : "منتجات غير قابلة للإلغاء"}>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc">
            {(isHe ? EXCEPT_HE : EXCEPT_AR).map((li, i) => (
              <li key={i} className="mb-1">{li}</li>
            ))}
          </ul>
        </Card>

        <Card title={isHe ? "איך מבטלים?" : "كيفية الإلغاء"}>
          <ol className="text-muted text-sm leading-relaxed mr-4 list-decimal">
            {(isHe ? STEPS_HE : STEPS_AR).map((li, i) => (
              <li key={i} className="mb-1">{li}</li>
            ))}
          </ol>
          <div className="mt-3 flex gap-2 flex-wrap">
            <Link href="/store/account" className="chip text-xs border border-brand/30 text-brand">
              {isHe ? "ניהול הזמנות" : "إدارة طلباتي"}
            </Link>
            <Link href="/contact" className="chip text-xs border border-surface-border">
              {isHe ? "צור קשר" : "تواصل معنا"}
            </Link>
          </div>
        </Card>

        <Card title={isHe ? "החזר כספי" : "إرجاع المبلغ"}>
          <P>
            {isHe
              ? "נחזיר את הכסף באותו אמצעי ששילמת בו תוך 14 ימי עסקים מקבלת המוצר חזרה במצב תקין."
              : "نعيد المبلغ بنفس وسيلة الدفع التي استُخدمت، خلال 14 يوم عمل من استلام المنتج سليماً."}
          </P>
        </Card>

        <Card title={isHe ? "מוצר פגום / אחריות" : "منتج معيب / ضمان"}>
          <P>
            {isHe
              ? "כל מכשיר כולל אחריות יצרן/יבואן. פרטים מלאים ב-"
              : "كل جهاز مشمول بضمان الشركة المصنّعة/المستورد. للتفاصيل الكاملة راجع "}
            <Link href="/warranty" className="text-brand underline">
              {isHe ? "מדיניות אחריות" : "سياسة الضمان"}
            </Link>
            .
          </P>
        </Card>

        <div className="card mt-6 border-state-info/30 bg-state-info/5" style={{ padding: 14 }}>
          <p className="text-state-info text-xs leading-relaxed text-center">
            {isHe
              ? "שאלות או תלונות: ניתן לפנות לרשות להגנת הצרכן ולסחר הוגן במשרד הכלכלה."
              : "أسئلة أو شكاوى: يمكن التوجّه لسلطة حماية المستهلك والتجارة العادلة في وزارة الاقتصاد."}
          </p>
        </div>
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

const EXCEPT_AR = [
  "منتجات مفصّلة حسب الطلب أو مخصّصة لك.",
  "منتجات قابلة للتلف أو إعادة النسخ (ملفات رقمية، برامج نُزِّلت).",
  "خدمات بدأ تنفيذها بموافقتك قبل انتهاء 14 يوماً.",
  "منتجات فُتحت ولا يمكن إعادة بيعها لأسباب صحية (سمّاعات داخل الأذن مثلاً).",
];

const EXCEPT_HE = [
  "מוצרים שיוצרו לפי הזמנה או מותאמים אישית.",
  "מוצרים ברי השחתה או שניתן לשכפלם (קבצים דיגיטליים, תוכנה שהורדה).",
  "שירותים שהחלו בביצועם לפי הסכמתך לפני תום 14 הימים.",
  "מוצרים שנפתחו ואי אפשר למוכרם מחדש מטעמי היגיינה (אוזניות פנימיות למשל).",
];

const STEPS_AR = [
  "سجّل الدخول إلى حسابك ← قسم \"طلباتي\".",
  "اختر الطلب المراد إلغاؤه واضغط \"إلغاء\".",
  "سنعرض لك رسوم الإلغاء قبل التأكيد.",
  "أو تواصل معنا على privacy@clalmobile.com أو 053-3337653 خلال ساعات العمل.",
  "ستصلك رسالة تأكيد بالبريد أو الواتساب خلال 48 ساعة.",
];

const STEPS_HE = [
  "התחבר לחשבונך ← מסך \"ההזמנות שלי\".",
  "בחר את ההזמנה לביטול ולחץ \"בטל\".",
  "נציג בפניך את דמי הביטול לפני האישור.",
  "לחלופין, פנה אלינו ב-privacy@clalmobile.com או 053-3337653 בשעות הפעילות.",
  "תקבל אישור במייל או בוואטסאפ תוך 48 שעות.",
];
