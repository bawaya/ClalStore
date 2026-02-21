// =====================================================
// ClalMobile — Assign Agent Dropdown
// =====================================================

"use client";

import { useState, useEffect } from "react";
import { assignConversation } from "@/lib/crm/inbox";

interface User {
  id: string;
  full_name: string;
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

  /* Fetch CRM users */
  useEffect(() => {
    if (!open) return;
    (async () => {
      try {
        const res = await fetch("/api/crm/inbox?limit=0");
        // Fallback: just use a static list or fetch from crm users endpoint
        const data = await fetch("/api/admin/users").then(r => r.json()).catch(() => ({ users: [] }));
        setUsers(data.users || []);
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
          {/* Unassign option */}
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
            users.map((u) => (
              <button
                key={u.id}
                onClick={() => handleAssign(u.id)}
                disabled={loading || u.id === currentAssignee}
                className={`w-full text-right px-3 py-2 text-sm hover:bg-surface-elevated transition-colors ${
                  u.id === currentAssignee ? "text-[#c41040] font-medium" : "text-white"
                }`}
              >
                👤 {u.full_name}
                {u.id === currentAssignee && " ✓"}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
