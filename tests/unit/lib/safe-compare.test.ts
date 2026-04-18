/**
 * Tests for lib/commissions/safe-compare.ts
 *
 * Verifies the constant-time token equality wrapper around
 * crypto.timingSafeEqual: null/undefined safety, length-mismatch
 * short-circuit (no throw), byte-level compare, and the
 * `a is string` type predicate.
 */
import { describe, it, expect } from "vitest";
import { safeTokenEqual } from "@/lib/commissions/safe-compare";

describe("safeTokenEqual — happy path", () => {
  it("returns true for two identical non-empty strings", () => {
    expect(safeTokenEqual("abcdef123", "abcdef123")).toBe(true);
  });

  it("returns true for identical 32-char bearer-like tokens", () => {
    const token = "a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6";
    expect(safeTokenEqual(token, token)).toBe(true);
  });
});

describe("safeTokenEqual — mismatch", () => {
  it("returns false for different strings of the same length", () => {
    expect(safeTokenEqual("abcdef", "abcxef")).toBe(false);
  });

  it("returns false when only one character differs at the end", () => {
    expect(safeTokenEqual("token-aaaaaa1", "token-aaaaaa2")).toBe(false);
  });
});

describe("safeTokenEqual — length mismatch short-circuit (must not throw)", () => {
  it("returns false for strings of different length without throwing", () => {
    // timingSafeEqual itself throws on length mismatch — the wrapper
    // pre-checks, so this must be a clean `false`.
    expect(() => safeTokenEqual("short", "muchlongerstring")).not.toThrow();
    expect(safeTokenEqual("short", "muchlongerstring")).toBe(false);
  });

  it("returns false for a 1-byte vs 2-byte input without throwing", () => {
    expect(() => safeTokenEqual("a", "ab")).not.toThrow();
    expect(safeTokenEqual("a", "ab")).toBe(false);
  });
});

describe("safeTokenEqual — falsy inputs", () => {
  it("returns false when `a` is undefined", () => {
    expect(safeTokenEqual(undefined, "real-token")).toBe(false);
  });

  it("returns false when `b` is undefined", () => {
    expect(safeTokenEqual("real-token", undefined)).toBe(false);
  });

  it("returns false when both are undefined", () => {
    expect(safeTokenEqual(undefined, undefined)).toBe(false);
  });

  it("returns false when `a` is null", () => {
    expect(safeTokenEqual(null, "real-token")).toBe(false);
  });

  it("returns false when `b` is null", () => {
    expect(safeTokenEqual("real-token", null)).toBe(false);
  });

  it("returns false when both are null", () => {
    expect(safeTokenEqual(null, null)).toBe(false);
  });
});

describe("safeTokenEqual — empty strings", () => {
  // Documented behaviour: the `!a || !b` check fires first on "",
  // so two empty strings resolve to false (never reaching
  // timingSafeEqual which would otherwise return true for 0-length buffers).
  it("returns false for two empty strings because `!a` fires first", () => {
    expect(safeTokenEqual("", "")).toBe(false);
  });

  it("returns false for empty on one side", () => {
    expect(safeTokenEqual("", "real")).toBe(false);
    expect(safeTokenEqual("real", "")).toBe(false);
  });
});

describe("safeTokenEqual — unicode/byte-length edge", () => {
  it("returns false when Unicode byte length matches ASCII but bytes differ", () => {
    // "שלום" — 4 Hebrew letters, 8 UTF-8 bytes.
    // "abcdefgh" — 8 ASCII bytes.
    const hebrew = "שלום";
    const ascii = "abcdefgh";
    expect(Buffer.byteLength(hebrew)).toBe(Buffer.byteLength(ascii));
    expect(safeTokenEqual(hebrew, ascii)).toBe(false);
  });

  it("compares two identical Unicode strings as equal", () => {
    expect(safeTokenEqual("שלום", "שלום")).toBe(true);
  });

  it("returns false when two strings with different code points share the same UTF-8 byte length", () => {
    // "ñ" (U+00F1) is 2 bytes in UTF-8. "ab" is also 2 bytes.
    // Byte lengths match, byte contents differ → timingSafeEqual runs and returns false.
    const latin = "ñ";
    const ascii = "ab";
    expect(Buffer.byteLength(latin)).toBe(Buffer.byteLength(ascii));
    expect(safeTokenEqual(latin, ascii)).toBe(false);
  });
});

describe("safeTokenEqual — type predicate narrowing", () => {
  it("narrows `a is string` so callers can call string-only methods", () => {
    const maybe: string | null | undefined = "hello-token";
    const provided: string = "hello-token";

    // Compile-time check: after safeTokenEqual returns true, both sides
    // are narrowed to `string`. Calling .toUpperCase() on `maybe`
    // requires the narrowing to work.
    if (safeTokenEqual(maybe, provided)) {
      // If the predicate didn't narrow, TS strict would error here.
      const upper: string = maybe.toUpperCase();
      expect(upper).toBe("HELLO-TOKEN");
    } else {
      throw new Error("expected equal tokens to satisfy narrowing branch");
    }
  });
});
