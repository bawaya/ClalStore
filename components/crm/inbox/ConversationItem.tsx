// =====================================================
// ClalMobile — Single Conversation Item in List
// =====================================================

"use client";

import type { InboxConversation } from "@/lib/crm/inbox-types";
import { STATUS_CONFIG } from "@/lib/crm/inbox-types";
import { analyzeSentiment, SENTIMENT_CONFIG, type Sentiment } from "@/lib/crm/sentiment";

interface Props {
  conversation: InboxConversation;
  isSelected: boolean;
  onClick: () => void;
}

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

export function ConversationItem({ conversation, isSelected, onClick }: Props) {
  const c = conversation;
  const status = STATUS_CONFIG[c.status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.active;
  const hasUnread = c.unread_count > 0;
  const snippet = c.last_message_text?.slice(0, 50) || "";

  // Sentiment: from DB (AI) or from last message (rule-based)
  const dbSentiment = (c as any).sentiment as Sentiment | undefined;
  const liveSentiment = c.last_message_direction === "inbound" && c.last_message_text
    ? analyzeSentiment(c.last_message_text).sentiment
    : undefined;
  const sentiment = dbSentiment || liveSentiment || "neutral";
  const sentConf = SENTIMENT_CONFIG[sentiment];
  const isAngry = sentiment === "angry";

  return (
    <button
      onClick={onClick}
      className="w-full text-right px-3 py-2.5 transition-all hover:bg-surface-elevated border-b border-surface-border"
      style={{
        background: isSelected ? "rgba(196,16,64,0.08)" : undefined,
        borderRight: isSelected ? "3px solid #c41040" : "3px solid transparent",
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {/* Status dot */}
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${status.dot}`} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              {/* Sentiment emoji */}
              <span
                className={`text-xs ${isAngry ? "animate-pulse" : ""}`}
                title={sentConf.label}
              >
                {sentConf.emoji}
              </span>
              <span className="font-bold text-sm text-white truncate">
                {c.customer_name || c.customer_phone}
              </span>
              {c.pinned && <span className="text-xs">📌</span>}
            </div>
            {c.customer_name && (
              <p className="text-[11px] text-muted truncate" dir="ltr">{c.customer_phone}</p>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-0.5 shrink-0">
          <span className="text-[10px] text-muted">{timeAgo(c.last_message_at)}</span>
          {hasUnread && (
            <span className="bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
              {c.unread_count}
            </span>
          )}
        </div>
      </div>

      {/* Last message snippet */}
      {snippet && (
        <p className={`text-xs mt-1 truncate ${hasUnread ? "text-white font-medium" : "text-muted"}`}>
          {c.last_message_direction === "outbound" && <span className="text-muted">أنت: </span>}
          {snippet}
        </p>
      )}

      {/* Labels + assigned */}
      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
        {c.labels?.map((label) => (
          <span
            key={label.id}
            className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
            style={{ background: `${label.color}20`, color: label.color }}
          >
            {label.name}
          </span>
        ))}
        {c.assigned_to && (
          <span className="text-[9px] text-muted">👤 {(c as any).assigned_user?.name || "موظف"}</span>
        )}
      </div>
    </button>
  );
}
