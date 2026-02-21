// =====================================================
// ClalMobile — Contact / Detail Panel (Right Sidebar)
// =====================================================

"use client";

import { useState } from "react";
import type {
  InboxConversation,
  InboxLabel,
  InboxNote,
  ConversationStatus,
} from "@/lib/crm/inbox-types";
import { STATUS_CONFIG } from "@/lib/crm/inbox-types";
import { updateConversationStatus } from "@/lib/crm/inbox";
import { AssignAgent } from "./AssignAgent";
import { NotesPanel } from "./NotesPanel";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
}

interface Props {
  conversation: InboxConversation;
  customer: Customer | null;
  labels: InboxLabel[];
  notes: InboxNote[];
  onRefresh: () => void;
  onClose: () => void;
}

/* Status action buttons */
const ACTIONS: { status: ConversationStatus; label: string; icon: string }[] = [
  { status: "active", label: "نشطة", icon: "🟢" },
  { status: "waiting", label: "انتظار", icon: "🟡" },
  { status: "bot", label: "بوت", icon: "🤖" },
  { status: "resolved", label: "حل", icon: "✅" },
  { status: "archived", label: "أرشيف", icon: "📦" },
];

export function ContactPanel({
  conversation,
  customer,
  labels,
  notes,
  onRefresh,
  onClose,
}: Props) {
  const [changingStatus, setChangingStatus] = useState(false);

  const handleStatus = async (status: ConversationStatus) => {
    if (status === conversation.status) return;
    setChangingStatus(true);
    try {
      await updateConversationStatus(conversation.id, status);
      onRefresh();
    } catch {}
    setChangingStatus(false);
  };

  const statusConf = STATUS_CONFIG[conversation.status] || STATUS_CONFIG.active;

  return (
    <div className="flex flex-col h-full bg-surface-card border-r border-surface-border">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3 border-b border-surface-border">
        <h3 className="text-sm font-bold text-white">معلومات المحادثة</h3>
        <button
          onClick={onClose}
          className="text-muted hover:text-white text-lg"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {/* Customer info */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wide">👤 العميل</h4>
          <div className="bg-surface-bg rounded-lg p-3 space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-full bg-[#c41040]/20 flex items-center justify-center text-lg">
                {customer?.name?.[0] || "?"}
              </div>
              <div>
                <div className="text-sm text-white font-medium">
                  {customer?.name || conversation.customer_name || "مجهول"}
                </div>
                <div className="text-xs text-muted" dir="ltr">
                  {conversation.customer_phone}
                </div>
              </div>
            </div>
            {customer?.email && (
              <div className="text-xs text-muted">📧 {customer.email}</div>
            )}
            {customer?.city && (
              <div className="text-xs text-muted">📍 {customer.city}</div>
            )}
            {customer?.id && (
              <a
                href={`/crm/customers?id=${customer.id}`}
                className="text-xs text-[#c41040] hover:underline"
              >
                ← عرض الملف الكامل
              </a>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wide">📊 الحالة</h4>
          <div className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: statusConf.color }}
            />
            <span className="text-sm text-white">{statusConf.label}</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {ACTIONS.map((a) => (
              <button
                key={a.status}
                onClick={() => handleStatus(a.status)}
                disabled={changingStatus || a.status === conversation.status}
                className={`px-2 py-1 rounded-lg text-xs transition-colors ${
                  a.status === conversation.status
                    ? "bg-[#c41040]/20 text-[#c41040] font-medium"
                    : "bg-surface-bg text-muted hover:bg-surface-elevated hover:text-white"
                } disabled:opacity-50`}
              >
                {a.icon} {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* Assign */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wide">👤 تعيين موظف</h4>
          <AssignAgent
            conversationId={conversation.id}
            currentAssignee={conversation.assigned_to}
            onAssigned={onRefresh}
          />
        </div>

        {/* Labels */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wide">🏷️ التصنيفات</h4>
          {labels.length === 0 ? (
            <p className="text-xs text-muted">لا توجد تصنيفات</p>
          ) : (
            <div className="flex flex-wrap gap-1">
              {labels.map((l) => (
                <span
                  key={l.id}
                  className="px-2 py-0.5 rounded-full text-[10px] text-white"
                  style={{ backgroundColor: l.color + "30", borderColor: l.color, borderWidth: 1 }}
                >
                  {l.name}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Conversation metadata */}
        <div className="space-y-2">
          <h4 className="text-xs font-bold text-muted uppercase tracking-wide">📅 بيانات</h4>
          <div className="bg-surface-bg rounded-lg p-3 space-y-1 text-xs text-muted">
            <div className="flex justify-between">
              <span>أنشئت</span>
              <span>
                {new Date(conversation.created_at).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="flex justify-between">
              <span>آخر رسالة</span>
              <span>
                {conversation.last_message_at
                  ? new Date(conversation.last_message_at).toLocaleDateString("ar-EG", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>غير مقروءة</span>
              <span>{conversation.unread_count || 0}</span>
            </div>
            {conversation.pinned && (
              <div className="text-yellow-400">📌 مثبتة</div>
            )}
          </div>
        </div>

        {/* Notes */}
        <NotesPanel
          conversationId={conversation.id}
          notes={notes}
          onNoteAdded={onRefresh}
        />
      </div>
    </div>
  );
}
