import { describe, it, expect } from "vitest";
import {
  ISRAELI_BANKS,
  ACTIVE_ISRAELI_BANKS,
  findBankByCode,
  searchBanks,
} from "@/lib/data/israeli-banks";
import {
  UNIQUE_ISRAELI_LOCALITIES,
  searchLocalities,
} from "@/lib/data/israeli-localities";

describe("Israeli banks reference data", () => {
  it("does not contain the Postal Bank (code 09) — product requirement", () => {
    expect(ISRAELI_BANKS.find((b) => b.code === "09")).toBeUndefined();
  });

  it("includes the major active banks (at minimum Leumi/Hapoalim/Discount/Mizrahi)", () => {
    const codes = ACTIVE_ISRAELI_BANKS.map((b) => b.code);
    expect(codes).toContain("10"); // Leumi
    expect(codes).toContain("12"); // Hapoalim
    expect(codes).toContain("11"); // Discount
    expect(codes).toContain("20"); // Mizrahi-Tefahot
  });

  it("every bank has Hebrew + Arabic names + a 2-char code", () => {
    for (const b of ISRAELI_BANKS) {
      expect(b.name_he.length).toBeGreaterThan(0);
      expect(b.name_ar.length).toBeGreaterThan(0);
      expect(b.code).toMatch(/^\d{2}$/);
    }
  });

  it("findBankByCode returns the right bank or undefined", () => {
    const leumi = findBankByCode("10");
    expect(leumi?.name_he).toContain("לאומי");
    expect(findBankByCode("00")).toBeUndefined();
  });

  it("searchBanks matches Hebrew substring", () => {
    const hits = searchBanks("הפועלים");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].code).toBe("12");
  });

  it("searchBanks matches Arabic substring", () => {
    const hits = searchBanks("لئومي");
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].code).toBe("10");
  });

  it("searchBanks matches the code directly", () => {
    const hits = searchBanks("31");
    expect(hits.find((b) => b.code === "31")).toBeDefined();
  });

  it("empty query returns all active banks", () => {
    expect(searchBanks("")).toEqual(ACTIVE_ISRAELI_BANKS);
  });
});

describe("Israeli localities reference data", () => {
  it("contains the four biggest Israeli cities", () => {
    const names = UNIQUE_ISRAELI_LOCALITIES.map((l) => l.name_he);
    expect(names).toContain("ירושלים");
    expect(names).toContain("תל אביב-יפו");
    expect(names).toContain("חיפה");
    expect(names).toContain("ראשון לציון");
  });

  it("has more than 150 unique localities", () => {
    expect(UNIQUE_ISRAELI_LOCALITIES.length).toBeGreaterThan(150);
  });

  it("no duplicate Hebrew names (dedupe worked)", () => {
    const heb = UNIQUE_ISRAELI_LOCALITIES.map((l) => l.name_he);
    const unique = new Set(heb);
    expect(unique.size).toBe(heb.length);
  });

  it("searchLocalities matches Hebrew prefix", () => {
    const res = searchLocalities("תל");
    expect(res.length).toBeGreaterThan(0);
    expect(res.some((l) => l.name_he.startsWith("תל"))).toBe(true);
  });

  it("searchLocalities matches Arabic substring", () => {
    const res = searchLocalities("القدس");
    expect(res.length).toBeGreaterThan(0);
    expect(res[0].name_he).toBe("ירושלים");
  });

  it("starts-with matches come before contains matches", () => {
    const res = searchLocalities("א");
    // The first several should start with א (either he or ar starts-with match)
    expect(res[0].name_he.startsWith("א") || (res[0].name_ar || "").startsWith("أ")).toBe(true);
  });

  it("empty query returns empty list", () => {
    expect(searchLocalities("")).toEqual([]);
    expect(searchLocalities("   ")).toEqual([]);
  });

  it("respects the limit argument", () => {
    expect(searchLocalities("א", 5).length).toBeLessThanOrEqual(5);
  });
});
