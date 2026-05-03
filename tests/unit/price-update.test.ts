import { describe, it, expect } from "vitest";
import {
  applyPriceToVariants,
  classifyMatchStatus,
  extractStorage,
  findCandidates,
  normalizeName,
  runValidations,
  scoreMatch,
  tokenize,
  type ProductLite,
} from "@/lib/admin/price-update";

const sampleProducts: ProductLite[] = [
  {
    id: "p1",
    name_ar: "Samsung Galaxy S24 Ultra",
    name_he: "Samsung Galaxy S24 Ultra",
    name_en: "Samsung Galaxy S24 Ultra",
    brand: "Samsung",
    model_number: "SM-S928",
    price: 4500,
    cost: 3000,
    variants: [
      { storage: "256GB", price: 4500, monthly_price: 125 },
      { storage: "512GB", price: 4900, monthly_price: 136 },
    ],
  },
  {
    id: "p2",
    name_ar: "Apple iPhone 15 Pro Max",
    name_he: "אייפון 15 פרו מקס",
    name_en: "iPhone 15 Pro Max",
    brand: "Apple",
    model_number: "A2849",
    price: 5200,
    cost: 3500,
    variants: [{ storage: "256GB", price: 5200, monthly_price: 144 }],
  },
  {
    id: "p3",
    name_ar: "Samsung Galaxy A55",
    name_he: "Samsung Galaxy A55",
    name_en: "Samsung Galaxy A55",
    brand: "Samsung",
    model_number: "SM-A556",
    price: 1500,
    cost: 1000,
    variants: [{ storage: "128GB", price: 1500, monthly_price: 42 }],
  },
];

describe("normalizeName", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalizeName("Galaxy S24 ULTRA")).toBe("galaxy s24 ultra");
  });

  it("folds Arabic brand names to Latin", () => {
    expect(normalizeName("سامسونج جالكسي S24")).toContain("samsung");
    expect(normalizeName("سامسونج جالكسي S24")).toContain("galaxy");
  });

  it("folds Hebrew brand names", () => {
    expect(normalizeName("אייפון 15")).toContain("iphone");
  });

  it("collapses whitespace", () => {
    expect(normalizeName("  Galaxy   S24    ")).toBe("galaxy s24");
  });
});

describe("extractStorage", () => {
  it("extracts GB storage", () => {
    expect(extractStorage("Galaxy S24 256GB")).toBe("256GB");
  });

  it("extracts TB storage", () => {
    expect(extractStorage("iPhone 15 Pro Max 1TB")).toBe("1TB");
  });

  it("returns null when missing", () => {
    expect(extractStorage("Galaxy S24")).toBeNull();
  });
});

describe("tokenize", () => {
  it("splits on spaces and special chars", () => {
    expect(tokenize("Galaxy-S24/Ultra")).toEqual(["galaxy", "s24", "ultra"]);
  });

  it("drops 1-char tokens", () => {
    expect(tokenize("a Galaxy b")).toEqual(["galaxy"]);
  });
});

