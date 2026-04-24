import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ConsentState } from "@/lib/consent";

vi.mock("@/lib/consent", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/consent")>();
  const allGranted: ConsentState = {
    essential: true,
    functional: true,
    analytics: true,
    advertising: true,
    version: mod.PRIVACY_VERSION,
    updated_at: new Date().toISOString(),
  };
  return { ...mod, readConsent: () => allGranted };
});

import {
  trackAddToCart,
  trackPurchase,
  trackViewProduct,
  trackEvent,
  trackBeginCheckout,
  trackSearch,
} from "@/components/shared/Analytics";

// This file extends the existing tests/unit/analytics.test.ts with additional
// edge cases and scenarios.

describe("Analytics Events (Extended)", () => {
  let gtagMock: ReturnType<typeof vi.fn>;
  let fbqMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagMock = vi.fn();
    fbqMock = vi.fn();
    (window as any).gtag = gtagMock;
    (window as any).fbq = fbqMock;
  });

  // ─── trackEvent edge cases ──────────────────────────────────────

  describe("trackEvent edge cases", () => {
    it("handles event with no params", () => {
      expect(() => trackEvent("test_event")).not.toThrow();
      expect(gtagMock).toHaveBeenCalledWith("event", "test_event", undefined);
    });

    it("handles event with empty params object", () => {
      trackEvent("test_event", {});
      expect(gtagMock).toHaveBeenCalledWith("event", "test_event", {});
    });

    it("does not throw when both gtag and fbq are missing", () => {
      delete (window as any).gtag;
      delete (window as any).fbq;
      expect(() => trackEvent("test")).not.toThrow();
    });

    it("handles special characters in event name", () => {
      expect(() => trackEvent("event-with_special.chars")).not.toThrow();
    });
  });

  // ─── trackAddToCart edge cases ──────────────────────────────────

  describe("trackAddToCart edge cases", () => {
    it("handles zero price", () => {
      trackAddToCart("Free Item", 0);
      expect(gtagMock).toHaveBeenCalledWith("event", "add_to_cart", {
        items: [{ item_name: "Free Item", price: 0 }],
        currency: "ILS",
        value: 0,
      });
    });

    it("handles large price values", () => {
      trackAddToCart("Expensive Phone", 99999);
      expect(gtagMock).toHaveBeenCalledWith("event", "add_to_cart", {
        items: [{ item_name: "Expensive Phone", price: 99999 }],
        currency: "ILS",
        value: 99999,
      });
    });

    it("handles Arabic product name", () => {
      trackAddToCart("آيفون 16 برو", 4999);
      expect(gtagMock).toHaveBeenCalledWith("event", "add_to_cart", {
        items: [{ item_name: "آيفون 16 برو", price: 4999 }],
        currency: "ILS",
        value: 4999,
      });
    });
  });

  // ─── trackPurchase edge cases ───────────────────────────────────

  describe("trackPurchase edge cases", () => {
    it("handles purchase with no transaction ID", () => {
      trackPurchase(1000);
      expect(gtagMock).toHaveBeenCalledWith("event", "purchase", {
        value: 1000,
        currency: "ILS",
        transaction_id: undefined,
      });
    });

    it("handles purchase with zero value", () => {
      trackPurchase(0, "ILS", "ORD-FREE");
      expect(gtagMock).toHaveBeenCalledWith("event", "purchase", {
        value: 0,
        currency: "ILS",
        transaction_id: "ORD-FREE",
      });
    });
  });

  // ─── trackViewProduct edge cases ────────────────────────────────

  describe("trackViewProduct edge cases", () => {
    it("fires both gtag and fbq events", () => {
      trackViewProduct("Test Phone", 1500);
      expect(gtagMock).toHaveBeenCalled();
      expect(fbqMock).toHaveBeenCalled();
    });

    it("handles Hebrew product name", () => {
      trackViewProduct("אייפון 16", 3999);
      expect(fbqMock).toHaveBeenCalledWith("track", "ViewContent", {
        content_name: "אייפון 16",
        value: 3999,
        currency: "ILS",
      });
    });
  });

  // ─── trackBeginCheckout edge cases ──────────────────────────────

  describe("trackBeginCheckout edge cases", () => {
    it("handles checkout with multiple items", () => {
      const items = [
        { item_name: "Phone", price: 3000, quantity: 1 },
        { item_name: "Case", price: 100, quantity: 2 },
      ];
      trackBeginCheckout(3200, items);
      expect(gtagMock).toHaveBeenCalledWith("event", "begin_checkout", {
        value: 3200,
        currency: "ILS",
        items,
      });
    });
  });

  // ─── trackSearch edge cases ─────────────────────────────────────

  describe("trackSearch edge cases", () => {
    it("handles search with 0 results", () => {
      trackSearch("nonexistent product", 0);
      expect(gtagMock).toHaveBeenCalledWith("event", "search", {
        search_term: "nonexistent product",
        results_count: 0,
      });
    });

    it("handles Arabic search term", () => {
      trackSearch("ايفون", 10);
      expect(gtagMock).toHaveBeenCalledWith("event", "search", {
        search_term: "ايفون",
        results_count: 10,
      });
    });
  });
});
