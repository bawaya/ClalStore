// =====================================================================
// Israeli banks — active list, EXCLUDING בנק הדואר (Postal Bank, code 09)
// per product requirement.
//
// Each entry has a 2-digit SWIFT/Bank of Israel code, Hebrew name, and
// Arabic name (customer-friendly). Used by:
//   - Sales-request form's bank-name typeahead
//   - Validation layer (bank_code is a known value)
//
// Banks that merged into others (e.g. אוצר החייל → לאומי, איגוד →
// מזרחי-טפחות, יובנק) are still listed because historical accounts may
// still be referenced by their old code on bank forms.
// =====================================================================

export interface IsraeliBank {
  code: string;     // 2-digit bank code
  name_he: string;  // Hebrew name
  name_ar: string;  // Arabic name
  active: boolean;  // false = merged/closed; keep for legacy account forms
}

export const ISRAELI_BANKS: readonly IsraeliBank[] = [
  { code: "04", name_he: "בנק יהב לעובדי המדינה", name_ar: "بنك يهاف لموظفي الحكومة", active: true },
  { code: "10", name_he: "בנק לאומי לישראל", name_ar: "بنك لئومي إسرائيل", active: true },
  { code: "11", name_he: "בנק דיסקונט לישראל", name_ar: "بنك ديسكونت إسرائيل", active: true },
  { code: "12", name_he: "בנק הפועלים", name_ar: "بنك هبوعليم", active: true },
  { code: "13", name_he: "בנק איגוד לישראל", name_ar: "بنك إيغود (مدمج في مزراحي)", active: false },
  { code: "14", name_he: "בנק אוצר החייל", name_ar: "بنك أوتسار هحيال (مدمج في لئومي)", active: false },
  { code: "17", name_he: "בנק מרכנתיל דיסקונט", name_ar: "بنك ميركنتيل ديسكونت", active: true },
  { code: "18", name_he: "בנק וואן זירו (OneZero)", name_ar: "بنك وان زيرو", active: true },
  { code: "20", name_he: "בנק מזרחי טפחות", name_ar: "بنك مزراحي طفحوت", active: true },
  { code: "22", name_he: "סיטיבנק ישראל", name_ar: "سيتي بنك إسرائيل", active: true },
  { code: "26", name_he: "יובנק", name_ar: "يو-بنك (مدمج)", active: false },
  { code: "31", name_he: "הבנק הבינלאומי הראשון", name_ar: "البنك الدولي الأول", active: true },
  { code: "46", name_he: "בנק מסד", name_ar: "بنك مسد", active: true },
  { code: "52", name_he: "בנק פועלי אגודת ישראל (פאג\"י)", name_ar: "بنك بوعلي أغودات (باغي)", active: true },
  { code: "54", name_he: "בנק ירושלים", name_ar: "بنك القدس", active: true },
  // NOTE: בנק הדואר (09) intentionally excluded per product requirement.
];

export const ACTIVE_ISRAELI_BANKS = ISRAELI_BANKS.filter((b) => b.active);

export function findBankByCode(code: string): IsraeliBank | undefined {
  return ISRAELI_BANKS.find((b) => b.code === code);
}

/**
 * Case-insensitive substring match across Hebrew name, Arabic name, and
 * bank code. Used by the typeahead.
 */
export function searchBanks(query: string, activeOnly = true): IsraeliBank[] {
  const q = query.trim().toLowerCase();
  const source = activeOnly ? ACTIVE_ISRAELI_BANKS : ISRAELI_BANKS;
  if (!q) return [...source];
  return source.filter(
    (b) =>
      b.name_he.toLowerCase().includes(q) ||
      b.name_ar.toLowerCase().includes(q) ||
      b.code.includes(q),
  );
}
