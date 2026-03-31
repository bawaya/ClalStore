import type { useScreen } from "@/lib/hooks";
import type { WebsiteContent } from "@/types/database";

export type EditorProps = {
  section?: WebsiteContent;
  onSave: (updates: Partial<WebsiteContent>) => Promise<void>;
  saving: boolean;
  scr: ReturnType<typeof useScreen>;
};

export const SECTIONS: { key: string; icon: string; label: string; desc: string }[] = [
  { key: "header", icon: "📌", label: "الهيدر (شريط التنقل)", desc: "الشعار والقائمة وأزرار الهيدر العلوي" },
  { key: "hero", icon: "🏠", label: "الهيرو الرئيسي", desc: "العنوان والوصف وأزرار الصفحة الرئيسية" },
  { key: "banners", icon: "🖼️", label: "البنرات (الكاروسيل)", desc: "بنرات العروض المتحركة في صفحة المتجر" },
  { key: "stats", icon: "📊", label: "شريط الإحصائيات", desc: "الأرقام المعروضة (عملاء، منتجات، توصيل...)" },
  { key: "features", icon: "⭐", label: "المميزات", desc: "مميزات المتجر (وكيل رسمي، توصيل مجاني...)" },
  { key: "faq", icon: "❓", label: "الأسئلة الشائعة", desc: "أسئلة وأجوبة الزبائن" },
  { key: "cta", icon: "📣", label: "الدعوة للعمل (CTA)", desc: "القسم التحفيزي قبل الفوتر" },
  { key: "footer", icon: "📋", label: "الفوتر", desc: "معلومات التواصل والروابط الاجتماعية والشعار" },
  { key: "subpages", icon: "📄", label: "صفحات فرعية", desc: "إضافة وإدارة صفحات فرعية مخصصة" },
];
