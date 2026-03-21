import { describe, it, expect } from "vitest";
import {
  getStoreMetadata,
  getProductMetadata,
  getPageMetadata,
} from "@/lib/seo";

describe("SEO Utilities", () => {
  describe("getStoreMetadata", () => {
    const meta = getStoreMetadata();

    it("returns a title containing ClalMobile", () => {
      expect(meta.title).toContain("ClalMobile");
    });

    it("returns a non-empty description", () => {
      expect(meta.description).toBeTruthy();
      expect(typeof meta.description).toBe("string");
    });

    it("includes keywords array", () => {
      expect(Array.isArray(meta.keywords)).toBe(true);
      expect((meta.keywords as string[]).length).toBeGreaterThan(0);
    });

    it("includes openGraph metadata", () => {
      expect(meta.openGraph).toBeDefined();
      expect(meta.openGraph!.title).toBeTruthy();
      expect(meta.openGraph!.siteName).toBe("ClalMobile");
    });

    it("includes twitter card metadata", () => {
      expect(meta.twitter).toBeDefined();
      expect((meta.twitter as any).card).toBe("summary");
    });
  });

  describe("getProductMetadata", () => {
    const product = {
      name_ar: "آيفون 15 برو",
      name_he: "אייפון 15 פרו",
      brand: "Apple",
      price: 4999,
      image_url: "https://example.com/iphone.jpg",
    };

    const meta = getProductMetadata(product);

    it("includes product name and brand in title", () => {
      expect(meta.title).toContain(product.name_ar);
      expect(meta.title).toContain(product.brand);
    });

    it("includes price in description when no custom description", () => {
      expect(meta.description).toContain("4999");
    });

    it("uses custom description when provided", () => {
      const custom = getProductMetadata({
        ...product,
        description_ar: "وصف مخصص للمنتج",
      });
      expect(custom.description).toBe("وصف مخصص للمنتج");
    });

    it("includes OG image when image_url is provided", () => {
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
  });

  describe("getPageMetadata", () => {
    it("returns metadata for known pages", () => {
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

    it("includes alternates with canonical URL", () => {
      const meta = getPageMetadata("cart");
      expect(meta.alternates?.canonical).toContain("/store/cart");
    });

    it("cart page title contains ClalMobile", () => {
      const meta = getPageMetadata("cart");
      expect(meta.title).toContain("ClalMobile");
    });
  });
});
