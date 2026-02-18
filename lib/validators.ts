// =====================================================
// ClalMobile — Validators
// Israeli ID, Luhn (credit card), phone, bank, etc
// =====================================================

// ===== Israeli ID Validation (תעודת זהות) =====
export function validateIsraeliID(id: string): boolean {
  if (!/^\d{9}$/.test(id)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    let digit = parseInt(id[i]) * ((i % 2) + 1);
    if (digit > 9) digit -= 9;
    sum += digit;
  }
  return sum % 10 === 0;
}

// ===== Luhn Algorithm (Credit Card) =====
export function validateLuhn(cardNumber: string): boolean {
  const num = cardNumber.replace(/\s/g, "");
  if (!/^\d{8,19}$/.test(num)) return false;
  let sum = 0;
  let isEven = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let digit = parseInt(num[i]);
    if (isEven) {
      digit *= 2;
      if (digit > 9) digit -= 9;
    }
    sum += digit;
    isEven = !isEven;
  }
  return sum % 10 === 0;
}

// ===== Card Expiry (MM/YY) =====
export function validateCardExpiry(expiry: string): boolean {
  const clean = expiry.replace("/", "");
  if (!/^\d{4}$/.test(clean)) return false;
  const month = parseInt(clean.slice(0, 2));
  const year = parseInt("20" + clean.slice(2));
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const expDate = new Date(year, month);
  return expDate > now;
}

// ===== Phone (Israeli Mobile) =====
export function validatePhone(phone: string): boolean {
  const clean = phone.replace(/[-\s]/g, "");
  return /^05\d{8}$/.test(clean);
}

// ===== Email =====
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ===== Bank Details =====
export function validateBranch(branch: string): boolean {
  return /^\d{3}$/.test(branch);
}

export function validateAccount(account: string): boolean {
  return /^\d{4,9}$/.test(account);
}

export function validateCVV(cvv: string): boolean {
  return /^\d{3,4}$/.test(cvv);
}

// ===== Format Helpers =====
export function formatPhone(phone: string): string {
  const clean = phone.replace(/\D/g, "");
  if (clean.length === 10) {
    return `${clean.slice(0, 3)}-${clean.slice(3, 6)}-${clean.slice(6)}`;
  }
  return phone;
}

export function formatCardNumber(num: string): string {
  const clean = num.replace(/\D/g, "");
  return clean.replace(/(.{4})/g, "$1 ").trim();
}

export function formatCardExpiry(input: string): string {
  const clean = input.replace(/\D/g, "").slice(0, 4);
  if (clean.length > 2) return clean.slice(0, 2) + "/" + clean.slice(2);
  return clean;
}

export function maskCardNumber(num: string): string {
  return "****" + num.slice(-4);
}

export function maskAccount(account: string): string {
  return "****" + account.slice(-3);
}

// ===== Order ID Generator =====
export function generateOrderId(): string {
  const num = 10000 + Math.floor(Math.random() * 89999);
  return `CLM-${num}`;
}
