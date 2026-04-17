import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  validateIsraeliID,
  validateLuhn,
  validateCardExpiry,
  validatePhone,
  validateEmail,
  validateBranch,
  validateAccount,
  validateCVV,
  formatPhone,
  formatCardNumber,
  formatCardExpiry,
  maskCardNumber,
  maskAccount,
  generateOrderId,
  generateCustomerCode,
} from "@/lib/validators";

// ─────────────────────────────────────────────
// validateIsraeliID
// ─────────────────────────────────────────────
describe("validateIsraeliID", () => {
  it("validates a known valid Israeli ID", () => {
    // 000000018 is a well-known valid test ID
    expect(validateIsraeliID("000000018")).toBe(true);
  });

  it("validates another known valid ID (123456782)", () => {
    expect(validateIsraeliID("123456782")).toBe(true);
  });

  it("rejects an ID with wrong checksum", () => {
    expect(validateIsraeliID("000000019")).toBe(false);
  });

  it("rejects an ID shorter than 9 digits", () => {
    expect(validateIsraeliID("12345678")).toBe(false);
  });

  it("rejects an ID longer than 9 digits", () => {
    expect(validateIsraeliID("1234567890")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateIsraeliID("abcdefghi")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateIsraeliID("")).toBe(false);
  });

  it("rejects ID with spaces", () => {
    expect(validateIsraeliID("000 000 018")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// validateLuhn
// ─────────────────────────────────────────────
describe("validateLuhn", () => {
  it("validates a known valid card number (Visa test)", () => {
    expect(validateLuhn("4111111111111111")).toBe(true);
  });

  it("validates a known valid card number (MasterCard test)", () => {
    expect(validateLuhn("5500000000000004")).toBe(true);
  });

  it("validates card number with spaces", () => {
    expect(validateLuhn("4111 1111 1111 1111")).toBe(true);
  });

  it("rejects an invalid card number", () => {
    expect(validateLuhn("4111111111111112")).toBe(false);
  });

  it("rejects too short number (less than 8 digits)", () => {
    expect(validateLuhn("1234567")).toBe(false);
  });

  it("rejects too long number (more than 19 digits)", () => {
    expect(validateLuhn("12345678901234567890")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateLuhn("abcdefghijklmnop")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateLuhn("")).toBe(false);
  });

  it("validates 8-digit valid Luhn number", () => {
    // 79927398 is not valid via Luhn; 79927398713 (11 digit) is the standard test
    expect(validateLuhn("79927398713")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// validateCardExpiry
// ─────────────────────────────────────────────
describe("validateCardExpiry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Set current time to June 2025
    vi.setSystemTime(new Date(2025, 5, 15));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("validates a future expiry (12/26)", () => {
    expect(validateCardExpiry("12/26")).toBe(true);
  });

  it("validates current month expiry (06/25 — expires end of June 2025)", () => {
    // new Date(2025, 6) = July 1 2025 which is > June 15 2025
    expect(validateCardExpiry("06/25")).toBe(true);
  });

  it("rejects an expired card (01/25)", () => {
    // new Date(2025, 1) = Feb 1 2025 which is < June 15 2025
    expect(validateCardExpiry("01/25")).toBe(false);
  });

  it("rejects invalid month 00", () => {
    expect(validateCardExpiry("00/30")).toBe(false);
  });

  it("rejects invalid month 13", () => {
    expect(validateCardExpiry("13/30")).toBe(false);
  });

  it("rejects malformed input (too short)", () => {
    expect(validateCardExpiry("1/2")).toBe(false);
  });

  it("rejects non-numeric input", () => {
    expect(validateCardExpiry("ab/cd")).toBe(false);
  });

  it("accepts expiry without slash (0626)", () => {
    expect(validateCardExpiry("0626")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// validatePhone
// ─────────────────────────────────────────────
describe("validatePhone", () => {
  it("validates a valid Israeli mobile number", () => {
    expect(validatePhone("0501234567")).toBe(true);
  });

  it("validates with dashes", () => {
    expect(validatePhone("050-123-4567")).toBe(true);
  });

  it("validates with spaces", () => {
    expect(validatePhone("050 123 4567")).toBe(true);
  });

  it("validates 052 prefix", () => {
    expect(validatePhone("0521234567")).toBe(true);
  });

  it("validates 053 prefix", () => {
    expect(validatePhone("0531234567")).toBe(true);
  });

  it("validates 054 prefix", () => {
    expect(validatePhone("0541234567")).toBe(true);
  });

  it("validates 058 prefix", () => {
    expect(validatePhone("0581234567")).toBe(true);
  });

  it("rejects non-05x prefix", () => {
    expect(validatePhone("0401234567")).toBe(false);
  });

  it("rejects too short number", () => {
    expect(validatePhone("050123456")).toBe(false);
  });

  it("rejects too long number", () => {
    expect(validatePhone("05012345678")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validatePhone("")).toBe(false);
  });

  it("rejects landline number", () => {
    expect(validatePhone("0312345678")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// validateEmail
// ─────────────────────────────────────────────
describe("validateEmail", () => {
  it("validates a standard email", () => {
    expect(validateEmail("user@example.com")).toBe(true);
  });

  it("validates email with subdomains", () => {
    expect(validateEmail("user@sub.example.com")).toBe(true);
  });

  it("validates email with plus sign", () => {
    expect(validateEmail("user+tag@example.com")).toBe(true);
  });

  it("rejects email without @", () => {
    expect(validateEmail("userexample.com")).toBe(false);
  });

  it("rejects email without domain", () => {
    expect(validateEmail("user@")).toBe(false);
  });

  it("rejects email without TLD", () => {
    expect(validateEmail("user@example")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateEmail("")).toBe(false);
  });

  it("rejects email with spaces", () => {
    expect(validateEmail("user @example.com")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// validateBranch
// ─────────────────────────────────────────────
describe("validateBranch", () => {
  it("validates a 3-digit branch number", () => {
    expect(validateBranch("123")).toBe(true);
    expect(validateBranch("001")).toBe(true);
  });

  it("rejects 2-digit branch", () => {
    expect(validateBranch("12")).toBe(false);
  });

  it("rejects 4-digit branch", () => {
    expect(validateBranch("1234")).toBe(false);
  });

  it("rejects non-numeric branch", () => {
    expect(validateBranch("abc")).toBe(false);
  });

  it("rejects empty string", () => {
    expect(validateBranch("")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// validateAccount
// ─────────────────────────────────────────────
describe("validateAccount", () => {
  it("validates 4-digit account", () => {
    expect(validateAccount("1234")).toBe(true);
  });

  it("validates 9-digit account", () => {
    expect(validateAccount("123456789")).toBe(true);
  });

  it("validates 6-digit account", () => {
    expect(validateAccount("123456")).toBe(true);
  });

  it("rejects 3-digit account (too short)", () => {
    expect(validateAccount("123")).toBe(false);
  });

  it("rejects 10-digit account (too long)", () => {
    expect(validateAccount("1234567890")).toBe(false);
  });

  it("rejects non-numeric account", () => {
    expect(validateAccount("abcdef")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// validateCVV
// ─────────────────────────────────────────────
describe("validateCVV", () => {
  it("validates 3-digit CVV", () => {
    expect(validateCVV("123")).toBe(true);
  });

  it("validates 4-digit CVV (Amex)", () => {
    expect(validateCVV("1234")).toBe(true);
  });

  it("rejects 2-digit CVV", () => {
    expect(validateCVV("12")).toBe(false);
  });

  it("rejects 5-digit CVV", () => {
    expect(validateCVV("12345")).toBe(false);
  });

  it("rejects non-numeric CVV", () => {
    expect(validateCVV("abc")).toBe(false);
  });
});

// ─────────────────────────────────────────────
// formatPhone
// ─────────────────────────────────────────────
describe("formatPhone", () => {
  it("formats a 10-digit phone with dashes", () => {
    expect(formatPhone("0501234567")).toBe("050-123-4567");
  });

  it("returns original string for non-10-digit number", () => {
    expect(formatPhone("123456")).toBe("123456");
  });

  it("strips non-digits before formatting", () => {
    expect(formatPhone("050-1234567")).toBe("050-123-4567");
  });

  it("handles phone with spaces", () => {
    expect(formatPhone("050 123 4567")).toBe("050-123-4567");
  });
});

// ─────────────────────────────────────────────
// formatCardNumber
// ─────────────────────────────────────────────
describe("formatCardNumber", () => {
  it("formats 16-digit card into groups of 4", () => {
    expect(formatCardNumber("4111111111111111")).toBe("4111 1111 1111 1111");
  });

  it("strips existing non-digit characters first", () => {
    expect(formatCardNumber("4111-1111-1111-1111")).toBe("4111 1111 1111 1111");
  });

  it("handles shorter card numbers", () => {
    expect(formatCardNumber("41111111")).toBe("4111 1111");
  });
});

// ─────────────────────────────────────────────
// formatCardExpiry
// ─────────────────────────────────────────────
describe("formatCardExpiry", () => {
  it("formats 4-digit input as MM/YY", () => {
    expect(formatCardExpiry("1226")).toBe("12/26");
  });

  it("returns 2-digit input as-is (still typing)", () => {
    expect(formatCardExpiry("12")).toBe("12");
  });

  it("handles input with existing slash", () => {
    expect(formatCardExpiry("12/26")).toBe("12/26");
  });

  it("truncates input longer than 4 digits", () => {
    expect(formatCardExpiry("122699")).toBe("12/26");
  });

  it("handles single digit input", () => {
    expect(formatCardExpiry("1")).toBe("1");
  });
});

// ─────────────────────────────────────────────
// maskCardNumber
// ─────────────────────────────────────────────
describe("maskCardNumber", () => {
  it("masks all but last 4 digits", () => {
    expect(maskCardNumber("4111111111111111")).toBe("****1111");
  });

  it("handles short numbers", () => {
    expect(maskCardNumber("1234")).toBe("****1234");
  });
});

// ─────────────────────────────────────────────
// maskAccount
// ─────────────────────────────────────────────
describe("maskAccount", () => {
  it("masks all but last 3 digits", () => {
    expect(maskAccount("123456789")).toBe("****789");
  });

  it("handles short accounts", () => {
    expect(maskAccount("1234")).toBe("****234");
  });
});

// ─────────────────────────────────────────────
// generateOrderId
// ─────────────────────────────────────────────
describe("generateOrderId", () => {
  it("starts with CLM- prefix", () => {
    const id = generateOrderId();
    expect(id.startsWith("CLM-")).toBe(true);
  });

  it("has expected length pattern (CLM-XXXXXXXX)", () => {
    const id = generateOrderId();
    // CLM- + 4 base36 chars + 4 random digits = 8 chars after prefix
    expect(id.length).toBe(12); // "CLM-" (4) + 4 + 4
  });

  it("generates unique IDs across multiple calls", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20; i++) {
      ids.add(generateOrderId());
    }
    // Allow at most 1 collision in 20 due to timestamp granularity
    expect(ids.size).toBeGreaterThanOrEqual(19);
  });

  it("contains only alphanumeric characters after prefix", () => {
    const id = generateOrderId();
    const suffix = id.replace("CLM-", "");
    expect(/^[A-Z0-9]+$/.test(suffix)).toBe(true);
  });
});

// ─────────────────────────────────────────────
// generateCustomerCode
// ─────────────────────────────────────────────
describe("generateCustomerCode", () => {
  it("starts with CLAL- prefix", () => {
    const code = generateCustomerCode();
    expect(code.startsWith("CLAL-")).toBe(true);
  });

  it("has expected length pattern (CLAL-XXXXXXX)", () => {
    const code = generateCustomerCode();
    // CLAL- + 4 base36 chars + 3 random digits = 7 chars after prefix
    expect(code.length).toBe(12); // "CLAL-" (5) + 4 + 3
  });

  it("generates unique codes across multiple calls", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 10; i++) {
      codes.add(generateCustomerCode());
    }
    // Random portion (3 digits, 100-999) makes collisions rare but possible
    // within the same millisecond, so just ensure most are unique
    expect(codes.size).toBeGreaterThanOrEqual(8);
  });

  it("contains only alphanumeric characters after prefix", () => {
    const code = generateCustomerCode();
    const suffix = code.replace("CLAL-", "");
    expect(/^[A-Z0-9]+$/.test(suffix)).toBe(true);
  });
});
