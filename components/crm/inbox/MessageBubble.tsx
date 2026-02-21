// =====================================================
// ClalMobile — Message Bubble Component
// =====================================================

"use client";

import { useState } from "react";
import type { InboxMessage } from "@/lib/crm/inbox-types";

function timeStr(d: string) {
  const dt = new Date(d);
  return dt.toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
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

/* Status icons */
function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "sent":
      return <span className="text-[10px] text-muted">✓</span>;
    case "delivered":
      return <span className="text-[10px] text-muted">✓✓</span>;
    case "read":
      return <span className="text-[10px] text-blue-400">✓✓</span>;
    case "failed":
      return <span className="text-[10px] text-red-400">❌</span>;
    default:
      return null;
  }
}

/* Media rendering */
function MediaContent({ message }: { message: InboxMessage }) {
  const [expanded, setExpanded] = useState(false);

  if (message.message_type === "image" && message.media_url) {
    return (
      <div className="mb-1">
        <img
          src={message.media_url}
          alt="صورة"
          className="max-w-[220px] rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setExpanded(!expanded)}
        />
        {expanded && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
            onClick={() => setExpanded(false)}
          >
            <img
              src={message.media_url}
              alt="صورة"
              className="max-w-full max-h-full rounded-lg"
            />
          </div>
        )}
      </div>
    );
  }

  if (message.message_type === "document" && message.media_url) {
    return (
      <a
        href={message.media_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 p-2 bg-white/5 rounded-lg mb-1 hover:bg-white/10 transition-colors"
      >
        <span className="text-xl">📄</span>
        <span className="text-sm text-white truncate">
          {message.media_filename || "مستند"}
        </span>
      </a>
    );
  }

  if (message.message_type === "audio" && message.media_url) {
    return (
      <audio controls className="max-w-[220px] mb-1">
        <source src={message.media_url} />
      </audio>
    );
  }

  if (message.message_type === "video" && message.media_url) {
    return (
      <video controls className="max-w-[220px] rounded-lg mb-1">
        <source src={message.media_url} />
      </video>
    );
  }

  if (message.message_type === "location") {
    return (
      <div className="flex items-center gap-2 p-2 bg-white/5 rounded-lg mb-1">
        <span className="text-xl">📍</span>
        <span className="text-sm text-white">موقع</span>
      </div>
    );
  }

  return null;
}

/* ──────────────── Main Bubble ──────────────── */

interface Props {
  message: InboxMessage;
  showDate?: boolean;
}

export function MessageBubble({ message, showDate }: Props) {
  /* System message */
  if (message.sender_type === "system") {
    return (
      <>
        {showDate && <DateSeparator date={message.created_at} />}
        <div className="flex justify-center my-2">
          <span className="text-xs text-muted bg-surface-card/50 px-3 py-1 rounded-full">
            ⚙️ {message.content}
          </span>
        </div>
      </>
    );
  }

  /* Note */
  if (message.message_type === "note") {
    return (
      <>
        {showDate && <DateSeparator date={message.created_at} />}
        <div className="flex justify-center my-2 px-6">
          <div className="bg-yellow-500/10 border-r-2 border-yellow-500 px-3 py-2 rounded-lg text-sm max-w-sm">
            <div className="text-yellow-400 text-xs mb-1">📝 ملاحظة داخلية</div>
            <div className="text-white/90">{message.content}</div>
            <div className="text-[10px] text-muted mt-1">{timeStr(message.created_at)}</div>
          </div>
        </div>
      </>
    );
  }

  const isInbound = message.direction === "inbound";
  const isBot = message.sender_type === "bot";

  /* Bot message */
  if (isBot) {
    return (
      <>
        {showDate && <DateSeparator date={message.created_at} />}
        <div className="flex justify-center my-1 px-4">
          <div className="bg-surface-card border border-surface-border px-3 py-2 rounded-xl text-sm max-w-sm">
            <div className="text-blue-400 text-xs mb-1">🤖 بوت</div>
            <div className="text-white/90 whitespace-pre-wrap">{message.content}</div>
            <div className="text-[10px] text-muted mt-1 text-left">{timeStr(message.created_at)}</div>
          </div>
        </div>
      </>
    );
  }

  /* Customer (inbound) or Agent (outbound) */
  return (
    <>
      {showDate && <DateSeparator date={message.created_at} />}
      <div
        className={`flex my-1 px-3 ${
          isInbound ? "justify-start" : "justify-end"
        }`}
      >
        <div
          className={`max-w-[75%] px-3 py-2 rounded-2xl text-sm ${
            isInbound
              ? "bg-surface-elevated text-white rounded-tr-sm"
              : "bg-[#c41040]/15 text-white rounded-tl-sm"
          }`}
        >
          <MediaContent message={message} />

          {message.content && (
            <div className="whitespace-pre-wrap break-words">{message.content}</div>
          )}

          <div
            className={`flex items-center gap-1 mt-1 ${
              isInbound ? "justify-start" : "justify-end"
            }`}
          >
            <span className="text-[10px] text-muted">{timeStr(message.created_at)}</span>
            {!isInbound && <StatusIcon status={message.status} />}
          </div>
        </div>
      </div>
    </>
  );
}

/* Date separator line */
function DateSeparator({ date }: { date: string }) {
  return (
    <div className="flex items-center gap-3 my-3 px-6">
      <div className="flex-1 h-px bg-surface-border" />
      <span className="text-[10px] text-muted bg-surface-bg px-2 py-0.5 rounded-full">
        {dateLabel(date)}
      </span>
      <div className="flex-1 h-px bg-surface-border" />
    </div>
  );
}
