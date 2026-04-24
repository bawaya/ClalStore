"use client";

import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import Link from "next/link";

export default function WarrantyPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const isHe = lang === "he";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <div className="max-w-3xl mx-auto" style={{ padding: scr.mobile ? "16px 14px 80px" : "32px 28px 100px" }}>
        <div className="text-center mb-6">
          <h1 className="font-black text-white mb-2" style={{ fontSize: scr.mobile ? 24 : 32 }}>
            🛡️ {isHe ? "מדיניות אחריות" : "سياسة الضمان"}
          </h1>
        </div>

        <Card title={isHe ? "אחריות יצרן רשמית" : "ضمان الشركة المصنّعة الرسمي"}>
          <P>
            {isHe
              ? "כל מוצר חדש הנמכר באתר כולל אחריות יצרן/יבואן רשמי בהתאם לקבוע ע״י היצרן. משך האחריות מופיע בדף המוצר."
              : "كل منتج جديد مباع في الموقع مشمول بضمان المصنع/المستورد الرسمي حسب ما تحدّده الشركة المصنّعة. مدة الضمان تظهر في صفحة المنتج."}
          </P>
        </Card>

        <Card title={isHe ? "משך אחריות לפי קטגוריה" : "مدة الضمان حسب الفئة"}>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc">
            <li className="mb-1">
              📱 {isHe ? "מכשירי סלולר:" : "الأجهزة المحمولة:"} <span className="text-white">24 {isHe ? "חודשים" : "شهر"}</span>
            </li>
            <li className="mb-1">
              💻 {isHe ? "מחשבים ולפטופים:" : "الحواسيب واللابتوبات:"} <span className="text-white">12-36 {isHe ? "חודשים" : "شهر"}</span>
            </li>
            <li className="mb-1">
              📺 {isHe ? "טלוויזיות:" : "التلفزيونات:"} <span className="text-white">24 {isHe ? "חודשים" : "شهر"}</span>
            </li>
            <li className="mb-1">
              🏠 {isHe ? "מוצרי חשמל לבית:" : "الأجهزة المنزلية:"} <span className="text-white">12-24 {isHe ? "חודשים" : "شهر"}</span>
            </li>
            <li className="mb-1">
              🔌 {isHe ? "אביזרים:" : "الإكسسوارات:"} <span className="text-white">12 {isHe ? "חודשים" : "شهر"}</span>
            </li>
          </ul>
        </Card>

        <Card title={isHe ? "מה כלול באחריות" : "ما يشمله الضمان"}>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc">
            {(isHe ? COVERED_HE : COVERED_AR).map((li, i) => (
              <li key={i} className="mb-1">{li}</li>
            ))}
          </ul>
        </Card>

        <Card title={isHe ? "מה אינו כלול" : "ما لا يشمله الضمان"}>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc">
            {(isHe ? EXCLUDED_HE : EXCLUDED_AR).map((li, i) => (
              <li key={i} className="mb-1">{li}</li>
            ))}
          </ul>
        </Card>

        <Card title={isHe ? "איך מפעילים את האחריות" : "كيف نفعّل الضمان"}>
          <ol className="text-muted text-sm leading-relaxed mr-4 list-decimal">
            {(isHe ? ACTIVATE_HE : ACTIVATE_AR).map((li, i) => (
              <li key={i} className="mb-1">{li}</li>
            ))}
          </ol>
        </Card>

        <Card title={isHe ? "קישורים שימושיים" : "روابط مفيدة"}>
          <div className="flex flex-wrap gap-2">
            <Link href="/returns" className="chip text-xs border border-brand/30 text-brand">
              {isHe ? "ביטול עסקה" : "إلغاء الطلب"}
            </Link>
            <Link href="/contact" className="chip text-xs border border-surface-border">
              {isHe ? "צור קשר" : "تواصل معنا"}
            </Link>
            <Link href="/faq" className="chip text-xs border border-surface-border">
              FAQ
            </Link>
          </div>
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

const COVERED_AR = [
  "عيوب تصنيع وأعطال تظهر خلال الاستخدام العادي.",
  "أعطال كهربائية داخلية.",
  "أعطال في الأجزاء الإلكترونية التي لم يتمّ تعديلها.",
];
const COVERED_HE = [
  "פגמי ייצור ותקלות שמופיעות בשימוש תקין.",
  "תקלות חשמל פנימיות.",
  "תקלות ברכיבים אלקטרוניים שלא שונו.",
];

const EXCLUDED_AR = [
  "نزول المنتج في الماء أو أضرار رطوبة.",
  "كسر أو خدش ناتج عن سوء استخدام أو سقوط.",
  "حريق، صاعقة، أو ارتفاع فولتية.",
  "تعديلات غير معتمدة (جيلبريك، روم مخصّص).",
  "استخدام إكسسوارات غير أصلية أدّت لعطل.",
  "تآكل طبيعي بعد الاستخدام الطويل (بطارية مستهلكة).",
];
const EXCLUDED_HE = [
  "נזקי מים/רטיבות.",
  "שבר או שריטה כתוצאה מנפילה או שימוש לא תקין.",
  "שריפה, ברק או עליית מתח.",
  "שינויים לא מאושרים (Jailbreak, ROM מותאם).",
  "שימוש באביזרים לא מקוריים שגרמו לתקלה.",
  "בלאי טבעי בשימוש ממושך (סוללה שהתיישנה).",
];

const ACTIVATE_AR = [
  "احتفظ بالفاتورة الأصلية (متوفرة في حسابك بشكل إلكتروني).",
  "تواصل معنا عبر الهاتف، الواتساب، أو البريد الإلكتروني واشرح المشكلة.",
  "سنوجّهك إلى مركز خدمة المصنّع المعتمد الأقرب إليك.",
  "لن ندفع أي رسوم للتشخيص إذا كان العطل مشمولاً بالضمان.",
];
const ACTIVATE_HE = [
  "שמור את החשבונית המקורית (זמינה בחשבון שלך באופן דיגיטלי).",
  "פנה אלינו טלפונית, בוואטסאפ או במייל והסבר את הבעיה.",
  "אנו נפנה אותך למרכז שירות רשמי של היצרן הקרוב אליך.",
  "אין עמלות איבחון אם התקלה בכיסוי האחריות.",
];
