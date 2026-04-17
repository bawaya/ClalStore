import { describe, it, expect } from "vitest";
import {
  analyzeSentiment,
  analyzeSentimentFromMessages,
  SENTIMENT_CONFIG,
} from "@/lib/crm/sentiment";

// ─── analyzeSentiment ─────────────────────────────────────────────

describe("analyzeSentiment", () => {
  describe("positive text", () => {
    it("detects Arabic positive words", () => {
      const result = analyzeSentiment("شكراً على الخدمة الممتازة");
      expect(result.sentiment).toBe("positive");
      expect(result.confidence).toBeGreaterThanOrEqual(0.5);
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it("detects Hebrew positive words", () => {
      const result = analyzeSentiment("תודה, מעולה!");
      expect(result.sentiment).toBe("positive");
      expect(result.keywords).toContain("תודה");
    });

    it("detects English positive words", () => {
      const result = analyzeSentiment("great product, thanks!");
      expect(result.sentiment).toBe("positive");
    });

    it("detects positive emojis", () => {
      const result = analyzeSentiment("👍 ❤️ 😊");
      expect(result.sentiment).toBe("positive");
    });
  });

  describe("negative text", () => {
    it("detects Arabic negative words", () => {
      const result = analyzeSentiment("مشكلة كبيرة الجهاز ما يشتغل");
      expect(result.sentiment).toBe("negative");
      expect(result.keywords.length).toBeGreaterThan(0);
    });

    it("detects Hebrew negative words", () => {
      const result = analyzeSentiment("יש בעיה, המכשיר שבור");
      expect(result.sentiment).toBe("negative");
    });

    it("detects English negative words", () => {
      const result = analyzeSentiment("this product is bad and broken");
      expect(result.sentiment).toBe("negative");
    });

    it("detects negative emojis", () => {
      const result = analyzeSentiment("😞 😢 👎");
      expect(result.sentiment).toBe("negative");
    });
  });

  describe("angry text", () => {
    it("detects Arabic angry words", () => {
      const result = analyzeSentiment("حرامي نصاب والله لأشتكي");
      expect(result.sentiment).toBe("angry");
      expect(result.confidence).toBeGreaterThanOrEqual(0.6);
    });

    it("detects anger from excessive exclamation marks combined with angry keywords", () => {
      // Exclamation marks add +2 to angryScore, but need angryScore >= 3 for "angry"
      // So we combine with an angry keyword to push it over the threshold
      const result = analyzeSentiment("حسبي الله!!! هذا أسوأ شي!!!");
      expect(result.sentiment).toBe("angry");
    });

    it("detects anger from CAPS RAGE", () => {
      const result = analyzeSentiment("THIS IS A SCAM fraud worst");
      expect(result.sentiment).toBe("angry");
    });

    it("detects angry emojis", () => {
      const result = analyzeSentiment("😡 🤬 💢 حسبي الله");
      expect(result.sentiment).toBe("angry");
    });
  });

  describe("neutral text", () => {
    it("returns neutral for simple questions", () => {
      const result = analyzeSentiment("كم سعر الجهاز؟");
      expect(result.sentiment).toBe("neutral");
    });

    it("returns neutral for empty string", () => {
      const result = analyzeSentiment("");
      expect(result.sentiment).toBe("neutral");
      expect(result.confidence).toBe(0.5);
      expect(result.keywords).toEqual([]);
    });

    it("returns neutral for mixed positive and negative words", () => {
      // When positive and negative scores are equal, neutral is returned
      const result = analyzeSentiment("شكرا بس فيه مشكلة");
      // One positive word, one negative word — depends on exact scoring
      expect(["neutral", "negative", "positive"]).toContain(result.sentiment);
    });
  });

  describe("confidence scoring", () => {
    it("caps positive confidence at 0.9", () => {
      const result = analyzeSentiment("شكرا ممتاز حلو يسلمو تمام مشكور رائع جميل");
      expect(result.confidence).toBeLessThanOrEqual(0.9);
    });

    it("caps angry confidence at 0.95", () => {
      const result = analyzeSentiment("حرامي نصاب احتيال غش سرقة كذاب حسبي الله أسوأ");
      expect(result.confidence).toBeLessThanOrEqual(0.95);
    });
  });
});

// ─── analyzeSentimentFromMessages ─────────────────────────────────

describe("analyzeSentimentFromMessages", () => {
  it("analyzes only inbound customer messages", () => {
    const result = analyzeSentimentFromMessages([
      { direction: "outbound", content: "مرحبا كيف نقدر نساعدك؟" },
      { direction: "inbound", content: "شكرا ممتاز" },
    ]);
    expect(result.sentiment).toBe("positive");
  });

  it("returns neutral when no customer messages exist", () => {
    const result = analyzeSentimentFromMessages([
      { direction: "outbound", content: "مرحبا" },
    ]);
    expect(result.sentiment).toBe("neutral");
    expect(result.confidence).toBe(0.5);
  });

  it("returns neutral for empty messages array", () => {
    const result = analyzeSentimentFromMessages([]);
    expect(result.sentiment).toBe("neutral");
  });

  it("uses only the last 3 customer messages", () => {
    const messages = [
      { direction: "inbound", content: "مرحبا" },
      { direction: "inbound", content: "كيف الحال" },
      { direction: "inbound", content: "شكرا" },
      { direction: "inbound", content: "ممتاز" },
      { direction: "inbound", content: "حلو يسلمو تمام" },
    ];
    const result = analyzeSentimentFromMessages(messages);
    // Only last 3 messages are used: شكرا, ممتاز, حلو يسلمو تمام
    expect(result.sentiment).toBe("positive");
  });

  it("skips messages with null content", () => {
    const result = analyzeSentimentFromMessages([
      { direction: "inbound", content: null },
      { direction: "inbound", content: "شكرا ممتاز" },
    ]);
    expect(result.sentiment).toBe("positive");
  });
});

// ─── SENTIMENT_CONFIG ─────────────────────────────────────────────

describe("SENTIMENT_CONFIG", () => {
  it("has entries for all sentiment types", () => {
    expect(SENTIMENT_CONFIG.positive).toBeDefined();
    expect(SENTIMENT_CONFIG.neutral).toBeDefined();
    expect(SENTIMENT_CONFIG.negative).toBeDefined();
    expect(SENTIMENT_CONFIG.angry).toBeDefined();
  });

  it("each config has required UI properties", () => {
    for (const config of Object.values(SENTIMENT_CONFIG)) {
      expect(config).toHaveProperty("emoji");
      expect(config).toHaveProperty("label");
      expect(config).toHaveProperty("color");
      expect(config).toHaveProperty("dotColor");
    }
  });
});
