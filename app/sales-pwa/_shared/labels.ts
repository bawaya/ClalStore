// =====================================================
// Shared Arabic + Hebrew labels for Sales PWA pages.
// Keep strings here so the UI chrome is consistent.
// =====================================================

export const COMMISSION_LABELS = {
  summary: "ملخص · סיכום",
  today: "اليوم · היום",
  month: "هذا الشهر · החודש",
  net: "الصافي · נטו",
  target: "الهدف · יעד",
  recentSales: "آخر المبيعات · מכירות אחרונות",
  activity: "النشاط · פעילות",
  announcements: "الإعلانات · הודעות",
  corrections: "طلبات التصحيح · בקשות תיקון",
  calculator: "حاسبة · מחשבון",
} as const;

export const REQUEST_TYPE_LABELS: Record<string, string> = {
  amount_error: "خطأ في المبلغ",
  wrong_type: "نوع خاطئ",
  wrong_date: "تاريخ خاطئ",
  wrong_customer: "عميل خاطئ",
  missing_sale: "بيعة مفقودة",
  other: "أخرى",
};
