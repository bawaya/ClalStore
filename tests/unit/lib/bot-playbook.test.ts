import { describe, it, expect } from "vitest";
import {
  getNextQualificationQuestion,
  parseQualificationAnswer,
  calculateInstallments,
  formatProductCard,
  formatProductCards,
  BUDGET_RANGES,
  PRIORITY_OPTIONS,
  BRAND_OPTIONS,
  PAYMENT_OPTIONS,
  type QualificationState,
} from "@/lib/bot/playbook";
import { makeProduct } from "@/tests/helpers";

// ─── getNextQualificationQuestion ─────────────────────────────────

describe("getNextQualificationQuestion", () => {
  it("asks budget first when nothing is set", () => {
    const state: QualificationState = { step: 0 };
    const q = getNextQualificationQuestion(state, "ar");
    expect(q).not.toBeNull();
    expect(q!.field).toBe("budget");
    expect(q!.question).toContain("ميزانية");
    expect(q!.options).toHaveLength(BUDGET_RANGES.length);
  });

  it("asks priority second after budget is set", () => {
    const state: QualificationState = { step: 1, budget: "1500_3000" };
    const q = getNextQualificationQuestion(state, "ar");
    expect(q).not.toBeNull();
    expect(q!.field).toBe("priority");
    expect(q!.options).toHaveLength(PRIORITY_OPTIONS.length);
  });

  it("asks brand third after budget and priority are set", () => {
    const state: QualificationState = { step: 2, budget: "1500_3000", priority: "camera" };
    const q = getNextQualificationQuestion(state, "ar");
    expect(q).not.toBeNull();
    expect(q!.field).toBe("brand");
    expect(q!.options).toHaveLength(BRAND_OPTIONS.length);
  });

  it("asks payment fourth after budget, priority, and brand are set", () => {
    const state: QualificationState = { step: 3, budget: "1500_3000", priority: "camera", brand: "Apple" };
    const q = getNextQualificationQuestion(state, "ar");
    expect(q).not.toBeNull();
    expect(q!.field).toBe("payment");
    expect(q!.options).toHaveLength(PAYMENT_OPTIONS.length);
  });

  it("returns null when all fields are set", () => {
    const state: QualificationState = {
      step: 4,
      budget: "1500_3000",
      priority: "camera",
      brand: "Apple",
      payment: "single",
    };
    const q = getNextQualificationQuestion(state, "ar");
    expect(q).toBeNull();
  });

  it("uses Hebrew labels when lang is he", () => {
    const state: QualificationState = { step: 0 };
    const q = getNextQualificationQuestion(state, "he");
    expect(q).not.toBeNull();
    expect(q!.question).toContain("תקציב");
  });

  it("uses Arabic labels for English (fallback to Arabic)", () => {
    const state: QualificationState = { step: 0 };
    const q = getNextQualificationQuestion(state, "en");
    expect(q).not.toBeNull();
    expect(q!.question).toContain("ميزانية");
  });
});

// ─── parseQualificationAnswer ─────────────────────────────────────

