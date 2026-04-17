// =====================================================
// ClalMobile — Mobile Inbox (Conversations List)
// =====================================================

"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useDebounce } from "@/lib/hooks";
import { useInboxConversations } from "@/lib/crm/inbox";
import type { InboxConversation } from "@/lib/crm/inbox-types";
import { analyzeSentiment, SENTIMENT_CONFIG, type Sentiment } from "@/lib/crm/sentiment";
import { MobileHeader } from "./MobileHeader";

type Tab = "all" | "active" | "waiting" | "bot" | "resolved";

const TABS: { key: Tab; label: string; emoji: string }[] = [
  { key: "all", label: "الكل", emoji: "📬" },
  { key: "active", label: "نشط", emoji: "🟢" },
  { key: "waiting", label: "منتظر", emoji: "🟡" },
  { key: "bot", label: "بوت", emoji: "🤖" },
  { key: "resolved", label: "محلول", emoji: "✅" },
];

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `${mins}د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}ي`;
  return new Date(dateStr).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric" });
}

export function MobileInbox() {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const debouncedSearch = useDebounce(search, 400);

  const { conversations, stats, loading, refresh, realtimeConnected } = useInboxConversations({
    status: tab === "all" ? undefined : tab,
    search: debouncedSearch || undefined,
  });

  // Sort: angry first, then unread, then by time
  const sorted = useMemo(() => {
    return [...conversations].sort((a, b) => {
      const sA = (a as any).sentiment || (a.last_message_text ? analyzeSentiment(a.last_message_text).sentiment : "neutral");
      const sB = (b as any).sentiment || (b.last_message_text ? analyzeSentiment(b.last_message_text).sentiment : "neutral");
      if (sA === "angry" && sB !== "angry") return -1;
      if (sB === "angry" && sA !== "angry") return 1;
      if (a.unread_count > 0 && b.unread_count === 0) return -1;
      if (b.unread_count > 0 && a.unread_count === 0) return 1;
      return 0;
    });
  }, [conversations]);

  const handleSelect = (conv: InboxConversation) => {
    router.push(`/m/inbox/${conv.id}`);
  };

  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 1000);
  };

  return (
    <div className="flex flex-col h-[100dvh]">
      <MobileHeader stats={stats} onRefresh={handleRefresh} refreshing={refreshing} />

      {/* Search bar (toggleable) */}
      {showSearch && (
        <div className="px-3 py-2 bg-surface-card border-b border-surface-border">
          <div className="relative">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم أو الرقم..."
              autoFocus
              className="w-full bg-surface-elevated text-white text-sm rounded-lg px-3 py-2 pr-9 outline-none focus:ring-1 focus:ring-brand/50 placeholder:text-muted"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted text-sm">🔍</span>
          </div>
        </div>
      )}

      {/* Tabs + search toggle */}
      <div className="flex items-center bg-surface-card border-b border-surface-border">
        <div className="flex-1 flex overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex-shrink-0 px-3 py-2.5 text-xs font-medium transition-colors border-b-2 ${
                tab === t.key
                  ? "border-brand text-white"
                  : "border-transparent text-muted hover:text-white"
              }`}
            >
              <span className="ml-1">{t.emoji}</span>
              {t.label}
              {t.key === "all" && stats ? ` (${stats.total_conversations})` : ""}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className={`px-3 py-2.5 text-sm transition-colors ${showSearch ? "text-brand" : "text-muted"}`}
        >
          🔍
        </button>
      </div>

      {/* Realtime indicator */}
      {!realtimeConnected && (
        <div className="px-3 py-1 bg-yellow-500/10 text-center">
          <p className="text-[10px] text-yellow-400">⚡ وضع polling — التحديثات كل 15 ثانية</p>
        </div>
      )}

      {/* Conversations list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading && conversations.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <div className="animate-spin text-3xl mb-3">⏳</div>
            <p className="text-sm">جاري التحميل...</p>
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center py-16 text-muted">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-sm">لا توجد محادثات</p>
          </div>
        ) : (
          sorted.map((conv) => (
            <ConversationRow key={conv.id} conversation={conv} onClick={() => handleSelect(conv)} />
          ))
        )}
      </div>
    </div>
  );
}

/* Single conversation row */
function ConversationRow({ conversation: c, onClick }: { conversation: InboxConversation; onClick: () => void }) {
  const hasUnread = c.unread_count > 0;
  const snippet = c.last_message_text?.slice(0, 60) || "";
  const directionIcon = c.last_message_direction === "outbound" ? "↩️" : "";

  const dbSentiment = (c as any).sentiment as Sentiment | undefined;
  const liveSentiment =
    c.last_message_direction === "inbound" && c.last_message_text
      ? analyzeSentiment(c.last_message_text).sentiment
      : undefined;
  const sentiment = dbSentiment || liveSentiment || "neutral";
  const sentimentConf = SENTIMENT_CONFIG[sentiment];

  const statusDots: Record<string, string> = {
    active: "bg-green-500",
    waiting: "bg-yellow-500",
    bot: "bg-purple-500",
    resolved: "bg-muted",
  };

  return (
    <button
      onClick={onClick}
      className={`w-full flex items-start gap-3 px-4 py-3 border-b border-surface-border/50 text-right transition-colors active:bg-surface-elevated ${
        hasUnread ? "bg-brand/5" : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative flex-shrink-0">
        <div className="w-11 h-11 rounded-full bg-brand/15 flex items-center justify-center">
          <span className="text-sm font-bold text-white">{c.customer_name?.[0] || "?"}</span>
        </div>
        <span
          className={`absolute -bottom-0.5 -left-0.5 w-3 h-3 rounded-full border-2 border-surface-bg ${
            statusDots[c.status] || statusDots.active
          }`}
        />
        {sentimentConf && sentiment !== "neutral" && (
          <span className="absolute -top-1 -right-1 text-xs">{sentimentConf.emoji}</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <p className={`text-sm truncate ${hasUnread ? "font-bold text-white" : "font-medium text-white/80"}`}>
            {c.customer_name || c.customer_phone}
          </p>
          <span className="text-[10px] text-muted flex-shrink-0 mr-2">{timeAgo(c.last_message_at)}</span>
        </div>
        <div className="flex items-center justify-between">
          <p className={`text-xs truncate ${hasUnread ? "text-white/70" : "text-muted"}`}>
            {directionIcon} {snippet}
          </p>
          {hasUnread && (
            <span className="bg-brand text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold flex-shrink-0 mr-2">
              {c.unread_count > 99 ? "99+" : c.unread_count}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
