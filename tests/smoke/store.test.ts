import { describe, it, expect } from "vitest";
import { smokeFetch } from "./_fetch";

describe("Production Smoke — Store", () => {
  it("GET /store returns product listings", async () => {
    const r = await smokeFetch("/store");
    expect(r.status).toBe(200);
  });

  it("GET /api/store/smart-search returns results", async () => {
    const r = await smokeFetch("/api/store/smart-search?q=iphone", { parseJson: true });
    expect(r.status).toBe(200);
    expect(r.json).toBeTruthy();
  });

  it("GET /api/store/autocomplete returns suggestions", async () => {
    const r = await smokeFetch("/api/store/autocomplete?q=ip", { parseJson: true });
    expect(r.status).toBe(200);
  });

  it("GET /api/reviews/featured returns reviews", async () => {
    const r = await smokeFetch("/api/reviews/featured", { parseJson: true });
    expect(r.status).toBe(200);
  });

  it("GET /about returns 200", async () => {
    const r = await smokeFetch("/about");
    expect(r.status).toBe(200);
  });

  it("GET /contact returns 200", async () => {
    const r = await smokeFetch("/contact");
    expect(r.status).toBe(200);
  });

  it("GET /faq returns 200", async () => {
    const r = await smokeFetch("/faq");
    expect(r.status).toBe(200);
  });

  it("GET /deals returns 200", async () => {
    const r = await smokeFetch("/deals");
    expect(r.status).toBe(200);
  });

  it("GET /legal returns 200", async () => {
    const r = await smokeFetch("/legal");
    expect(r.status).toBe(200);
  });

  it("GET /privacy returns 200", async () => {
    const r = await smokeFetch("/privacy");
    expect(r.status).toBe(200);
  });

  it("GET /store/cart returns 200", async () => {
    const r = await smokeFetch("/store/cart");
    expect(r.status).toBe(200);
  });

  it("GET /store/compare returns 200", async () => {
    const r = await smokeFetch("/store/compare");
    expect(r.status).toBe(200);
  });

  it("GET /store/wishlist returns 200", async () => {
    const r = await smokeFetch("/store/wishlist");
    expect(r.status).toBe(200);
  });

  it("GET /store/track returns 200", async () => {
    const r = await smokeFetch("/store/track");
    expect(r.status).toBe(200);
  });
});
