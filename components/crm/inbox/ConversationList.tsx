// =====================================================
// ClalMobile — Conversation List (Left Panel)
// =====================================================

"use client";

import { useState, useMemo } from "react";
import { useDebounce } from "@/lib/hooks";
import { useInboxConversations } from "@/lib/crm/inbox";
import type { InboxConversation } from "@/lib/crm/inbox-types";
import type { Sentiment } from "@/lib/crm/sentiment";
import { analyzeSentiment } from "@/lib/crm/sentiment";
import { InboxStatsBar } from "./InboxStats";
import { ConversationFilters } from "./ConversationFilters";
import { ConversationItem } from "./ConversationItem";

interface Props {
  selectedId: string | null;
  onSelect: (conv: InboxConversation) => void;
}

export function ConversationList({ selectedId, onSelect }: Props) {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [sentimentFilter, setSentimentFilter] = useState<Sentiment | "all">("all");
  const debouncedSearch = useDebounce(search, 400);

  const { conversations, stats, loading } = useInboxConversations({
    status: tab === "all" ? undefined : tab,
    search: debouncedSearch || undefined,
    sentiment: sentimentFilter !== "all" ? sentimentFilter : undefined,
  });

  // Sort: angry conversations first, then by last_message_at
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const sA = (a as any).sentiment || (a.last_message_text ? analyzeSentiment(a.last_message_text).sentiment : "neutral");
      const sB = (b as any).sentiment || (b.last_message_text ? analyzeSentiment(b.last_message_text).sentiment : "neutral");
      if (sA === "angry" && sB !== "angry") return -1;
      if (sB === "angry" && sA !== "angry") return 1;
      return 0; // preserve server order otherwise
    });
  }, [conversations]);

  return (
    <div className="flex flex-col h-full bg-surface-card border-l border-surface-border">
      {/* Header */}
      <div className="px-3 py-3 border-b border-surface-border">
        <h2 className="text-base font-bold text-white flex items-center gap-2">
          💬 صندوق الوارد
          {stats && stats.unread_total > 0 && (
            <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5 py-0.5 font-bold">
              {stats.unread_total}
            </span>
          )}
        </h2>
      </div>

      {/* Stats */}
      <InboxStatsBar stats={stats} />

      {/* Filters */}
      <ConversationFilters
        activeTab={tab}
        onTabChange={setTab}
        searchQuery={search}
        onSearchChange={setSearch}
        sentimentFilter={sentimentFilter}
        onSentimentChange={setSentimentFilter}
      />

      {/* Conversations */}
      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">
            <div className="animate-spin text-2xl mb-2">⏳</div>
            جاري التحميل...
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-12 text-muted text-sm">
            <div className="text-3xl mb-2">📭</div>
            لا توجد محادثات
          </div>
        ) : (
          sorted.map((conv) => (
            <ConversationItem
              key={conv.id}
              conversation={conv}
              isSelected={selectedId === conv.id}
              onClick={() => onSelect(conv)}
            />
          ))
        )}
      </div>
    </div>
  );
}
