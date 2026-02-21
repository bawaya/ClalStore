// =====================================================
// ClalMobile — Quick Replies Popup
// =====================================================

"use client";

import { useState, useEffect } from "react";

export interface QuickReply {
  id: string;
  shortcut: string;
  title: string;
  content: string;
}

interface Props {
  replies: QuickReply[];
  onSelect: (content: string) => void;
  onClose: () => void;
}

export function QuickReplies({ replies, onSelect, onClose }: Props) {
  const [search, setSearch] = useState("");

  const filtered = replies.filter(
    (r) =>
      r.shortcut.includes(search) ||
      r.title.includes(search) ||
      r.content.includes(search)
  );

  /* Close on Escape */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div className="absolute bottom-full left-0 right-0 mb-1 bg-surface-card border border-surface-border rounded-xl shadow-xl z-30 max-h-64 flex flex-col">
      {/* Header */}
      <div className="p-2 border-b border-surface-border">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث سريع..."
          className="w-full bg-surface-bg border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-[#c41040]"
          autoFocus
        />
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-4 text-muted text-sm">لا توجد ردود</div>
        ) : (
          filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelect(r.content)}
              className="w-full text-right px-3 py-2 hover:bg-surface-elevated transition-colors border-b border-surface-border/50 last:border-b-0"
            >
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#c41040] font-mono bg-[#c41040]/10 px-1.5 rounded">
                  {r.shortcut}
                </span>
                <span className="text-sm text-white font-medium">{r.title}</span>
              </div>
              <p className="text-xs text-muted mt-0.5 line-clamp-1">{r.content}</p>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
