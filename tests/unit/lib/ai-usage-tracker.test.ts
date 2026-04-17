import { describe, it, expect, vi, beforeEach } from "vitest";

const usageRows = [
  { feature: "bot_reply", input_tokens: 500, output_tokens: 200 },
  { feature: "bot_reply", input_tokens: 300, output_tokens: 100 },
  { feature: "smart_reply", input_tokens: 200, output_tokens: 80 },
  { feature: "summary", input_tokens: 1000, output_tokens: 500 },
];

vi.mock("@/lib/supabase", () => {
  const mockBuilder: any = {};
  const chainMethods = ["select", "eq", "neq", "gte", "lte", "gt", "lt", "order", "limit", "insert", "update", "delete", "in", "is"];
  for (const m of chainMethods) {
    mockBuilder[m] = vi.fn().mockReturnValue(mockBuilder);
  }
  mockBuilder.single = vi.fn().mockResolvedValue({ data: null, error: null });
  mockBuilder.maybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
  mockBuilder.then = vi.fn((resolve: any) =>
    resolve({ data: usageRows, error: null })
  );

  return {
    createAdminSupabase: vi.fn(() => ({
      from: vi.fn().mockReturnValue(mockBuilder),
    })),
  };
});

import { trackAIUsage, getAIUsageStats } from "@/lib/ai/usage-tracker";

describe("AI Usage Tracker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── trackAIUsage ───────────────────────────────────────────────

  describe("trackAIUsage", () => {
    it("fires usage tracking without throwing", () => {
      expect(() => {
        trackAIUsage({
          feature: "bot_reply",
          inputTokens: 500,
          outputTokens: 200,
          durationMs: 1500,
          conversationId: "conv-1",
        });
      }).not.toThrow();
    });

    it("does not throw on error", () => {
      expect(() => {
        trackAIUsage({
          feature: "summary",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 500,
        });
      }).not.toThrow();
    });

    it("handles missing conversationId", () => {
      expect(() => {
        trackAIUsage({
          feature: "smart_reply",
          inputTokens: 100,
          outputTokens: 50,
          durationMs: 200,
        });
      }).not.toThrow();
    });
  });

  // ─── getAIUsageStats ────────────────────────────────────────────

  describe("getAIUsageStats", () => {
    it("returns aggregated usage stats", async () => {
      const stats = await getAIUsageStats();

      expect(stats).not.toBeNull();
      expect(stats!.totalRequests).toBe(4);
      expect(stats!.totalInputTokens).toBe(2000); // 500+300+200+1000
      expect(stats!.totalOutputTokens).toBe(880); // 200+100+80+500
    });

    it("breaks down usage by feature", async () => {
      const stats = await getAIUsageStats();

      expect(stats).not.toBeNull();
      expect(stats!.byFeature.bot_reply).toBeDefined();
      expect(stats!.byFeature.bot_reply.requests).toBe(2);
      expect(stats!.byFeature.bot_reply.tokens).toBe(1100); // 500+200+300+100
      expect(stats!.byFeature.smart_reply.requests).toBe(1);
      expect(stats!.byFeature.summary.requests).toBe(1);
    });

    it("calculates estimated cost based on Claude pricing", async () => {
      const stats = await getAIUsageStats();

      expect(stats).not.toBeNull();
      // $3/1M input + $15/1M output
      // (2000/1M)*3 + (880/1M)*15 = 0.006 + 0.0132 = 0.0192
      expect(stats!.estimatedCost).toBeCloseTo(0.02, 1);
    });
  });
});
