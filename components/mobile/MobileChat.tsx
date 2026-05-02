// =====================================================
// ClalMobile — Mobile Chat (Full Conversation View)
// =====================================================

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useInboxMessages } from "@/lib/crm/inbox";
import { sendMessage, fetchTemplates } from "@/lib/crm/inbox";
import type { InboxMessage, InboxTemplate, InboxQuickReply } from "@/lib/crm/inbox-types";
import { analyzeSentimentFromMessages } from "@/lib/crm/sentiment";
import { MobileChatHeader } from "./MobileHeader";
import { MobileMessageInput } from "./MobileMessageInput";

interface Props {
  conversationId: string;
}

function timeStr(d: string) {
  return new Date(d).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function dateLabel(d: string) {
  const dt = new Date(d);
  const now = new Date();
  const diff = now.getTime() - dt.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "اليوم";
  if (days === 1) return "أمس";
  return dt.toLocaleDateString("ar-EG", { day: "numeric", month: "short", year: "numeric" });
}

function shouldShowDate(msg: InboxMessage, prev: InboxMessage | null): boolean {
  if (!prev) return true;
  return new Date(msg.created_at).toDateString() !== new Date(prev.created_at).toDateString();
}

function isOutsideWindow(lastMessageAt: string | null): boolean {
  if (!lastMessageAt) return true;
  return Date.now() - new Date(lastMessageAt).getTime() > 24 * 60 * 60 * 1000;
}

/* Status check icons */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sent": return <span className="text-[10px] text-muted">✓</span>;
    case "delivered": return <span className="text-[10px] text-muted">✓✓</span>;
    case "read": return <span className="text-[10px] text-blue-400">✓✓</span>;
    case "failed": return <span className="text-[10px] text-red-400">❌</span>;
    default: return null;
  }
}

/* Media content */
function MediaContent({ message }: { message: InboxMessage }) {
  const [expanded, setExpanded] = useState(false);

  if (message.message_type === "image" && message.media_url) {
    return (
      <div className="mb-1">
        <img
          src={message.media_url}
          alt="صورة"
          loading="lazy"
          decoding="async"
          className="max-w-[200px] rounded-lg cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        />
        {expanded && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4" onClick={() => setExpanded(false)}>
            <img
              src={message.media_url}
              alt="صورة"
              decoding="async"
              className="max-w-full max-h-full rounded-lg"
            />
          </div>
        )}
      </div>
    );
  }

  if (message.message_type === "document" && message.media_url) {
    return (
      <a href={message.media_url} target="_blank" rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-white/5 rounded-lg mb-1">
        <span>📄</span>
        <span className="text-sm truncate">{message.media_filename || "مستند"}</span>
      </a>
    );
  }

  if (message.message_type === "audio" && message.media_url) {
    return <audio controls className="max-w-full mb-1"><source src={message.media_url} /></audio>;
  }

  if (message.message_type === "video" && message.media_url) {
    return <video controls className="max-w-[200px] rounded-lg mb-1"><source src={message.media_url} /></video>;
  }

  return null;
}

export function MobileChat({ conversationId }: Props) {
  const router = useRouter();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [templates, setTemplates] = useState<InboxTemplate[]>([]);
  const [quickReplies, setQuickReplies] = useState<InboxQuickReply[]>([]);

  const { detail, loading, refresh } = useInboxMessages(conversationId);

  const conversation = detail?.conversation;
  const messages = detail?.messages || [];

  /* Scroll to bottom */
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  /* Load templates */
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

  /* Send message */
  const handleSend = useCallback(async (data: {
    type: string;
    content?: string;
    template_name?: string;
    template_params?: Record<string, string>;
    media_url?: string;
    media_filename?: string;
  }) => {
    if (!conversation) return;
    await sendMessage(conversation.id, data);
    refresh();
  }, [conversation, refresh]);

  const handleBack = () => router.push("/m/inbox");

  const outsideWindow = conversation ? isOutsideWindow(conversation.last_message_at) : false;

  /* Sentiment */
  const sentiment = conversation
    ? (conversation as any).sentiment ||
      analyzeSentimentFromMessages(
        messages.map((m) => ({ direction: m.direction, content: m.content || "" }))
      ).sentiment
    : "neutral";

  /* Loading state */
  if (loading && !conversation) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-surface-bg">
        <div className="animate-spin text-3xl mb-3">⏳</div>
        <p className="text-sm text-muted">جاري التحميل...</p>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="flex flex-col h-[100dvh] items-center justify-center bg-surface-bg">
        <p className="text-muted text-sm">المحادثة غير موجودة</p>
        <button onClick={handleBack} className="mt-3 text-brand text-sm">← الرجوع</button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh]">
      <MobileChatHeader
        customerName={conversation.customer_name}
        customerPhone={conversation.customer_phone}
        status={conversation.status}
        sentiment={sentiment}
        onBack={handleBack}
      />

      {/* Messages area */}
      <div ref={containerRef} className="flex-1 overflow-y-auto overscroll-contain px-3 py-2 space-y-0.5">
        {messages.map((msg, i) => {
          const prev = i > 0 ? messages[i - 1] : null;
          const showDate = shouldShowDate(msg, prev);

          return (
            <div key={msg.id}>
              {/* Date separator */}
              {showDate && (
                <div className="flex justify-center my-3">
                  <span className="text-[10px] text-muted bg-surface-card/60 px-3 py-1 rounded-full">
                    {dateLabel(msg.created_at)}
                  </span>
                </div>
              )}

              {/* System message */}
              {msg.sender_type === "system" ? (
                <div className="flex justify-center my-1.5">
                  <span className="text-[10px] text-muted bg-surface-card/40 px-3 py-1 rounded-full">
                    ⚙️ {msg.content}
                  </span>
                </div>
              ) : (
                /* Regular bubble */
                <div className={`flex ${msg.direction === "outbound" ? "justify-start" : "justify-end"} mb-1`}>
                  <div
                    className={`max-w-[80%] rounded-2xl px-3 py-2 ${
                      msg.direction === "outbound"
                        ? "bg-brand/15 rounded-bl-md"
                        : "bg-surface-elevated rounded-br-md"
                    }`}
                  >
                    {/* Sender label for agent/bot */}
                    {msg.direction === "outbound" && (
                      <p className="text-[10px] text-brand/70 mb-0.5">
                        {msg.sender_type === "bot" ? "🤖 بوت" : msg.sender_name || "موظف"}
                      </p>
                    )}

                    {/* Media */}
                    <MediaContent message={msg} />

                    {/* Text content */}
                    {msg.content && (
                      <p className="text-[13px] text-white/90 leading-relaxed whitespace-pre-wrap break-words">
                        {msg.content}
                      </p>
                    )}

                    {/* Time + status */}
                    <div className="flex items-center gap-1 justify-end mt-1">
                      <span className="text-[10px] text-muted">{timeStr(msg.created_at)}</span>
                      {msg.direction === "outbound" && <StatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MobileMessageInput
        conversationId={conversationId}
        onSend={handleSend}
        templates={templates}
        quickReplies={quickReplies}
        outsideWindow={outsideWindow}
      />
    </div>
  );
}
