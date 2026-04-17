import { describe, it, expect } from "vitest";
import { detectPaymentGateway, getGatewayDisplayInfo } from "@/lib/payment-gateway";

// ─────────────────────────────────────────────
// detectPaymentGateway
// ─────────────────────────────────────────────
describe("detectPaymentGateway", () => {
  // ── Israeli cities should use Rivhit ──
  it("returns 'rivhit' for Israeli city in Arabic (Haifa)", () => {
    expect(detectPaymentGateway("\u062D\u064A\u0641\u0627")).toBe("rivhit"); // حيفا
  });

  it("returns 'rivhit' for Israeli city in Hebrew (Haifa)", () => {
    expect(detectPaymentGateway("\u05D7\u05D9\u05E4\u05D4")).toBe("rivhit"); // חיפה
  });

  it("returns 'rivhit' for Nazareth in Arabic", () => {
    expect(detectPaymentGateway("\u0627\u0644\u0646\u0627\u0635\u0631\u0629")).toBe("rivhit"); // الناصرة
  });

  it("returns 'rivhit' for Nazareth in Hebrew", () => {
    expect(detectPaymentGateway("\u05E0\u05E6\u05E8\u05EA")).toBe("rivhit"); // נצרת
  });

  it("returns 'rivhit' for Um el-Fahm in Arabic", () => {
    expect(detectPaymentGateway("\u0623\u0645 \u0627\u0644\u0641\u062D\u0645")).toBe("rivhit"); // أم الفحم
  });

  it("returns 'rivhit' for Beer Sheva in Hebrew", () => {
    expect(detectPaymentGateway("\u05D1\u05D0\u05E8 \u05E9\u05D1\u05E2")).toBe("rivhit"); // באר שבע
  });

  // ── Palestinian cities should use UPay ──
  it("returns 'upay' for Ramallah in Arabic", () => {
    expect(detectPaymentGateway("\u0631\u0627\u0645 \u0627\u0644\u0644\u0647")).toBe("upay"); // رام الله
  });

  it("returns 'upay' for Ramallah in Hebrew", () => {
    expect(detectPaymentGateway("\u05E8\u05DE\u05D0\u05DC\u05DC\u05D4")).toBe("upay"); // רמאללה
  });

  it("returns 'upay' for Nablus in Arabic", () => {
    expect(detectPaymentGateway("\u0646\u0627\u0628\u0644\u0633")).toBe("upay"); // نابلس
  });

  it("returns 'upay' for Hebron in Arabic", () => {
    expect(detectPaymentGateway("\u0627\u0644\u062E\u0644\u064A\u0644")).toBe("upay"); // الخليل
  });

  it("returns 'upay' for Gaza in Arabic", () => {
    expect(detectPaymentGateway("\u063A\u0632\u0629")).toBe("upay"); // غزة
  });

  it("returns 'upay' for Bethlehem in Hebrew", () => {
    expect(detectPaymentGateway("\u05D1\u05D9\u05EA \u05DC\u05D7\u05DD")).toBe("upay"); // בית לחם
  });

  it("returns 'upay' for Jenin in Arabic", () => {
    expect(detectPaymentGateway("\u062C\u0646\u064A\u0646")).toBe("upay"); // جنين
  });

  // ── Fallback behavior ──
  it("returns 'upay' for empty string", () => {
    expect(detectPaymentGateway("")).toBe("upay");
  });

  it("returns 'upay' for unknown city", () => {
    expect(detectPaymentGateway("UnknownCityXYZ")).toBe("upay");
  });

  // ── Whitespace handling ──
  it("trims whitespace from city name", () => {
    expect(detectPaymentGateway("  \u062D\u064A\u0641\u0627  ")).toBe("rivhit"); // حيفا with spaces
  });
});

// ─────────────────────────────────────────────
// getGatewayDisplayInfo
// ─────────────────────────────────────────────
describe("getGatewayDisplayInfo", () => {
  describe("rivhit gateway", () => {
    const info = getGatewayDisplayInfo("rivhit");

    it("has name 'iCredit'", () => {
      expect(info.name).toBe("iCredit");
    });

    it("has a logo path", () => {
      expect(info.logo).toBe("/icons/icredit-logo.svg");
    });

    it("has PCI-DSS security text", () => {
      expect(info.securityText).toBe("PCI-DSS Level 1");
    });

    it("supports Visa", () => {
      expect(info.supports).toContain("Visa");
    });

    it("supports Mastercard", () => {
      expect(info.supports).toContain("Mastercard");
    });

    it("supports Isracard", () => {
      expect(info.supports).toContain("Isracard");
    });

    it("supports Bit", () => {
      expect(info.supports).toContain("Bit");
    });

    it("supports Apple Pay", () => {
      expect(info.supports).toContain("Apple Pay");
    });

    it("does not support PayPal", () => {
      expect(info.supports).not.toContain("PayPal");
    });
  });

  describe("upay gateway", () => {
    const info = getGatewayDisplayInfo("upay");

    it("has name 'UPay'", () => {
      expect(info.name).toBe("UPay");
    });

    it("has a logo path", () => {
      expect(info.logo).toBe("/icons/upay-logo.svg");
    });

    it("has SSL security text", () => {
      expect(info.securityText).toBe("SSL Secured");
    });

    it("supports Visa", () => {
      expect(info.supports).toContain("Visa");
    });

    it("supports Mastercard", () => {
      expect(info.supports).toContain("Mastercard");
    });

    it("supports PayPal", () => {
      expect(info.supports).toContain("PayPal");
    });

    it("supports Apple Pay", () => {
      expect(info.supports).toContain("Apple Pay");
    });

    it("supports Google Pay", () => {
      expect(info.supports).toContain("Google Pay");
    });

    it("does not support Isracard", () => {
      expect(info.supports).not.toContain("Isracard");
    });

    it("does not support Bit", () => {
      expect(info.supports).not.toContain("Bit");
    });
  });
});
