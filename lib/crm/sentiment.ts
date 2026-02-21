// =====================================================
// ClalMobile — Sentiment Analysis (Rule-based + AI)
// Fast rule-based for real-time, AI for deep analysis
// =====================================================

export type Sentiment = "positive" | "neutral" | "negative" | "angry";

export interface SentimentResult {
  sentiment: Sentiment;
  confidence: number;
  keywords: string[];
}

// ===== Sentiment config for UI =====
export const SENTIMENT_CONFIG: Record<
  Sentiment,
  { emoji: string; label: string; color: string; dotColor: string }
> = {
  positive: { emoji: "😊", label: "إيجابي", color: "text-green-400", dotColor: "bg-green-500" },
  neutral: { emoji: "😐", label: "محايد", color: "text-gray-400", dotColor: "bg-gray-500" },
  negative: { emoji: "😟", label: "سلبي", color: "text-yellow-400", dotColor: "bg-yellow-500" },
  angry: { emoji: "😡", label: "غاضب", color: "text-red-400", dotColor: "bg-red-500" },
};

// Keyword dictionaries
const POSITIVE_WORDS = [
  "شكرا", "شكراً", "ممتاز", "حلو", "يسلمو", "تمام", "مشكور", "رائع", "جميل", "ممنون",
  "أحسنت", "عظيم", "يعطيك العافية", "ماشاء الله", "الله يبارك", "نايس", "حبيبي",
  "مبسوط", "سعيد", "فرحان", "أفضل", "perfect", "great", "thanks", "love",
  "תודה", "מעולה", "אחלה", "יופי", "מצוין", "נהדר",
  "👍", "❤️", "😊", "🙏", "💯", "👏", "😍", "🎉", "✅",
];

const NEGATIVE_WORDS = [
  "مشكلة", "خرب", "سيء", "ما يشتغل", "زعلان", "رديء", "خايب", "مكسور",
  "تعطل", "عطل", "ما وصل", "ما أشتغل", "متأخر", "بطيء", "مغشوش",
  "خلل", "ضعيف", "مو كويس", "ما عجبني", "مو راضي", "disappointed",
  "bad", "problem", "broken", "slow", "late",
  "בעיה", "שבור", "גרוע", "איטי", "מאוחר",
  "😞", "😢", "👎", "💔", "😕",
];

const ANGRY_WORDS = [
  "حرامي", "نصاب", "احتيال", "غش", "والله لأشتكي", "سرقة", "كذاب",
  "حسبي الله", "أسوأ", "أبشع", "تهديد", "محامي", "شرطة", "بلاغ",
  "وقاحة", "قلة أدب", "لا أحترام", "حقير", "وقح", "أتف",
  "scam", "fraud", "steal", "sue", "worst",
  "גנב", "רמאי", "הגרוע ביותר",
  "😡", "🤬", "💢",
];

// ===== Rule-based (instant, no API) =====
export function analyzeSentiment(text: string): SentimentResult {
  if (!text) return { sentiment: "neutral", confidence: 0.5, keywords: [] };

  const lower = text.toLowerCase();
  const foundKeywords: string[] = [];
  let positiveScore = 0;
  let negativeScore = 0;
  let angryScore = 0;

  // Check exclamation marks (anger signal)
  const exclamations = (text.match(/!/g) || []).length;
  if (exclamations >= 3) angryScore += 2;

  // Check caps rage (English)
  if (/[A-Z]{5,}/.test(text)) angryScore += 1;

  for (const word of ANGRY_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      angryScore += 3;
      foundKeywords.push(word);
    }
  }

  for (const word of NEGATIVE_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      negativeScore += 2;
      foundKeywords.push(word);
    }
  }

  for (const word of POSITIVE_WORDS) {
    if (lower.includes(word.toLowerCase())) {
      positiveScore += 2;
      foundKeywords.push(word);
    }
  }

  // Determine sentiment
  if (angryScore >= 3) {
    return { sentiment: "angry", confidence: Math.min(0.95, 0.6 + angryScore * 0.05), keywords: foundKeywords };
  }
  if (negativeScore > positiveScore && negativeScore >= 2) {
    return { sentiment: "negative", confidence: Math.min(0.9, 0.5 + negativeScore * 0.05), keywords: foundKeywords };
  }
  if (positiveScore > negativeScore && positiveScore >= 2) {
    return { sentiment: "positive", confidence: Math.min(0.9, 0.5 + positiveScore * 0.05), keywords: foundKeywords };
  }

  return { sentiment: "neutral", confidence: 0.5, keywords: foundKeywords };
}

/** Analyze sentiment from last N messages (customer only) */
export function analyzeSentimentFromMessages(
  messages: { direction: string; content: string | null }[]
): SentimentResult {
  // Get last 3 customer messages
  const customerMessages = messages
    .filter((m) => m.direction === "inbound" && m.content)
    .slice(-3);

  if (customerMessages.length === 0) {
    return { sentiment: "neutral", confidence: 0.5, keywords: [] };
  }

  const combinedText = customerMessages.map((m) => m.content!).join(" ");
  return analyzeSentiment(combinedText);
}