describe("parseQualificationAnswer", () => {
  describe("budget parsing", () => {
    it("matches budget key directly", () => {
      expect(parseQualificationAnswer("budget", "under_1500")).toBe("under_1500");
    });

    it("matches Arabic budget label", () => {
      expect(parseQualificationAnswer("budget", "حتى 1,500₪")).toBe("under_1500");
    });

    it("parses numeric input into matching range", () => {
      expect(parseQualificationAnswer("budget", "2000")).toBe("1500_3000");
    });

    it("defaults to mid-range for ambiguous input", () => {
      expect(parseQualificationAnswer("budget", "something random")).toBe("1500_3000");
    });

    it("detects cheap/low keyword as under_1500", () => {
      expect(parseQualificationAnswer("budget", "رخيص")).toBe("under_1500");
    });

    it("detects expensive keyword as above_5000", () => {
      expect(parseQualificationAnswer("budget", "غالي")).toBe("above_5000");
    });
  });

  describe("priority parsing", () => {
    it("detects camera priority", () => {
      expect(parseQualificationAnswer("priority", "كاميرا")).toBe("camera");
    });

    it("detects battery priority", () => {
      expect(parseQualificationAnswer("priority", "بطارية")).toBe("battery");
    });

    it("detects performance priority", () => {
      expect(parseQualificationAnswer("priority", "أداء")).toBe("performance");
    });

    it("detects budget priority", () => {
      expect(parseQualificationAnswer("priority", "سعر اقتصادي")).toBe("budget");
    });

    it("returns null for unrecognized priority", () => {
      expect(parseQualificationAnswer("priority", "something else")).toBeNull();
    });

    it("strips emojis before matching", () => {
      expect(parseQualificationAnswer("priority", "📷 كاميرا")).toBe("camera");
    });
  });

  describe("brand parsing", () => {
    it("detects Apple brand", () => {
      expect(parseQualificationAnswer("brand", "Apple")).toBe("Apple");
      expect(parseQualificationAnswer("brand", "ايفون")).toBe("Apple");
    });

    it("detects Samsung brand", () => {
      expect(parseQualificationAnswer("brand", "Samsung")).toBe("Samsung");
      expect(parseQualificationAnswer("brand", "سامسونج")).toBe("Samsung");
    });

    it("detects Xiaomi brand", () => {
      expect(parseQualificationAnswer("brand", "Xiaomi")).toBe("Xiaomi");
      expect(parseQualificationAnswer("brand", "شاومي")).toBe("Xiaomi");
    });

    it("defaults to any for unknown brand", () => {
      expect(parseQualificationAnswer("brand", "other")).toBe("any");
    });
  });

  describe("payment parsing", () => {
    it("detects installments", () => {
      expect(parseQualificationAnswer("payment", "تقسيط")).toBe("installments");
      expect(parseQualificationAnswer("payment", "دفعات")).toBe("installments");
    });

    it("defaults to single for unknown", () => {
      expect(parseQualificationAnswer("payment", "anything")).toBe("single");
    });
  });

  describe("unknown field", () => {
    it("returns cleaned input for unknown fields", () => {
      expect(parseQualificationAnswer("unknown_field", "some value")).toBe("some value");
    });
  });
});

// ─── calculateInstallments ────────────────────────────────────────

describe("calculateInstallments", () => {
  it("calculates installments for standard price", () => {
    const result = calculateInstallments(3600);
    expect(result.m3).toBe(1200);
    expect(result.m6).toBe(600);
    expect(result.m12).toBe(300);
    expect(result.m18).toBe(200);
  });

  it("rounds up to nearest integer", () => {
    const result = calculateInstallments(1000);
    expect(result.m3).toBe(334); // ceil(1000/3)
    expect(result.m6).toBe(167); // ceil(1000/6)
    expect(result.m12).toBe(84); // ceil(1000/12)
    expect(result.m18).toBe(56); // ceil(1000/18)
  });

  it("handles small prices", () => {
    const result = calculateInstallments(100);
    expect(result.m3).toBe(34);
    expect(result.m18).toBe(6);
  });

  it("handles zero price", () => {
    const result = calculateInstallments(0);
    expect(result.m3).toBe(0);
    expect(result.m6).toBe(0);
    expect(result.m12).toBe(0);
    expect(result.m18).toBe(0);
  });
});

// ─── formatProductCard ────────────────────────────────────────────

describe("formatProductCard", () => {
  it("formats a product card with price and installments", () => {
    const product = makeProduct({ id: "prod-1", name_ar: "آيفون 16", price: 3600 });
    const card = formatProductCard(product, 0, "https://clalmobile.com");
    expect(card).toContain("آيفون 16");
    expect(card).toContain("3,600");
    expect(card).toContain("200"); // 3600/18 = 200
    expect(card).toContain("https://clalmobile.com/store/product/prod-1");
  });

  it("includes featured badge for featured products", () => {
    const product = makeProduct({ featured: true, name_ar: "آيفون 16 برو" });
    const card = formatProductCard(product, 0, "https://clalmobile.com");
    expect(card).toContain("⭐");
  });

  it("uses correct index numbering", () => {
    const product = makeProduct({ name_ar: "Galaxy S25" });
    const card = formatProductCard(product, 2, "https://clalmobile.com");
    expect(card).toContain("3️⃣");
  });
});

// ─── formatProductCards ───────────────────────────────────────────

describe("formatProductCards", () => {
  it("formats multiple products", () => {
    const products = [
      makeProduct({ id: "p1", name_ar: "آيفون 16", price: 3600 }),
      makeProduct({ id: "p2", name_ar: "Galaxy S25", price: 3200 }),
    ];
    const result = formatProductCards(products, "https://clalmobile.com");
    expect(result).toContain("آيفون 16");
    expect(result).toContain("Galaxy S25");
    expect(result).toContain("p1");
    expect(result).toContain("p2");
  });

  it("returns empty string for empty array", () => {
    expect(formatProductCards([], "https://clalmobile.com")).toBe("");
  });
});
