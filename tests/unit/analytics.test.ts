import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  trackAddToCart,
  trackPurchase,
  trackViewProduct,
  trackEvent,
  trackBeginCheckout,
  trackSearch,
} from "@/components/shared/Analytics";

describe("Analytics Helpers", () => {
  let gtagMock: ReturnType<typeof vi.fn>;
  let fbqMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    gtagMock = vi.fn();
    fbqMock = vi.fn();
    (window as any).gtag = gtagMock;
    (window as any).fbq = fbqMock;
  });

  describe("trackEvent", () => {
    it("calls gtag with event name and params", () => {
      trackEvent("test_event", { foo: "bar" });
      expect(gtagMock).toHaveBeenCalledWith("event", "test_event", { foo: "bar" });
    });

    it("calls fbq with trackCustom for non-standard events", () => {
      trackEvent("test_event", { foo: "bar" });
      expect(fbqMock).toHaveBeenCalledWith("trackCustom", "test_event", { foo: "bar" });
    });

    it("does not throw when gtag is missing", () => {
      delete (window as any).gtag;
      expect(() => trackEvent("test")).not.toThrow();
    });

    it("does not throw when fbq is missing", () => {
      delete (window as any).fbq;
      expect(() => trackEvent("test")).not.toThrow();
    });
  });

  describe("trackAddToCart", () => {
    it("calls gtag with add_to_cart event", () => {
      trackAddToCart("iPhone 15", 3499);
      expect(gtagMock).toHaveBeenCalledWith("event", "add_to_cart", {
        items: [{ item_name: "iPhone 15", price: 3499 }],
        currency: "ILS",
        value: 3499,
      });
    });

    it("calls fbq with AddToCart event", () => {
      trackAddToCart("iPhone 15", 3499);
      expect(fbqMock).toHaveBeenCalledWith("track", "AddToCart", {
        content_name: "iPhone 15",
        value: 3499,
        currency: "ILS",
      });
    });
  });

  describe("trackPurchase", () => {
    it("calls gtag with purchase event", () => {
      trackPurchase(999, "ILS", "ORD-123");
      expect(gtagMock).toHaveBeenCalledWith("event", "purchase", {
        value: 999,
        currency: "ILS",
        transaction_id: "ORD-123",
      });
    });

    it("calls fbq with Purchase event", () => {
      trackPurchase(999, "ILS", "ORD-123");
      expect(fbqMock).toHaveBeenCalledWith("track", "Purchase", {
        value: 999,
        currency: "ILS",
      });
    });

    it("defaults currency to ILS", () => {
      trackPurchase(500);
      expect(gtagMock).toHaveBeenCalledWith("event", "purchase", {
        value: 500,
        currency: "ILS",
        transaction_id: undefined,
      });
    });
  });

  describe("trackViewProduct", () => {
    it("calls gtag with view_item event", () => {
      trackViewProduct("Galaxy S24", 2999);
      expect(gtagMock).toHaveBeenCalledWith("event", "view_item", {
        items: [{ item_name: "Galaxy S24", price: 2999 }],
        currency: "ILS",
        value: 2999,
      });
    });

    it("calls fbq with ViewContent event", () => {
      trackViewProduct("Galaxy S24", 2999);
      expect(fbqMock).toHaveBeenCalledWith("track", "ViewContent", {
        content_name: "Galaxy S24",
        value: 2999,
        currency: "ILS",
      });
    });
  });

  describe("trackBeginCheckout", () => {
    it("calls gtag with begin_checkout event", () => {
      const items = [{ item_name: "Phone", price: 100, quantity: 1 }];
      trackBeginCheckout(100, items);
      expect(gtagMock).toHaveBeenCalledWith("event", "begin_checkout", {
        value: 100,
        currency: "ILS",
        items,
      });
    });

    it("calls fbq with InitiateCheckout event", () => {
      trackBeginCheckout(250, []);
      expect(fbqMock).toHaveBeenCalledWith("track", "InitiateCheckout", {
        value: 250,
        currency: "ILS",
      });
    });
  });

  describe("trackSearch", () => {
    it("calls gtag with search event", () => {
      trackSearch("iphone", 5);
      expect(gtagMock).toHaveBeenCalledWith("event", "search", {
        search_term: "iphone",
        results_count: 5,
      });
    });

    it("calls fbq with Search event", () => {
      trackSearch("iphone", 5);
      expect(fbqMock).toHaveBeenCalledWith("track", "Search", {
        search_string: "iphone",
        content_category: "store",
      });
    });
  });
});
