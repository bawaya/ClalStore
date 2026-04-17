import { describe, it, expect } from "vitest";
import { smokeFetch } from "./_fetch";

describe("Production Smoke — Performance", () => {
  it("homepage loads in under 3s", async () => {
    const r = await smokeFetch("/");
    expect(r.ok).toBe(true);
    expect(r.elapsedMs).toBeLessThan(3000);
  });

  it("/store loads in under 3s", async () => {
    const r = await smokeFetch("/store");
    expect(r.ok).toBe(true);
    expect(r.elapsedMs).toBeLessThan(3000);
  });

  it("search API responds in under 1s", async () => {
    const r = await smokeFetch("/api/store/smart-search?q=iphone");
    expect(r.ok).toBe(true);
    expect(r.elapsedMs).toBeLessThan(1000);
  });

  it("public settings API responds in under 1s", async () => {
    const r = await smokeFetch("/api/settings/public");
    expect(r.ok).toBe(true);
    expect(r.elapsedMs).toBeLessThan(1000);
  });

  it("homepage size is under 5 MB", async () => {
    const r = await smokeFetch("/");
    const sizeBytes = new TextEncoder().encode(r.body ?? "").length;
    expect(sizeBytes).toBeLessThan(5 * 1024 * 1024);
  });
});
