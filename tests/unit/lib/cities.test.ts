import { describe, it, expect } from "vitest";
import { searchCities, CITY_SEARCH_MIN_LENGTH, ISRAEL_CITIES } from "@/lib/cities";

// ─────────────────────────────────────────────
// searchCities
// ─────────────────────────────────────────────
describe("searchCities", () => {
  // ── Minimum length enforcement ──
  it("returns empty array for single character query", () => {
    expect(searchCities("ح")).toEqual([]);
  });

  it("returns empty array for empty string", () => {
    expect(searchCities("")).toEqual([]);
  });

  it("returns empty array for whitespace only", () => {
    expect(searchCities("   ")).toEqual([]);
  });

  // ── Arabic search ──
  it("finds cities by Arabic name prefix", () => {
    const results = searchCities("حيفا");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.ar === "حيفا")).toBe(true);
  });

  it("finds cities by partial Arabic name", () => {
    const results = searchCities("نا");
    expect(results.length).toBeGreaterThan(0);
    // "الناصرة" contains "نا"
    expect(results.some((c) => c.ar.includes("نا"))).toBe(true);
  });

  it("finds Nazareth in Arabic", () => {
    const results = searchCities("الناصرة");
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].ar).toBe("الناصرة");
  });

  // ── Hebrew search ──
  it("finds cities by Hebrew name", () => {
    const results = searchCities("חיפה");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.he === "חיפה")).toBe(true);
  });

  it("finds Tel Aviv in Hebrew", () => {
    const results = searchCities("תל אביב");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.he.includes("תל אביב"))).toBe(true);
  });

  // ── Normalization / fuzzy matching ──
  it("normalizes Arabic alef variants (أ/إ/آ -> ا)", () => {
    // "أم الفحم" should match searching with plain alef
    const results = searchCities("ام الفحم");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.ar === "أم الفحم")).toBe(true);
  });

  it("normalizes Arabic taa marbouta (ة -> ه)", () => {
    // Search with normalized form
    const results = searchCities("الناصره");
    expect(results.length).toBeGreaterThan(0);
  });

  // ── Result limiting ──
  it("returns at most 12 results", () => {
    // Search with a broad term that matches many cities
    const results = searchCities("بي");
    expect(results.length).toBeLessThanOrEqual(12);
  });

  // ── Scoring / ranking ──
  it("ranks prefix matches higher than substring matches", () => {
    const results = searchCities("حيفا");
    // "حيفا" should be first since it's an exact prefix match
    if (results.length > 0) {
      expect(results[0].ar).toBe("حيفا");
    }
  });

  // ── Palestinian cities ──
  it("finds Palestinian cities", () => {
    const results = searchCities("رام الله");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.ar === "رام الله")).toBe(true);
  });

  it("finds Gaza", () => {
    const results = searchCities("غزة");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.ar === "غزة")).toBe(true);
  });

  // ── No matches ──
  it("returns empty array for completely unrelated query", () => {
    const results = searchCities("xyznonexistent");
    expect(results).toEqual([]);
  });

  // ── Edge cases ──
  it("handles query with dashes (stripped during normalization)", () => {
    const results = searchCities("תל-אביב");
    expect(results.length).toBeGreaterThan(0);
  });

  it("trims whitespace from query", () => {
    const results = searchCities("  حيفا  ");
    expect(results.length).toBeGreaterThan(0);
    expect(results.some((c) => c.ar === "حيفا")).toBe(true);
  });
});

// ─────────────────────────────────────────────
// CITY_SEARCH_MIN_LENGTH
// ─────────────────────────────────────────────
describe("CITY_SEARCH_MIN_LENGTH", () => {
  it("equals 2", () => {
    expect(CITY_SEARCH_MIN_LENGTH).toBe(2);
  });
});

// ─────────────────────────────────────────────
// ISRAEL_CITIES structure
// ─────────────────────────────────────────────
describe("ISRAEL_CITIES", () => {
  it("is a non-empty array", () => {
    expect(Array.isArray(ISRAEL_CITIES)).toBe(true);
    expect(ISRAEL_CITIES.length).toBeGreaterThan(100);
  });

  it("each city has ar and he properties", () => {
    for (const city of ISRAEL_CITIES.slice(0, 20)) {
      expect(typeof city.ar).toBe("string");
      expect(typeof city.he).toBe("string");
      expect(city.ar.length).toBeGreaterThan(0);
      expect(city.he.length).toBeGreaterThan(0);
    }
  });
});
