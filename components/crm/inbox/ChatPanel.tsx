// =====================================================
// ClalMobile — Chat Panel (Center Column) + AI Summary
// =====================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { InboxConversation, InboxMessage, InboxTemplate, InboxQuickReply } from "@/lib/crm/inbox-types";
import { STATUS_CONFIG } from "@/lib/crm/inbox-types";
import { sendMessage, fetchTemplates } from "@/lib/crm/inbox";
import { analyzeSentimentFromMessages, SENTIMENT_CONFIG } from "@/lib/crm/sentiment";
import { MessageBubble } from "./MessageBubble";
import { MessageInput } from "./MessageInput";

interface ConversationSummary {
  summary: string;
  products: string[];
  status: string;
  action_required: string;
  priority: "high" | "normal" | "low";
  sentiment: "positive" | "neutral" | "negative" | "angry";
  language: string;
  generated_at: string;
  message_count_at_generation: number;
}

interface Props {
  conversation: InboxConversation;
  messages: InboxMessage[];
  onRefresh: () => void;
  onToggleContact: () => void;
  onBack?: () => void; // mobile: go back to list
}

function shouldShowDate(msg: InboxMessage, prev: InboxMessage | null): boolean {
  if (!prev) return true;
  const d1 = new Date(msg.created_at).toDateString();
  const d2 = new Date(prev.created_at).toDateString();
  return d1 !== d2;
}

/* Check 24h window */
function isOutsideWindow(conversation: InboxConversation): boolean {
  if (!conversation.last_message_at) return true;
  const lastMsg = new Date(conversation.last_message_at).getTime();
  const now = Date.now();
  return now - lastMsg > 24 * 60 * 60 * 1000;
}

const PRIORITY_COLORS: Record<string, string> = {
  high: "text-red-400",
  normal: "text-yellow-400",
  low: "text-green-400",
};

const STATUS_LABELS: Record<string, string> = {
  interested_in_buying: "مهتم بالشراء",
  inquiring: "يستفسر فقط",
  angry: "غاضب",
  waiting_for_reply: "ينتظر رد",
  resolved: "تم الحل",
};