describe("scoreMatch", () => {
  it("scores 100 for exact name match", () => {
    expect(scoreMatch("Samsung Galaxy S24 Ultra", sampleProducts[0])).toBe(100);
  });

  it("scores high for Arabic name with brand", () => {
    const score = scoreMatch("سامسونج Galaxy S24 Ultra", sampleProducts[0]);
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("scores lower for partial match", () => {
    const score = scoreMatch("Galaxy A55", sampleProducts[0]);
    expect(score).toBeLessThan(80);
  });

  it("scores zero for unrelated", () => {
    expect(scoreMatch("Roborock S8", sampleProducts[0])).toBe(0);
  });

  it("matches exactly when Excel adds storage suffix and DB name has none", () => {
    // Regression: "Samsung Galaxy S24 Ultra 256GB" must score 100 against
    // "Samsung Galaxy S24 Ultra" (storage lives on variants, not in the name).
    expect(scoreMatch("Samsung Galaxy S24 Ultra 256GB", sampleProducts[0])).toBe(100);
  });

  it("still scores high for unknown storage suffix", () => {
    // A storage value not present in any variant should still match the base name strongly.
    expect(scoreMatch("Samsung Galaxy S24 Ultra 999GB", sampleProducts[0])).toBeGreaterThanOrEqual(95);
  });

  it("disambiguates Pro Max vs Pro when Excel name carries storage", () => {
    const products: ProductLite[] = [
      { ...sampleProducts[0], id: "pro", name_ar: "Apple iPhone 17 Pro", name_he: "Apple iPhone 17 Pro", name_en: "Apple iPhone 17 Pro", brand: "Apple", price: 4000, cost: 2500, variants: [{ storage: "256GB", price: 4000 }] },
      { ...sampleProducts[0], id: "promax", name_ar: "Apple iPhone 17 Pro Max", name_he: "Apple iPhone 17 Pro Max", name_en: "Apple iPhone 17 Pro Max", brand: "Apple", price: 5000, cost: 3000, variants: [{ storage: "256GB", price: 5000 }] },
    ];
    const proMaxScore = scoreMatch("iPhone 17 Pro Max 256GB", products[1]);
    const proScore = scoreMatch("iPhone 17 Pro Max 256GB", products[0]);
    expect(proMaxScore).toBeGreaterThan(proScore);
    expect(proMaxScore).toBeGreaterThanOrEqual(95);
  });
});

describe("findCandidates", () => {
  it("returns top match first", () => {
    const candidates = findCandidates("Galaxy S24 Ultra", sampleProducts);
    expect(candidates[0].productId).toBe("p1");
  });

  it("disambiguates by brand", () => {
    // "Galaxy" alone matches p1 and p3 (both Samsung Galaxy); top should still be the Galaxy result.
    const candidates = findCandidates("Galaxy A55", sampleProducts);
    expect(candidates[0].productId).toBe("p3");
  });

  it("returns empty for no match", () => {
    expect(findCandidates("XXXX", sampleProducts)).toHaveLength(0);
  });
});

describe("classifyMatchStatus", () => {
  it("returns exact for 100", () => {
    expect(classifyMatchStatus([{ productId: "x", productName: "n", brand: "b", score: 100, reason: "" }])).toBe("exact");
  });

  it("returns ambiguous when top two scores are within 5", () => {
    const status = classifyMatchStatus([
      { productId: "a", productName: "n1", brand: "b", score: 80, reason: "" },
      { productId: "b", productName: "n2", brand: "b", score: 78, reason: "" },
    ]);
    expect(status).toBe("ambiguous");
  });

  it("returns high when top score is clear winner", () => {
    const status = classifyMatchStatus([
      { productId: "a", productName: "n1", brand: "b", score: 90, reason: "" },
      { productId: "b", productName: "n2", brand: "b", score: 50, reason: "" },
    ]);
    expect(status).toBe("high");
  });

  it("returns low for borderline", () => {
    const status = classifyMatchStatus([
      { productId: "a", productName: "n1", brand: "b", score: 65, reason: "" },
    ]);
    expect(status).toBe("low");
  });

  it("returns none when empty or below threshold", () => {
    expect(classifyMatchStatus([])).toBe("none");
    expect(
      classifyMatchStatus([{ productId: "a", productName: "n", brand: "b", score: 30, reason: "" }]),
    ).toBe("none");
  });
});

describe("runValidations", () => {
  const product = sampleProducts[0]; // price 4500, cost 3000

  it("flags large delta", () => {
    const warnings = runValidations({ idx: 0, name: "x", cash: 2000, monthly: 56 }, product);
    expect(warnings.find((w) => w.code === "delta_high")).toBeDefined();
  });

  it("flags monthly mismatch", () => {
    // 50 × 36 = 1800 ≠ 4500 → mismatch >5%
    const warnings = runValidations({ idx: 0, name: "x", cash: 4500, monthly: 50 }, product);
    expect(warnings.find((w) => w.code === "monthly_mismatch")).toBeDefined();
  });

  it("passes clean row", () => {
    // 125 × 36 = 4500 = cash → no monthly mismatch; cash equals existing → no delta; cash > cost
    const warnings = runValidations({ idx: 0, name: "x", cash: 4500, monthly: 125 }, product);
    expect(warnings).toHaveLength(0);
  });

  it("flags zero cash", () => {
    const warnings = runValidations({ idx: 0, name: "x", cash: 0, monthly: 0 }, product);
    expect(warnings.find((w) => w.code === "zero_price")).toBeDefined();
  });
});

describe("applyPriceToVariants", () => {
  it("updates all variants with same cash + monthly", () => {
    const variants = [
      { storage: "128GB", price: 1000, monthly_price: 30 },
      { storage: "256GB", price: 1200, monthly_price: 35 },
    ];
    const out = applyPriceToVariants(variants, 1500, 42);
    expect(out).toHaveLength(2);
    expect(out[0].price).toBe(1500);
    expect(out[1].price).toBe(1500);
    expect(out[0].monthly_price).toBe(42);
    expect(out[1].monthly_price).toBe(42);
  });

  it("preserves storage and other fields", () => {
    const variants = [{ storage: "128GB", price: 1000, monthly_price: 30, stock: 5, cost: 700 }];
    const out = applyPriceToVariants(variants, 1500, 42);
    expect(out[0].storage).toBe("128GB");
    expect(out[0].stock).toBe(5);
    expect(out[0].cost).toBe(700);
  });

  it("clears monthly_price when monthly is zero", () => {
    const variants = [{ storage: "128GB", price: 1000, monthly_price: 30 }];
    const out = applyPriceToVariants(variants, 1500, 0);
    expect(out[0].monthly_price).toBeUndefined();
  });

  it("returns empty for no variants", () => {
    expect(applyPriceToVariants([], 1000, 30)).toEqual([]);
  });

  // Per-variant targeting (regression for the iPhone 17 Pro Max bug where 4
  // Excel rows for the same product were broadcasting their prices across
  // every variant, leaving every storage pinned to whichever row was
  // processed last — usually the most expensive 2TB.)
  describe("with targetStorage", () => {
    const baseVariants = [
      { storage: "256GB", price: 1000, monthly_price: 30 },
      { storage: "512GB", price: 1500, monthly_price: 42 },
      { storage: "1TB",   price: 2000, monthly_price: 55 },
    ];

    it("updates only the matching variant", () => {
      const out = applyPriceToVariants(baseVariants, 1100, 31, "256GB");
      expect(out[0].price).toBe(1100);
      expect(out[0].monthly_price).toBe(31);
      // others untouched
      expect(out[1].price).toBe(1500);
      expect(out[1].monthly_price).toBe(42);
      expect(out[2].price).toBe(2000);
      expect(out[2].monthly_price).toBe(55);
    });

    it("matches storage case-insensitively (256gb vs 256GB)", () => {
      const out = applyPriceToVariants(baseVariants, 1100, 31, "256gb");
      expect(out[0].price).toBe(1100);
      expect(out[1].price).toBe(1500); // 512GB untouched
    });

    it("leaves all variants unchanged when targetStorage matches none", () => {
      const out = applyPriceToVariants(baseVariants, 9999, 99, "999GB");
      expect(out[0].price).toBe(1000);
      expect(out[1].price).toBe(1500);
      expect(out[2].price).toBe(2000);
    });

    it("preserves existing monthly_price on non-targeted variants", () => {
      const out = applyPriceToVariants(baseVariants, 1100, 0, "256GB");
      // targeted variant: monthly stays as old (since cash had monthly=0)
      expect(out[0].monthly_price).toBe(30);
      // non-targeted: untouched
      expect(out[1].monthly_price).toBe(42);
    });

    it("falls back to broadcast when targetStorage is null", () => {
      // Backward-compat: legacy callers (no per-variant info) still broadcast.
      const out = applyPriceToVariants(baseVariants, 9999, 99, null);
      expect(out[0].price).toBe(9999);
      expect(out[1].price).toBe(9999);
      expect(out[2].price).toBe(9999);
    });
  });
});
