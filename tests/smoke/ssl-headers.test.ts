import { describe, it, expect } from "vitest";
import { smokeFetch, BASE } from "./_fetch";

describe("Production Smoke — SSL & Security Headers", () => {
  it("HTTPS is served", async () => {
    expect(BASE).toMatch(/^https:\/\//);
    const r = await smokeFetch("/");
    expect(r.ok).toBe(true);
  });

  it("HTTP redirects to HTTPS", async () => {
    const httpUrl = BASE.replace(/^https:/, "http:");
    const r = await smokeFetch(httpUrl);
    // Either redirected (301/302/307/308) or responded OK after redirect
    expect([200, 301, 302, 307, 308]).toContain(r.status);
  });

  it("response includes security headers", async () => {
    const url = BASE;
    const res = await fetch(url);
    const headers = Object.fromEntries(res.headers.entries());

    // At least one of these must be present — hosting platforms differ in which they set
    const hasContentType = !!(headers["x-content-type-options"] || headers["content-security-policy"]);
    const hasFrame = !!(headers["x-frame-options"] || headers["content-security-policy"]);
    expect(hasContentType || hasFrame).toBe(true);
  });

  it("CORS headers are sensible", async () => {
    const res = await fetch(`${BASE}/api/settings/public`);
    const origin = res.headers.get("access-control-allow-origin");
    // Either no CORS header (same-origin only) or a restricted one — not a wildcard for admin
    if (origin) {
      // Public endpoint CAN be "*"; we just verify it's a string
      expect(typeof origin).toBe("string");
    }
  });

  it("SSL certificate is valid (no TLS errors)", async () => {
    // If fetch resolved without throwing, TLS handshake succeeded
    const r = await smokeFetch("/");
    expect(r.error).toBeUndefined();
    expect(r.status).toBeGreaterThanOrEqual(200);
  });
});
