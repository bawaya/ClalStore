"use client";

// =====================================================
// Accessibility Statement (הצהרת נגישות)
// Required under: תקנות שוויון זכויות לאנשים עם מוגבלות
// (התאמות נגישות לשירות), התשע"ג-2013, Regulation 35
//
// Targets: Israeli Standard 5568 / WCAG 2.0 Level AA
// =====================================================

import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";

const LAST_REVIEW = "2026-04-24";

export default function AccessibilityPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const isHe = lang === "he";

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader />
      <div className="max-w-3xl mx-auto" style={{ padding: scr.mobile ? "16px 14px 80px" : "32px 28px 100px" }}>
        <div className="text-center mb-6">
          <h1 className="font-black text-white mb-2" style={{ fontSize: scr.mobile ? 24 : 32 }}>
            ♿ {isHe ? "הצהרת נגישות" : "بيان إمكانية الوصول (النگישות)"}
          </h1>
          <p className="text-muted text-sm">
            {isHe ? "עודכן לאחרונה" : "آخر مراجعة"}: {LAST_REVIEW}
          </p>
        </div>

        <Card title={isHe ? "המחויבות שלנו" : "التزامنا"}>
          <P>
            {isHe
              ? "אנחנו ב-ClalMobile מאמינים שלכל אדם מגיעה גישה שווה למידע ולשירותים המקוונים שלנו. אנו מחויבים להנגשת האתר בהתאם לחוק שוויון זכויות לאנשים עם מוגבלות, התשנ״ח-1998, ותקנות שוויון זכויות לאנשים עם מוגבלות (התאמות נגישות לשירות), התשע״ג-2013."
              : "نحن في ClalMobile نؤمن بأن لكل شخص الحق في وصول متساوٍ لمعلوماتنا وخدماتنا الإلكترونية. نلتزم بإتاحة الوصول للموقع وفقاً لقانون المساواة في حقوق ذوي الإعاقة 1998 ولوائح المساواة لسنة 2013."}
          </P>
        </Card>

        <Card title={isHe ? "התקן שאליו אנו מכוונים" : "المعيار الذي نلتزم به"}>
          <P>
            {isHe
              ? "האתר נבנה בהתאם לתקן הישראלי ת״י 5568, המבוסס על הנחיות WCAG 2.0 של ארגון W3C, ברמת נגישות AA."
              : "الموقع مُصمَّم وفق المعيار الإسرائيلي 5568، المستند إلى توجيهات WCAG 2.0 الصادرة عن W3C، بمستوى AA."}
          </P>
        </Card>

        <Card title={isHe ? "מה עשינו עד היום" : "ما قمنا به حتى الآن"}>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc">
            {(isHe ? ACHIEVED_HE : ACHIEVED_AR).map((li, i) => (
              <li key={i} className="mb-1">{li}</li>
            ))}
          </ul>
        </Card>

        <Card title={isHe ? "שימוש מקל במקלדת" : "اختصارات لوحة المفاتيح"}>
          <P>
            {isHe
              ? "ניתן לנווט באתר במקלדת בלבד (מקש Tab לקידום, Shift+Tab לחזרה, Enter להפעלה, Esc לסגירת חלונות)."
              : "يمكن التصفح بلوحة المفاتيح فقط: Tab للتنقل، Shift+Tab للرجوع، Enter للتفعيل، Esc لإغلاق النوافذ."}
          </P>
        </Card>

        <Card title={isHe ? "מגבלות ידועות" : "القيود المعروفة"}>
          <P>
            {isHe
              ? "חרף מאמצינו, ייתכן ותיתקל בדפים או תכונות שטרם הונגשו במלואן. אנו עובדים באופן רציף על שיפור הנגישות. אם נתקלת בבעיה ספציפית — אנא פנה אלינו בערוצים שלהלן ונתקן בתוך 60 יום (כנדרש בחוק)."
              : "رغم جهودنا، قد تصادف صفحات أو ميزات لم تُتح بالكامل بعد. نعمل باستمرار على تحسين النگישות. إذا واجهت أي مشكلة، تواصل معنا وسنقوم بالتصحيح خلال 60 يوماً (وفقاً للقانون)."}
          </P>
        </Card>

        <Card title={isHe ? "פניות בנושא נגישות — רכז נגישות" : "الاتصال بشأن النگישות — منسّق النگישות"}>
          <P>
            {isHe
              ? "אנו ממנים רכז נגישות שמזמין אותך לפנות אליו בכל שאלה או בעיה:"
              : "نعيّن منسّق نگישות للرد على أي سؤال أو مشكلة:"}
          </P>
          <ul className="text-muted text-sm leading-relaxed mr-4 list-disc mt-1">
            <li className="mb-1">
              📧 <a href="mailto:accessibility@clalmobile.com" className="text-brand underline">accessibility@clalmobile.com</a>
            </li>
            <li className="mb-1">
              📞 <a href="tel:+972533337653" className="text-brand underline">053-3337653</a>
            </li>
            <li className="mb-1">
              💬 <a href="https://wa.me/972533337653" target="_blank" rel="noopener noreferrer" className="text-brand underline">WhatsApp</a>
            </li>
            <li className="mb-1">
              {isHe ? "זמני מענה: ראשון-חמישי 09:00–18:00" : "أوقات الرد: الأحد-الخميس 09:00–18:00"}
            </li>
          </ul>
        </Card>

        <Card title={isHe ? "הגשת תלונה לנציבות" : "تقديم شكوى إلى المفوضية"}>
          <P>
            {isHe ? (
              <>
                אם לא קיבלת מענה מספק מצדנו תוך 60 יום, באפשרותך לפנות לנציבות שוויון זכויות לאנשים עם מוגבלות במשרד המשפטים:
                {" "}
                <a href="https://www.gov.il/he/departments/the_commission_for_equal_rights_of_persons_with_disabilities" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                  אתר הנציבות
                </a>
              </>
            ) : (
              <>
                إذا لم تحصل على ردٍّ كافٍ منّا خلال 60 يوماً، يمكنك التوجّه لمفوضية المساواة لذوي الإعاقة في وزارة العدل الإسرائيلية:
                {" "}
                <a href="https://www.gov.il/he/departments/the_commission_for_equal_rights_of_persons_with_disabilities" target="_blank" rel="noopener noreferrer" className="text-brand underline">
                  الموقع الرسمي
                </a>
              </>
            )}
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
  return <p className="text-muted text-sm leading-relaxed">{children}</p>;
}

