// =====================================================================
// Israeli-specific input validators — ID number, mobile phone, bank
// branch/account digits. Used by the sales-request form (client-side
// hints) AND the API (server-side authoritative check).
// =====================================================================

/**
 * Validate an Israeli national ID (תעודת זהות) using the official Luhn
 * variant check. Accepts 5–9 digit inputs and zero-pads to 9.
 *
 *   1. Right-pad with leading zeros to 9 digits
 *   2. Multiply even-index digits by 1, odd-index by 2
 *   3. Sum digits of each product (e.g. 14 → 1+4 = 5)
 *   4. Valid if the total is divisible by 10
 */
export function isValidIsraeliId(raw: string): boolean {
  if (!raw) return false;
  const cleaned = raw.replace(/\D/g, "");
  if (cleaned.length < 5 || cleaned.length > 9) return false;
  const padded = cleaned.padStart(9, "0");
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = Number(padded[i]);
    if (i % 2 === 1) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
  }
  return sum % 10 === 0;
}

/**
 * Israeli mobile number: starts with 05, followed by 8 digits.
 * Accepts formatting (dashes/spaces) — stripped before check.
 */
export function isValidIsraeliMobile(raw: string): boolean {
  if (!raw) return false;
  const cleaned = raw.replace(/[\s-]/g, "");
  return /^05\d{8}$/.test(cleaned);
}

/**
 * Normalise Israeli mobile to canonical `05XXXXXXXX` form. Returns null
 * if invalid.
 */
export function normaliseIsraeliMobile(raw: string): string | null {
  const cleaned = raw.replace(/[\s-]/g, "");
  if (!/^05\d{8}$/.test(cleaned)) return null;
  return cleaned;
}

/** Bank branch: exactly 3 digits. */
export function isValidBankBranch(raw: string): boolean {
  return /^\d{3}$/.test((raw || "").trim());
}

/** Bank account: 4–9 digits (inclusive). */
export function isValidBankAccount(raw: string): boolean {
  const cleaned = (raw || "").trim();
  return /^\d{4,9}$/.test(cleaned);
}
