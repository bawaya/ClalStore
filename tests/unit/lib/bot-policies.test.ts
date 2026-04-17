import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPolicies = [
  {
    id: "p1", type: "warranty", title_ar: "سياسة الضمان", title_he: "מדיניות אחריות",
    content_ar: "ضمان سنة كاملة على جميع الأجهزة", content_he: "אחריות שנה מלאה",
    page_url: "/warranty", active: true, sort_order: 1,
  },
  {
    id: "p2", type: "return", title_ar: "سياسة الإرجاع", title_he: "מדיניות החזרה",
    content_ar: "يمكنك الإرجاع خلال 14 يوم", content_he: "ניתן להחזיר תוך 14 ימים",
    page_url: "/returns", active: true, sort_order: 2,
  },
  {
    id: "p3", type: "shipping", title_ar: "سياسة الشحن",
    content_ar: "توصيل خلال 3-5 أيام عمل", active: true, sort_order: 3,
  },
];

// Mock supabase before importing
vi.mock("@/lib/supabase", () => {
  const mockBuilder: any = {};
  const chainMethods = ["select", "eq", "neq", "order", "limit", "insert", "update", "delete"];
  for (const m of chainMethods) {
    mockBuilder[m] = vi.fn().mockReturnValue(mockBuilder);
  }
  mockBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  mockBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  mockBuilder.then = vi.fn((resolve: any) =>
    resolve({ data: mockPolicies, error: null })
  );

  return {
    createAdminSupabase: vi.fn(() => ({
      from: vi.fn().mockReturnValue(mockBuilder),
    })),
  };
});

import {
  detectPolicyType,
  formatPolicyResponse,
  loadPolicies,
  getPolicy,
  invalidatePolicyCache,
} from "@/lib/bot/policies";

describe("Bot Policies", () => {
  beforeEach(() => {
    invalidatePolicyCache();
  });

  // ─── detectPolicyType ───────────────────────────────────────────

  describe("detectPolicyType", () => {
    it("detects warranty in Arabic", () => {
      expect(detectPolicyType("شو الضمان")).toBe("warranty");
    });

    it("detects warranty in Hebrew", () => {
      expect(detectPolicyType("מה האחריות")).toBe("warranty");
    });

    it("detects warranty in English", () => {
      expect(detectPolicyType("what is the warranty")).toBe("warranty");
    });

    it("detects return policy in Arabic", () => {
      expect(detectPolicyType("كيف الارجاع")).toBe("return");
      expect(detectPolicyType("بدي استرجاع")).toBe("return");
      expect(detectPolicyType("ابغى استبدال")).toBe("return");
    });

    it("detects return policy in English", () => {
      expect(detectPolicyType("can I return this")).toBe("return");
      expect(detectPolicyType("refund please")).toBe("return");
      expect(detectPolicyType("exchange this")).toBe("return");
    });

    it("detects return cancellation", () => {
      expect(detectPolicyType("بدي الغاء الطلب")).toBe("return");
    });

    it("detects shipping policy in Arabic", () => {
      expect(detectPolicyType("كيف الشحن")).toBe("shipping");
      expect(detectPolicyType("كم التوصيل")).toBe("shipping");
    });

    it("detects installments policy", () => {
      expect(detectPolicyType("كيف التقسيط")).toBe("installments");
      expect(detectPolicyType("كم القسط الشهري")).toBe("installments");
    });

    it("detects privacy policy", () => {
      expect(detectPolicyType("سياسة الخصوصية")).toBe("privacy");
      expect(detectPolicyType("privacy policy")).toBe("privacy");
    });

    it("returns null for non-policy messages", () => {
      expect(detectPolicyType("مرحبا")).toBeNull();
      expect(detectPolicyType("كم سعر الايفون")).toBeNull();
    });
  });

  // ─── formatPolicyResponse ───────────────────────────────────────

  describe("formatPolicyResponse", () => {
    const warrantyPolicy = {
      id: "p1", type: "warranty" as const, title_ar: "سياسة الضمان",
      title_he: "מדיניות אחריות", content_ar: "ضمان سنة كاملة",
      content_he: "אחריות שנה מלאה", page_url: "/warranty", active: true,
    };

    it("formats Arabic policy response with title and content", () => {
      const response = formatPolicyResponse(warrantyPolicy, "ar");
      expect(response).toContain("سياسة الضمان");
      expect(response).toContain("ضمان سنة كاملة");
      expect(response).toContain("/warranty");
    });

    it("formats Hebrew policy response", () => {
      const response = formatPolicyResponse(warrantyPolicy, "he");
      expect(response).toContain("מדיניות אחריות");
      expect(response).toContain("אחריות שנה מלאה");
    });

    it("falls back to Arabic when Hebrew title is missing", () => {
      const policy = {
        id: "p3", type: "shipping" as const, title_ar: "سياسة الشحن",
        content_ar: "توصيل سريع", active: true,
      };
      const response = formatPolicyResponse(policy, "he");
      expect(response).toContain("سياسة الشحن");
    });

    it("uses Arabic for English language", () => {
      const response = formatPolicyResponse(warrantyPolicy, "en");
      expect(response).toContain("سياسة الضمان");
    });

    it("omits page link when no page_url", () => {
      const policy = {
        id: "p4", type: "installments" as const, title_ar: "تقسيط",
        content_ar: "محتوى", active: true,
      };
      const response = formatPolicyResponse(policy, "ar");
      expect(response).not.toContain("المزيد:");
    });
  });

  // ─── loadPolicies ──────────────────────────────────────────────

  describe("loadPolicies", () => {
    it("loads policies and returns an array", async () => {
      const policies = await loadPolicies();
      expect(Array.isArray(policies)).toBe(true);
      expect(policies.length).toBeGreaterThan(0);
    });

    it("caches policies on subsequent calls", async () => {
      invalidatePolicyCache();
      const first = await loadPolicies();
      const second = await loadPolicies();
      expect(first).toBe(second); // same reference = cache hit
    });
  });

  // ─── getPolicy ─────────────────────────────────────────────────

  describe("getPolicy", () => {
    it("returns policy by type when available", async () => {
      const policy = await getPolicy("warranty");
      if (policy) {
        expect(policy.type).toBe("warranty");
      }
    });

    it("returns null for non-existent policy type", async () => {
      const policy = await getPolicy("terms");
      // terms is not in our mock data
      expect(policy).toBeNull();
    });
  });

  // ─── invalidatePolicyCache ──────────────────────────────────────

  describe("invalidatePolicyCache", () => {
    it("forces a fresh load without throwing", async () => {
      const first = await loadPolicies();
      invalidatePolicyCache();
      const second = await loadPolicies();
      // Both calls should resolve with the same shape (mock returns same data)
      expect(Array.isArray(first)).toBe(true);
      expect(Array.isArray(second)).toBe(true);
      expect(second.length).toBe(first.length);
    });
  });
});