const ACHIEVED_AR = [
  "بنية HTML دلالية (semantic) مع عناوين مرتبة h1→h6.",
  "نص بديل (alt) لكل صور المنتجات.",
  "تباين لوني عالٍ (WCAG AA) بين النصوص والخلفيات.",
  "إمكانية التنقّل كاملاً بلوحة المفاتيح.",
  "دعم قارئات الشاشة (NVDA, VoiceOver).",
  "تسميات (ARIA labels) على كل الأزرار والحقول التفاعلية.",
  "دعم تكبير النص حتى 200% دون فقدان المحتوى.",
  "دعم RTL للعربية والعبرية.",
  "نماذج (forms) برسائل خطأ واضحة ومرتبطة بالحقل.",
];

const ACHIEVED_HE = [
  "מבנה HTML סמנטי עם כותרות מסודרות h1→h6.",
  "טקסט חלופי (alt) לכל תמונות המוצרים.",
  "ניגודיות צבעים גבוהה (WCAG AA) בין טקסט לרקע.",
  "אפשרות ניווט מלא במקלדת.",
  "תמיכה בקוראי מסך (NVDA, VoiceOver).",
  "תוויות ARIA לכל הכפתורים והשדות האינטראקטיביים.",
  "הגדלת טקסט עד 200% ללא אובדן תוכן.",
  "תמיכה ב-RTL לעברית וערבית.",
  "טפסים עם הודעות שגיאה ברורות ומקושרות לשדה.",
];
