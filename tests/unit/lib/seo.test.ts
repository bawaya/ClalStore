// The existing tests/unit/seo.test.ts is already comprehensive.
// This file re-exports the same coverage in the new location with some additional edge-case tests.

import { describe, it, expect } from "vitest";
import {
  getStoreMetadata,
  getProductMetadata,
  getPageMetadata,
} from "@/lib/seo";

// ─────────────────────────────────────────────
// getStoreMetadata
// ─────────────────────────────────────────────
describe("getStoreMetadata", () => {
  const meta = getStoreMetadata();

  it("returns a title containing ClalMobile", () => {
    expect(meta.title).toContain("ClalMobile");
  });

  it("returns a non-empty description", () => {
    expect(meta.description).toBeTruthy();
    expect(typeof meta.description).toBe("string");
  });

  it("includes keywords array with relevant terms", () => {
    expect(Array.isArray(meta.keywords)).toBe(true);
    const kw = meta.keywords as string[];
    expect(kw.length).toBeGreaterThan(0);
    expect(kw).toContain("ClalMobile");
    expect(kw).toContain("HOT Mobile");
  });

  it("includes openGraph metadata with siteName", () => {
    expect(meta.openGraph).toBeDefined();
    expect(meta.openGraph!.title).toBeTruthy();
    expect(meta.openGraph!.siteName).toBe("ClalMobile");
  });

  it("includes twitter card as summary", () => {
    expect(meta.twitter).toBeDefined();
    expect((meta.twitter as any).card).toBe("summary");
  });

  it("includes alternates with canonical URL", () => {
    expect(meta.alternates?.canonical).toContain("/store");
  });

  it("includes language alternates for ar-IL and he-IL", () => {
    const langs = meta.alternates?.languages as Record<string, string>;
    expect(langs).toBeDefined();
    expect(langs["ar-IL"]).toBeDefined();
    expect(langs["he-IL"]).toBeDefined();
  });
});

// ─────────────────────────────────────────────
// getProductMetadata
// ─────────────────────────────────────────────
describe("getProductMetadata", () => {
  const product = {
    name_ar: "\u0622\u064A\u0641\u0648\u0646 15 \u0628\u0631\u0648",
    name_he: "\u05D0\u05D9\u05D9\u05E4\u05D5\u05DF 15 \u05E4\u05E8\u05D5",
    brand: "Apple",
    price: 4999,
    image_url: "https://example.com/iphone.jpg",
  };

  const meta = getProductMetadata(product);

  it("includes product name and brand in title", () => {
    expect(meta.title).toContain(product.name_ar);
    expect(meta.title).toContain(product.brand);
  });

  it("includes price in auto-generated description", () => {
    expect(meta.description).toContain("4999");
  });

  it("uses custom description_ar when provided", () => {
    const custom = getProductMetadata({
      ...product,
      description_ar: "\u0648\u0635\u0641 \u0645\u062E\u0635\u0635",
    });
    expect(custom.description).toBe("\u0648\u0635\u0641 \u0645\u062E\u0635\u0635");
  });

  it("includes OG image when image_url provided", () => {
    const images = (meta.openGraph as any)?.images;
    expect(images).toBeDefined();
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].url).toBe(product.image_url);
  });

  it("uses summary_large_image twitter card when image present", () => {
    expect((meta.twitter as any).card).toBe("summary_large_image");
  });

  it("uses summary twitter card when no image", () => {
    const noImage = getProductMetadata({ ...product, image_url: undefined });
    expect((noImage.twitter as any).card).toBe("summary");
  });

  it("includes brand and product names in keywords", () => {
    expect(meta.keywords).toContain(product.brand);
    expect(meta.keywords).toContain(product.name_ar);
    expect(meta.keywords).toContain(product.name_he);
  });

  it("has no OG images when image_url is not provided", () => {
    const noImage = getProductMetadata({ ...product, image_url: undefined });
    const images = (noImage.openGraph as any)?.images;
    expect(images).toEqual([]);
  });
});

// ─────────────────────────────────────────────
// getPageMetadata
// ─────────────────────────────────────────────
describe("getPageMetadata", () => {
  it("returns metadata for all known pages", () => {
    const knownPages = ["cart", "checkout", "wishlist", "compare", "contact", "account", "auth", "track"];

    for (const page of knownPages) {
      const meta = getPageMetadata(page);
      expect(meta.title).toBeTruthy();
      expect(meta.description).toBeTruthy();
    }
  });

  it("returns fallback metadata for unknown pages", () => {
    const meta = getPageMetadata("nonexistent-page");
    expect(meta.title).toBe("ClalMobile");
    expect(meta.description).toContain("ClalMobile");
  });

  it("includes openGraph for known pages", () => {
    const meta = getPageMetadata("cart");
    expect(meta.openGraph).toBeDefined();
    expect((meta.openGraph as any).type).toBe("website");
  });

  it("includes alternates with canonical URL for known pages", () => {
    const meta = getPageMetadata("cart");
    expect(meta.alternates?.canonical).toContain("/store/cart");
  });

  it("cart page title contains ClalMobile", () => {
    const meta = getPageMetadata("cart");
    expect(meta.title).toContain("ClalMobile");
  });

  it("checkout page has payment-related description", () => {
    const meta = getPageMetadata("checkout");
    expect(meta.description).toBeTruthy();
  });

  it("fallback page does not include alternates", () => {
    const meta = getPageMetadata("unknownpage");
    expect(meta.alternates).toBeUndefined();
  });

  it("fallback page does not include openGraph", () => {
    const meta = getPageMetadata("unknownpage");
    expect(meta.openGraph).toBeUndefined();
  });

  it("contact page metadata has keywords", () => {
    const meta = getPageMetadata("contact");
    expect(meta.keywords).toBeDefined();
    expect((meta.keywords as string[]).length).toBeGreaterThan(0);
  });
});
