// =====================================================
// ClalMobile — Assign Agent Dropdown
// =====================================================

"use client";

import { useState, useEffect } from "react";
import { assignConversation } from "@/lib/crm/inbox";

interface User {
  id: string;
  name: string;
  role?: string;
}

interface Props {
  conversationId: string;
  currentAssignee: string | null;
  onAssigned: () => void;
}

export function AssignAgent({ conversationId, currentAssignee, onAssigned }: Props) {
  const [open, setOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    (async () => {
      try {
        const res = await fetch("/api/crm/users");
        const data = await res.json();
        const list = (data.data || []).map((userRow: any) => ({
          id: userRow.id,
          name: userRow.name || userRow.email || "موظف",
          role: userRow.role,
        }));
        setUsers(list);
      } catch {
        setUsers([]);
      }
    })();
  }, [open]);

  const handleAssign = async (userId: string) => {
    setLoading(true);
    try {
      await assignConversation(conversationId, userId);
      onAssigned();
    } catch {}
    setLoading(false);
    setOpen(false);
  };

  const handleUnassign = async () => {
    setLoading(true);
    try {
      await assignConversation(conversationId, "");
      onAssigned();
    } catch {}
    setLoading(false);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-2 bg-surface-bg border border-surface-border rounded-lg text-sm hover:bg-surface-elevated transition-colors"
      >
        <span className="text-muted">
          {currentAssignee ? "👤 موكّل" : "تعيين موظف"}
        </span>
        <span className="text-xs text-muted">{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-surface-card border border-surface-border rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
          {currentAssignee && (
            <button
              onClick={handleUnassign}
              disabled={loading}
              className="w-full text-right px-3 py-2 text-sm text-red-400 hover:bg-surface-elevated border-b border-surface-border"
            >
              ❌ إلغاء التعيين
            </button>
          )}

          {users.length === 0 ? (
            <div className="text-center py-3 text-muted text-sm">لا يوجد موظفون</div>
          ) : (
            users.map((userRow) => (
              <button
                key={userRow.id}
                onClick={() => handleAssign(userRow.id)}
                disabled={loading || userRow.id === currentAssignee}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-surface-elevated transition-colors ${
                  userRow.id === currentAssignee ? "text-[#c41040] font-medium" : "text-white"
                }`}
              >
                👤 {userRow.name}
                {userRow.id === currentAssignee && " ✓"}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
