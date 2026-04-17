// =====================================================
// ClalMobile — Mobile Inbox Header
// =====================================================

"use client";

import { useRouter } from "next/navigation";
import type { InboxStats } from "@/lib/crm/inbox-types";

interface Props {
  stats: InboxStats | null;
  onRefresh?: () => void;
  refreshing?: boolean;
}

export function MobileHeader({ stats, onRefresh, refreshing }: Props) {
  return (
    <header className="flex items-center justify-between px-4 py-3 bg-surface-card border-b border-surface-border safe-top">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-brand/20 flex items-center justify-center">
          <span className="text-sm">💬</span>
        </div>
        <div>
          <h1 className="text-base font-bold text-white leading-tight">صندوق الوارد</h1>
          {stats && (
            <p className="text-[11px] text-muted leading-tight">
              {stats.active} نشط · {stats.unread_total} غير مقروء
            </p>
          )}
        </div>
      </div>
      <button
        onClick={onRefresh}
        disabled={refreshing}
        className="p-2 rounded-lg text-muted hover:text-white hover:bg-surface-elevated transition-colors disabled:opacity-50"
      >
        <span className={refreshing ? "animate-spin inline-block" : ""}>🔄</span>
      </button>
    </header>
  );
}

/* Chat header — shows customer info + back button */
interface ChatHeaderProps {
  customerName: string | null;
  customerPhone: string;
  status: string;
  sentiment?: string;
  onBack: () => void;
  onInfo?: () => void;
}

export function MobileChatHeader({
  customerName,
  customerPhone,
  status,
  sentiment,
  onBack,
  onInfo,
}: ChatHeaderProps) {
  const statusLabels: Record<string, { label: string; color: string }> = {
    active: { label: "نشط", color: "bg-green-500" },
    waiting: { label: "منتظر", color: "bg-yellow-500" },
    bot: { label: "بوت", color: "bg-purple-500" },
    resolved: { label: "محلول", color: "bg-muted" },
    archived: { label: "مؤرشف", color: "bg-dim" },
  };

  const sentimentEmoji: Record<string, string> = {
    positive: "😊",
    neutral: "😐",
    negative: "😟",
    angry: "😡",
  };

  const s = statusLabels[status] || statusLabels.active;

  return (
    <header className="flex items-center gap-3 px-3 py-3 bg-surface-card border-b border-surface-border safe-top">
      <button
        onClick={onBack}
        className="p-1.5 rounded-lg text-muted hover:text-white hover:bg-surface-elevated transition-colors text-lg"
      >
        →
      </button>

      <div className="w-9 h-9 rounded-full bg-brand/20 flex items-center justify-center flex-shrink-0">
        <span className="text-sm font-bold">{customerName?.[0] || "?"}</span>
      </div>

      <div className="flex-1 min-w-0" onClick={onInfo}>
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-semibold text-white truncate">
            {customerName || customerPhone}
          </p>
          {sentiment && sentimentEmoji[sentiment] && (
            <span className="text-xs">{sentimentEmoji[sentiment]}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full ${s.color}`} />
          <p className="text-[11px] text-muted">{s.label}</p>
          {customerName && (
            <p className="text-[11px] text-muted">· {customerPhone}</p>
          )}
        </div>
      </div>
    </header>
  );
}