export function ChatPanel({
  conversation,
  messages,
  onRefresh,
  onToggleContact,
  onBack,
}: Props) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<InboxTemplate[]>([]);
  const [quickReplies, setQuickReplies] = useState<InboxQuickReply[]>([]);

  // AI Summary state
  const [summary, setSummary] = useState<ConversationSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [summaryStale, setSummaryStale] = useState(false);

  // Sentiment from messages (rule-based, live)
  const liveSentiment = analyzeSentimentFromMessages(
    messages.map((m) => ({ direction: m.direction, content: m.content }))
  );
  const sentimentConf = SENTIMENT_CONFIG[liveSentiment.sentiment];

  /* Scroll to bottom on new messages */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* Fetch templates/quick-replies once */
  useEffect(() => {
    (async () => {
      try {
        const data = await fetchTemplates();
        if (data.success) {
          setTemplates(data.templates || []);
          setQuickReplies(data.quick_replies || []);
        }
      } catch {}
    })();
  }, []);

  /* Auto-load summary for conversations with 5+ messages */
  useEffect(() => {
    if (messages.length >= 5) {
      // Check cached summary in metadata
      const meta = conversation.metadata as Record<string, unknown> | undefined;
      const cached = meta?.ai_summary as ConversationSummary | undefined;
      if (cached) {
        setSummary(cached);
        // Check if stale (3+ new messages since)
        if (messages.length - (cached.message_count_at_generation || 0) >= 3) {
          setSummaryStale(true);
        } else {
          setSummaryStale(false);
        }
      } else {
        // Auto-generate
        loadSummary();
      }
    } else {
      setSummary(null);
    }
  }, [conversation.id, messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadSummary = useCallback(async (force = false) => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`/api/crm/inbox/${conversation.id}/summary`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force }),
      });
      const data = await res.json();
      if (data.success) {
        setSummary(data.summary);
        setSummaryStale(false);
        setSummaryCollapsed(false);
      }
    } catch {}
    setSummaryLoading(false);
  }, [conversation.id]);

  const handleSend = useCallback(
    async (data: {
      type: string;
      content?: string;
      template_name?: string;
      template_params?: Record<string, string>;
    }) => {
      await sendMessage(conversation.id, data);
      onRefresh();
    },
    [conversation.id, onRefresh]
  );

  const statusConf = STATUS_CONFIG[conversation.status] || STATUS_CONFIG.active;
  const outsideWindow = isOutsideWindow(conversation);

  return (
    <div className="flex flex-col h-full bg-surface-bg">
      {/* Chat header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-surface-card border-b border-surface-border">
        {/* Mobile back */}
        {onBack && (
          <button
            onClick={onBack}
            className="text-muted hover:text-white text-lg"
          >
            →
          </button>
        )}

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-[#c41040]/20 flex items-center justify-center text-sm font-bold text-white">
          {conversation.customer_name?.[0] || "?"}
        </div>

        {/* Name & status + sentiment */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold text-white truncate">
              {conversation.customer_name || conversation.customer_phone}
            </span>
            {/* Live sentiment indicator */}
            <span className={sentimentConf.color} title={sentimentConf.label}>
              {sentimentConf.emoji}
            </span>
            <span className={`text-[10px] ${sentimentConf.color}`}>
              {sentimentConf.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: statusConf.color }}
            />
            <span className="text-xs text-muted">{statusConf.label}</span>
            {conversation.assigned_to && (
              <span className="text-xs text-muted mr-2">• موكّل</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleContact}
            className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface-elevated transition-colors"
            title="تفاصيل"
          >
            ℹ️
          </button>
        </div>
      </div>

      {/* AI Summary banner (collapsible) */}
      {messages.length >= 5 && (
        <div className="border-b border-surface-border bg-surface-elevated">
          {/* Summary header (always visible) */}
          <button
            onClick={() => {
              if (!summary && !summaryLoading) loadSummary();
              else setSummaryCollapsed(!summaryCollapsed);
            }}
            className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-surface-bg/30 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-sm">🧠</span>
              <span className="text-xs font-bold text-white">ملخص ذكي</span>
              {summaryStale && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400">
                  ملخص قديم — حدّث
                </span>
              )}
              {summaryLoading && (
                <span className="text-[10px] text-purple-400 animate-pulse">جاري التحليل...</span>
              )}
            </div>
            <span className="text-xs text-muted">
              {summaryCollapsed ? "▼" : "▲"}
            </span>
          </button>

          {/* Summary content (when expanded) */}
          {!summaryCollapsed && summary && (
            <div className="px-4 pb-3 space-y-2">
              <p className="text-sm text-white leading-relaxed">
                {summary.summary}
              </p>

              <div className="flex flex-wrap gap-3 text-xs">
                {/* Products */}
                {summary.products.length > 0 && (
                  <div className="flex items-center gap-1">
                    <span>📱</span>
                    <span className="text-muted">المنتجات:</span>
                    <span className="text-white">{summary.products.join("، ")}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-3 text-xs">
                {/* Action */}
                {summary.action_required && (
                  <div className="flex items-center gap-1">
                    <span>🎯</span>
                    <span className="text-muted">الإجراء:</span>
                    <span className="text-white">{summary.action_required}</span>
                  </div>
                )}

                {/* Priority */}
                <div className="flex items-center gap-1">
                  <span>⚡</span>
                  <span className="text-muted">الأولوية:</span>
                  <span className={PRIORITY_COLORS[summary.priority] || "text-white"}>
                    {summary.priority === "high" ? "عالية" : summary.priority === "low" ? "منخفضة" : "عادية"}
                  </span>
                </div>

                {/* Sentiment */}
                <div className="flex items-center gap-1">
                  <span>{SENTIMENT_CONFIG[summary.sentiment]?.emoji || "😐"}</span>
                  <span className="text-muted">المزاج:</span>
                  <span className={SENTIMENT_CONFIG[summary.sentiment]?.color || "text-gray-400"}>
                    {SENTIMENT_CONFIG[summary.sentiment]?.label || "محايد"}
                  </span>
                </div>

                {/* Status */}
                {summary.status && (
                  <div className="flex items-center gap-1">
                    <span>📊</span>
                    <span className="text-muted">الحالة:</span>
                    <span className="text-white">
                      {STATUS_LABELS[summary.status] || summary.status}
                    </span>
                  </div>
                )}
              </div>

              {/* Refresh button */}
              <div className="flex justify-center pt-1">
                <button
                  onClick={() => loadSummary(true)}
                  disabled={summaryLoading}
                  className="text-xs text-purple-400 hover:text-purple-300 transition-colors disabled:opacity-50"
                >
                  {summaryLoading ? "⏳ جاري التحديث..." : "🔄 تحديث الملخص"}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Messages area */}
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto py-3"
      >
        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-sm">
            <div className="text-center">
              <div className="text-4xl mb-2">💬</div>
              <p>لا توجد رسائل بعد</p>
            </div>
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                showDate={shouldShowDate(msg, messages[idx - 1] || null)}
              />
            ))}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      {conversation.status === "archived" ? (
        <div className="px-4 py-3 bg-surface-card border-t border-surface-border text-center">
          <p className="text-sm text-muted">📦 المحادثة مؤرشفة</p>
        </div>
      ) : (
        <MessageInput
          conversationId={conversation.id}
          onSend={handleSend}
          templates={templates}
          quickReplies={quickReplies}
          outsideWindow={outsideWindow}
        />
      )}
    </div>
  );
}
