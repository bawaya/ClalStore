import { describe, it, expect } from "vitest";
import { hashSHA256 } from "@/lib/crypto";

// ─────────────────────────────────────────────
// hashSHA256
// ─────────────────────────────────────────────
describe("hashSHA256", () => {
  it("returns a 64-character hex string", async () => {
    const hash = await hashSHA256("hello");
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("produces the correct SHA-256 hash for 'hello'", async () => {
    // Known SHA-256 for "hello"
    const expected = "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
    const hash = await hashSHA256("hello");
    expect(hash).toBe(expected);
  });

  it("produces the correct SHA-256 hash for empty string", async () => {
    const expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    const hash = await hashSHA256("");
    expect(hash).toBe(expected);
  });

  it("produces different hashes for different inputs", async () => {
    const hash1 = await hashSHA256("hello");
    const hash2 = await hashSHA256("world");
    expect(hash1).not.toBe(hash2);
  });

  it("produces the same hash for the same input (deterministic)", async () => {
    const hash1 = await hashSHA256("test");
    const hash2 = await hashSHA256("test");
    expect(hash1).toBe(hash2);
  });

  it("handles Unicode characters", async () => {
    const hash = await hashSHA256("\u0645\u0631\u062D\u0628\u0627"); // مرحبا
    expect(hash).toHaveLength(64);
    expect(/^[0-9a-f]{64}$/.test(hash)).toBe(true);
  });

  it("handles long strings", async () => {
    const longStr = "a".repeat(10000);
    const hash = await hashSHA256(longStr);
    expect(hash).toHaveLength(64);
  });
});
