// =====================================================
// ClalMobile — Conversation Filters (Tabs + Sort + Sentiment)
// =====================================================

"use client";

import type { Sentiment } from "@/lib/crm/sentiment";
import { SENTIMENT_CONFIG } from "@/lib/crm/sentiment";

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  sentimentFilter?: Sentiment | "all";
  onSentimentChange?: (s: Sentiment | "all") => void;
}

const TABS: { key: string; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "active", label: "نشطة" },
  { key: "waiting", label: "بانتظار" },
  { key: "bot", label: "بوت" },
  { key: "resolved", label: "محلولة" },
];

const SENTIMENT_FILTERS: { key: Sentiment | "all"; label: string; emoji: string }[] = [
  { key: "all", label: "الكل", emoji: "" },
  { key: "angry", label: "غاضبين", emoji: "😡" },
  { key: "negative", label: "سلبي", emoji: "😟" },
  { key: "positive", label: "إيجابي", emoji: "😊" },
];

export function ConversationFilters({
  activeTab,
  onTabChange,
  searchQuery,
  onSearchChange,
  sentimentFilter = "all",
  onSentimentChange,
}: Props) {
  return (
    <div className="border-b border-surface-border">
      {/* Search */}
      <div className="px-3 py-2">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="🔍 بحث بالاسم أو الهاتف..."
          className="w-full bg-surface-elevated text-white text-sm px-3 py-2 rounded-lg border border-surface-border focus:border-brand focus:outline-none placeholder:text-muted"
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 px-2 overflow-x-auto no-scrollbar">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => onTabChange(tab.key)}
            className="px-3 py-1.5 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap"
            style={{
              background: activeTab === tab.key ? "rgba(196,16,64,0.15)" : "transparent",
              color: activeTab === tab.key ? "#c41040" : "#71717a",
              borderBottom: activeTab === tab.key ? "2px solid #c41040" : "2px solid transparent",
            }}
          >
            {tab.label}
          </button>
        ))}
        {/* Sentiment filter divider */}
        <span className="w-px bg-surface-border mx-1 self-stretch" />
        {SENTIMENT_FILTERS.map((sf) => (
          <button
            key={sf.key}
            onClick={() => onSentimentChange?.(sf.key)}
            className="px-2 py-1.5 text-xs font-medium rounded-t-lg transition-colors whitespace-nowrap"
            style={{
              background: sentimentFilter === sf.key ? "rgba(196,16,64,0.15)" : "transparent",
              color: sentimentFilter === sf.key ? "#c41040" : "#71717a",
              borderBottom: sentimentFilter === sf.key ? "2px solid #c41040" : "2px solid transparent",
            }}
          >
            {sf.emoji && <span className="mr-0.5">{sf.emoji}</span>}
            {sf.label}
          </button>
        ))}
      </div>
    </div>
  );
}
