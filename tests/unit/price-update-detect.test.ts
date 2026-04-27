import { describe, it, expect, vi } from "vitest";

// AI helpers reach into integrations/secrets via Supabase. We never want the
// real network calls during unit tests — every detection here resolves through
// the cheap heuristics or the data-shape fallback.
vi.mock("@/lib/integrations/secrets", () => ({
  getIntegrationByTypeWithSecrets: vi.fn(async () => ({ integration: null, config: {} })),
}));
vi.mock("@/lib/ai/claude", () => ({ callClaude: vi.fn(async () => null) }));
vi.mock("@/lib/ai/gemini", () => ({ callGemini: vi.fn(async () => null) }));

import { detectColumns } from "@/lib/admin/price-update-ai";

describe("detectColumns — header heuristics", () => {
  it("recognises the Hebrew accessory list (תאור פריט / קטגוריה / מחיר מקור)", async () => {
    const preview = [
      ["תאור פריט", "קטגוריה", "מחיר מקור"],
      ["Krups EA815070 מכונת קפה אוטומטית", "מכונת קפה", 2090],
      ["סט 6 סכינים NINJA K32006", "סט סכינים", 649],
    ];
    const out = await detectColumns(preview);
    // Two-column flow: name + cash, monthly stays -1 to flag text mode.
    expect(out).toEqual({ name: 0, cash: 2, monthly: -1 });
  });

  it("recognises an Arabic 3-column phone sheet (اسم / كاش / قسط)", async () => {
    const preview = [
      ["اسم المنتج", "السعر الكاش", "القسط الشهري"],
      ["iPhone 15 Pro", 4200, 117],
      ["Samsung Galaxy S24", 3600, 100],
    ];
    const out = await detectColumns(preview);
    expect(out).toEqual({ name: 0, cash: 1, monthly: 2 });
  });

  it("regression: phone-mode 3-column sheet still resolves to auto monthly", async () => {
    // The old phone import contract was name + cash + monthly with monthly >= 0.
    // This test pins down that detection on a real-world Hebrew phone sheet
    // (name + מחיר + תשלום) keeps returning a positive monthly index, so the
    // panel stays in "auto" installment_display mode and the storefront keeps
    // showing ₪{monthly} × 36 like before.
    const preview = [
      ["שם המוצר", "מחיר", "תשלום חודשי"],
      ["iPhone 15 Pro Max", 5400, 150],
      ["Galaxy S24 Ultra", 4500, 125],
      ["Pixel 9 Pro", 3800, 106],
    ];
    const out = await detectColumns(preview);
    expect(out?.name).toBe(0);
    expect(out?.cash).toBe(1);
    // The critical assertion: monthly is detected (>=0), NOT -1.
    expect(out?.monthly).toBe(2);
  });

  it("recognises an English 2-column sheet (Product / Price)", async () => {
    const preview = [
      ["Product", "Price"],
      ["JBL Flip 6", 480],
      ["Bose QC45", 1200],
    ];
    const out = await detectColumns(preview);
    expect(out).toEqual({ name: 0, cash: 1, monthly: -1 });
  });
});

describe("detectColumns — data-shape fallback", () => {
  it("infers columns when headers are unrecognised gibberish", async () => {
    const preview = [
      ["xxx", "yyy", "zzz"],
      ["Microwave Sharp 28L", "appliance-stuff", 899],
      ["Vacuum Roborock S8", "appliance-stuff", 2199],
      ["Headphones Sony XM5", "audio", 1399],
    ];
    const out = await detectColumns(preview);
    expect(out).not.toBeNull();
    expect(out?.name).toBe(0);
    expect(out?.cash).toBe(2);
    // Column 1 is text "appliance-stuff" so monthly should remain -1.
    expect(out?.monthly).toBe(-1);
  });

  it("identifies the larger numeric column as cash and the smaller as monthly", async () => {
    const preview = [
      ["item", "p1", "p2"],
      ["a", 3600, 100],
      ["b", 4200, 117],
      ["c", 5000, 139],
    ];
    const out = await detectColumns(preview);
    // p1 averages ~4267, p2 averages ~119 → ratio ~0.028 → monthly.
    expect(out?.name).toBe(0);
    expect(out?.cash).toBe(1);
    expect(out?.monthly).toBe(2);
  });

  it("returns null when there is no plausible name column", async () => {
    const preview = [
      ["a", "b"],
      [123, 456],
      [789, 1011],
    ];
    const out = await detectColumns(preview);
    expect(out).toBeNull();
  });
});
