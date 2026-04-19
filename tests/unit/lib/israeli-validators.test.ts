import { describe, it, expect } from "vitest";
import {
  isValidIsraeliId,
  isValidIsraeliMobile,
  isValidBankBranch,
  isValidBankAccount,
  normaliseIsraeliMobile,
} from "@/lib/validators/israeli";

describe("isValidIsraeliId — Israeli national ID checksum", () => {
  it("accepts a known-valid 9-digit ID", () => {
    // Official test vectors (checksum-valid)
    expect(isValidIsraeliId("123456782")).toBe(true);
    expect(isValidIsraeliId("000000018")).toBe(true);
  });

  it("rejects an ID with a wrong check digit", () => {
    expect(isValidIsraeliId("123456789")).toBe(false);
    expect(isValidIsraeliId("111111111")).toBe(false);
  });

  it("rejects empty / too-short / too-long / non-numeric inputs", () => {
    expect(isValidIsraeliId("")).toBe(false);
    expect(isValidIsraeliId("1234")).toBe(false); // 4 digits
    expect(isValidIsraeliId("1234567890")).toBe(false); // 10 digits
    expect(isValidIsraeliId("abc")).toBe(false);
  });

  it("accepts a 5-8 digit ID when it checksums after zero-padding", () => {
    // 18 → padded to 000000018 → valid
    expect(isValidIsraeliId("18")).toBe(false); // too short (<5)
    expect(isValidIsraeliId("00018")).toBe(true); // 5 digits, pads to valid
  });

  it("strips non-digit characters before validating", () => {
    expect(isValidIsraeliId("123-456-782")).toBe(true);
    expect(isValidIsraeliId("123 456 782")).toBe(true);
  });
});

describe("isValidIsraeliMobile", () => {
  it("accepts canonical 05X numbers", () => {
    expect(isValidIsraeliMobile("0501234567")).toBe(true);
    expect(isValidIsraeliMobile("0541234567")).toBe(true);
    expect(isValidIsraeliMobile("0591234567")).toBe(true);
  });

  it("accepts formatted versions with dashes and spaces", () => {
    expect(isValidIsraeliMobile("050-123-4567")).toBe(true);
    expect(isValidIsraeliMobile("050 1234567")).toBe(true);
  });

  it("rejects landlines, foreign numbers, and wrong-length inputs", () => {
    expect(isValidIsraeliMobile("031234567")).toBe(false); // landline
    expect(isValidIsraeliMobile("050123456")).toBe(false); // 9 digits
    expect(isValidIsraeliMobile("05012345678")).toBe(false); // 11 digits
    expect(isValidIsraeliMobile("+972501234567")).toBe(false); // international prefix not accepted
    expect(isValidIsraeliMobile("")).toBe(false);
  });
});

describe("normaliseIsraeliMobile", () => {
  it("returns canonical 05XXXXXXXX for valid inputs", () => {
    expect(normaliseIsraeliMobile("050-123-4567")).toBe("0501234567");
    expect(normaliseIsraeliMobile("0501234567")).toBe("0501234567");
  });

  it("returns null for invalid numbers", () => {
    expect(normaliseIsraeliMobile("0301234567")).toBeNull();
    expect(normaliseIsraeliMobile("abc")).toBeNull();
  });
});

describe("isValidBankBranch — exactly 3 digits", () => {
  it("accepts 3-digit branches", () => {
    expect(isValidBankBranch("001")).toBe(true);
    expect(isValidBankBranch("123")).toBe(true);
    expect(isValidBankBranch("999")).toBe(true);
  });

  it("rejects non-3-digit inputs", () => {
    expect(isValidBankBranch("12")).toBe(false);
    expect(isValidBankBranch("1234")).toBe(false);
    expect(isValidBankBranch("abc")).toBe(false);
    expect(isValidBankBranch("")).toBe(false);
    expect(isValidBankBranch("12a")).toBe(false);
  });
});

describe("isValidBankAccount — 4 to 9 digits", () => {
  it("accepts 4, 6, 9 digit accounts", () => {
    expect(isValidBankAccount("1234")).toBe(true);
    expect(isValidBankAccount("123456")).toBe(true);
    expect(isValidBankAccount("123456789")).toBe(true);
  });

  it("rejects lengths outside 4..9", () => {
    expect(isValidBankAccount("123")).toBe(false);
    expect(isValidBankAccount("1234567890")).toBe(false);
    expect(isValidBankAccount("")).toBe(false);
  });

  it("rejects non-numeric", () => {
    expect(isValidBankAccount("12a4")).toBe(false);
    expect(isValidBankAccount("abcdef")).toBe(false);
  });
});
