// =====================================================
// ClalMobile — Internal Notes Panel
// =====================================================

"use client";

import { useState } from "react";
import type { InboxNote } from "@/lib/crm/inbox-types";
import { addNote } from "@/lib/crm/inbox";

interface Props {
  conversationId: string;
  notes: InboxNote[];
  onNoteAdded: () => void;
}

export function NotesPanel({ conversationId, notes, onNoteAdded }: Props) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAdd = async () => {
    const trimmed = text.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    try {
      const res = await addNote(conversationId, trimmed);
      if (res.success) {
        setText("");
        onNoteAdded();
      }
    } catch {}
    setSaving(false);
  };

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-bold text-muted uppercase tracking-wide">📝 ملاحظات داخلية</h4>

      {/* Add note */}
      <div className="flex gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="اكتب ملاحظة..."
          className="flex-1 bg-surface-bg border border-surface-border rounded-lg px-3 py-1.5 text-sm text-white placeholder:text-muted focus:outline-none focus:border-[#c41040]"
        />
        <button
          onClick={handleAdd}
          disabled={!text.trim() || saving}
          className="px-3 py-1.5 bg-yellow-500/20 text-yellow-400 rounded-lg text-sm hover:bg-yellow-500/30 transition-colors disabled:opacity-50"
        >
          {saving ? "⏳" : "➕"}
        </button>
      </div>

      {/* Notes list */}
      <div className="space-y-1.5 max-h-48 overflow-y-auto">
        {notes.length === 0 ? (
          <p className="text-xs text-muted text-center py-2">لا توجد ملاحظات</p>
        ) : (
          notes.map((note) => (
            <div
              key={note.id}
              className="bg-yellow-500/5 border-r-2 border-yellow-500/50 px-2 py-1.5 rounded text-xs"
            >
              <div className="text-white/80">{note.content}</div>
              <div className="text-muted mt-0.5">
                {new Date(note.created_at).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
