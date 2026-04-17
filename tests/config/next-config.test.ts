/**
 * tests/config/next-config.test.ts
 * Validates next.config.js settings for Cloudflare Pages deployment.
 */

import { describe, it, expect } from "vitest";
import path from "path";

// Load next.config.js (CommonJS module, no external deps)
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nextConfig = require(path.resolve(__dirname, "../../next.config.js"));

describe("next.config.js", () => {
  // =========================================================================
  // Image optimization
  // =========================================================================
  describe("images", () => {
    it("has images.unoptimized set to true for Cloudflare Pages", () => {
      expect(nextConfig.images.unoptimized).toBe(true);
    });

    it("defines remote patterns for supabase", () => {
      const patterns = nextConfig.images.remotePatterns;
      expect(patterns).toBeInstanceOf(Array);
      const supabasePattern = patterns.find(
        (p: { hostname: string }) => p.hostname === "*.supabase.co",
      );
      expect(supabasePattern).toBeDefined();
      expect(supabasePattern.protocol).toBe("https");
    });

    it("defines remote patterns for cloudinary", () => {
      const patterns = nextConfig.images.remotePatterns;
      const cloudinaryPattern = patterns.find(
        (p: { hostname: string }) => p.hostname === "*.cloudinary.com",
      );
      expect(cloudinaryPattern).toBeDefined();
    });
  });

  // =========================================================================
  // Production optimizations
  // =========================================================================
  describe("production optimizations", () => {
    it("disables X-Powered-By header", () => {
      expect(nextConfig.poweredByHeader).toBe(false);
    });

    it("enables compression", () => {
      expect(nextConfig.compress).toBe(true);
    });

    it("enables React strict mode", () => {
      expect(nextConfig.reactStrictMode).toBe(true);
    });
  });

  // =========================================================================
  // Redirects
  // =========================================================================
  describe("redirects", () => {
    it("defines redirects function", () => {
      expect(typeof nextConfig.redirects).toBe("function");
    });

    it("redirects /shop to /store", async () => {
      const redirects = await nextConfig.redirects();
      const shopRedirect = redirects.find(
        (r: { source: string }) => r.source === "/shop",
      );
      expect(shopRedirect).toBeDefined();
      expect(shopRedirect.destination).toBe("/store");
      expect(shopRedirect.permanent).toBe(true);
    });

    it("redirects /products to /store", async () => {
      const redirects = await nextConfig.redirects();
      const productsRedirect = redirects.find(
        (r: { source: string }) => r.source === "/products",
      );
      expect(productsRedirect).toBeDefined();
      expect(productsRedirect.destination).toBe("/store");
    });

    it("redirects /terms to /legal", async () => {
      const redirects = await nextConfig.redirects();
      const termsRedirect = redirects.find(
        (r: { source: string }) => r.source === "/terms",
      );
      expect(termsRedirect).toBeDefined();
      expect(termsRedirect.destination).toBe("/legal");
    });
  });

  // =========================================================================
  // Security Headers
  // =========================================================================
  describe("security headers", () => {
    it("defines headers function", () => {
      expect(typeof nextConfig.headers).toBe("function");
    });

    it("includes security headers for all routes", async () => {
      const headers = await nextConfig.headers();
      const globalHeaders = headers.find(
        (h: { source: string }) => h.source === "/(.*)",
      );
      expect(globalHeaders).toBeDefined();
      const headerNames = globalHeaders.headers.map(
        (h: { key: string }) => h.key,
      );
      expect(headerNames).toContain("X-Frame-Options");
      expect(headerNames).toContain("X-Content-Type-Options");
      expect(headerNames).toContain("X-XSS-Protection");
      expect(headerNames).toContain("Referrer-Policy");
      expect(headerNames).toContain("Permissions-Policy");
    });

    it("includes webhook CORS headers", async () => {
      const headers = await nextConfig.headers();
      const webhookHeaders = headers.find(
        (h: { source: string }) => h.source === "/api/webhook/:path*",
      );
      expect(webhookHeaders).toBeDefined();
      const headerNames = webhookHeaders.headers.map(
        (h: { key: string }) => h.key,
      );
      expect(headerNames).toContain("Access-Control-Allow-Origin");
      expect(headerNames).toContain("Access-Control-Allow-Methods");
    });
  });
});
