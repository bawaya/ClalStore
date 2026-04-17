import { describe, it, expect } from "vitest";
import { smokeFetch, BASE } from "./_fetch";

describe("Production Smoke — Health", () => {
  it("GET / returns 200", async () => {
    const r = await smokeFetch("/");
    expect(r.ok).toBe(true);
    expect(r.status).toBe(200);
    expect((r.body ?? "").length).toBeGreaterThan(500);
  });

  it("GET /api/health returns 200 with success: true", async () => {
    const r = await smokeFetch("/api/health", { parseJson: true });
    expect([200, 401]).toContain(r.status); // Returns 401 if token required
    if (r.status === 200) {
      const body = r.json as { success?: boolean; data?: { status?: string } };
      expect(body.success).toBe(true);
      expect(body.data?.status).toMatch(/healthy|degraded/);
    }
  });

  it("GET /store returns 200", async () => {
    const r = await smokeFetch("/store");
    expect(r.status).toBe(200);
  });

  it("GET /admin redirects or requires auth", async () => {
    const r = await smokeFetch("/admin");
    // Either 200 (with auth UI) or 302/307/401 if redirecting
    expect([200, 302, 307, 401]).toContain(r.status);
  });

  it("GET /crm redirects or requires auth", async () => {
    const r = await smokeFetch("/crm");
    expect([200, 302, 307, 401]).toContain(r.status);
  });

  it("GET /api/settings/public returns valid JSON", async () => {
    const r = await smokeFetch("/api/settings/public", { parseJson: true });
    expect(r.status).toBe(200);
    expect(typeof r.json).toBe("object");
  });

  it("GET /robots.txt returns valid robots", async () => {
    const r = await smokeFetch("/robots.txt");
    expect(r.status).toBe(200);
    expect(r.body).toMatch(/User-agent/i);
  });

  it("GET /sitemap.xml returns valid sitemap", async () => {
    const r = await smokeFetch("/sitemap.xml");
    expect(r.status).toBe(200);
    expect(r.body).toMatch(/<\?xml|<urlset|<sitemap/);
  });

  it("base URL uses https", () => {
    expect(BASE).toMatch(/^https:\/\//);
  });
});
