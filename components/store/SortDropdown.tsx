"use client";

import { ArrowUpDown } from "lucide-react";
import { useLang } from "@/lib/i18n";

export type SortKey =
  | "default"
  | "price-asc"
  | "price-desc"
  | "newest"
  | "best-selling"
  | "discount";

export const SORT_OPTIONS: SortKey[] = [
  "default",
  "newest",
  "price-asc",
  "price-desc",
  "best-selling",
  "discount",
];

export function getSortLabel(key: SortKey, lang: "ar" | "he"): string {
  const labels: Record<SortKey, { ar: string; he: string }> = {
    default: { ar: "الافتراضي", he: "ברירת מחדל" },
    newest: { ar: "الأحدث", he: "החדש ביותר" },
    "price-asc": { ar: "السعر: من الأقل", he: "מחיר: מהנמוך" },
    "price-desc": { ar: "السعر: من الأكثر", he: "מחיר: מהגבוה" },
    "best-selling": { ar: "الأكثر مبيعاً", he: "הנמכרים ביותר" },
    discount: { ar: "أعلى خصم", he: "ההנחה הגבוהה" },
  };
  return labels[key][lang === "he" ? "he" : "ar"];
}

export function SortDropdown({
  value,
  onChange,
}: {
  value: SortKey;
  onChange: (key: SortKey) => void;
}) {
  const { lang } = useLang();
  const sortLabel = lang === "he" ? "מיין לפי" : "ترتيب حسب";

  return (
    <label className="inline-flex items-center gap-2 rounded-full border border-[#383842] bg-[#151519] px-3 py-1.5 text-sm text-[#dbdbe1]">
      <ArrowUpDown size={14} strokeWidth={1.6} className="text-white/55" aria-hidden />
      <span className="hidden sm:inline text-white/55">{sortLabel}:</span>
      <select
        aria-label={sortLabel}
        value={value}
        onChange={(e) => onChange(e.target.value as SortKey)}
        className="cursor-pointer bg-transparent text-white outline-none focus:outline-none [&>option]:bg-[#151519] [&>option]:text-white"
      >
        {SORT_OPTIONS.map((key) => (
          <option key={key} value={key}>
            {getSortLabel(key, lang as "ar" | "he")}
          </option>
        ))}
      </select>
    </label>
  );
}
