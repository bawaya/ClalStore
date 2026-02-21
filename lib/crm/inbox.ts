// =====================================================
// ClalMobile — Inbox API Calls + Hooks
// Polling-based live inbox for CRM
// =====================================================

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type {
  InboxConversation,
  InboxMessage,
  InboxStats,
  InboxLabel,
  InboxNote,
  InboxTemplate,
  InboxQuickReply,
  ConversationDetail,
  ConversationStatus,
} from "./inbox-types";

// ===== API Helpers =====

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { "Content-Type": "application/json", ...opts?.headers },
    ...opts,
  });
  return res.json();
}

// ===== Conversations =====

export async function fetchConversations(params: {
  status?: string;
  search?: string;
  assigned?: string;
  label?: string;
  sentiment?: string;
  page?: number;
  limit?: number;
}) {
  const qs = new URLSearchParams();
  if (params.status) qs.set("status", params.status);
  if (params.search) qs.set("search", params.search);
  if (params.assigned) qs.set("assigned", params.assigned);
  if (params.label) qs.set("label", params.label);
  if (params.sentiment) qs.set("sentiment", params.sentiment);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  return api<{
    success: boolean;
    conversations: InboxConversation[];
    total: number;
    stats: InboxStats;
  }>(`/api/crm/inbox?${qs}`);
}

export async function fetchConversation(id: string, before?: string) {
  const qs = before ? `?before=${before}&limit=50` : "?limit=50";
  return api<{ success: boolean } & ConversationDetail>(`/api/crm/inbox/${id}${qs}`);
}

export async function sendMessage(conversationId: string, body: {
  type: string;
  content?: string;
  template_name?: string;
  template_params?: Record<string, string>;
  media_url?: string;
  reply_to?: string;
}) {
  return api<{ success: boolean; message?: InboxMessage }>(`/api/crm/inbox/${conversationId}/send`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function assignConversation(id: string, userId: string) {
  return api<{ success: boolean }>(`/api/crm/inbox/${id}/assign`, {
    method: "PUT",
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function updateConversationStatus(id: string, status: ConversationStatus) {
  return api<{ success: boolean }>(`/api/crm/inbox/${id}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export async function fetchNotes(conversationId: string) {
  return api<{ success: boolean; notes: InboxNote[] }>(`/api/crm/inbox/${conversationId}/notes`);
}

export async function addNote(conversationId: string, content: string) {
  return api<{ success: boolean; note?: InboxNote }>(`/api/crm/inbox/${conversationId}/notes`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function fetchTemplates(category?: string) {
  const qs = category ? `?category=${category}` : "";
  return api<{ success: boolean; templates: InboxTemplate[]; quick_replies: InboxQuickReply[] }>(
    `/api/crm/inbox/templates${qs}`
  );
}

export async function fetchStats() {
  return api<{ success: boolean; stats: InboxStats }>("/api/crm/inbox/stats");
}

// ===== Hooks =====

/** Poll conversations list every interval ms */
export function useInboxConversations(params: {
  status?: string;
  search?: string;
  assigned?: string;
  label?: string;
  sentiment?: string;
}, pollInterval = 3000) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const load = useCallback(async (showLoading = false) => {
    if (showLoading) setLoading(true);
    try {
      const data = await fetchConversations(paramsRef.current);
      if (data.success) {
        setConversations(data.conversations);
        setStats(data.stats);
      }
    } catch {}
    setLoading(false);
  }, []);

  useEffect(() => {
    load(true);
    const interval = setInterval(() => load(false), pollInterval);
    return () => clearInterval(interval);
  }, [load, pollInterval, params.status, params.search, params.assigned, params.label, params.sentiment]);

  return { conversations, stats, loading, refresh: () => load(true) };
}

/** Poll messages for a single conversation */
export function useInboxMessages(conversationId: string | null, pollInterval = 3000) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const lastMsgCount = useRef(0);
  const [newMessageArrived, setNewMessageArrived] = useState(false);

  const load = useCallback(async (showLoading = false) => {
    if (!conversationId) return;
    if (showLoading) setLoading(true);
    try {
      const data = await fetchConversation(conversationId);
      if (data.success) {
        const newCount = data.messages?.length || 0;
        if (newCount > lastMsgCount.current && lastMsgCount.current > 0) {
          setNewMessageArrived(true);
          setTimeout(() => setNewMessageArrived(false), 2000);
        }
        lastMsgCount.current = newCount;
        setDetail({
          conversation: data.conversation,
          messages: data.messages,
          customer: data.customer,
          labels: data.labels,
          notes: data.notes,
          has_more: data.has_more,
        });
      }
    } catch {}
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    if (!conversationId) { setDetail(null); return; }
    lastMsgCount.current = 0;
    load(true);
    const interval = setInterval(() => load(false), pollInterval);
    return () => clearInterval(interval);
  }, [conversationId, load, pollInterval]);

  return { detail, loading, newMessageArrived, refresh: () => load(true) };
}

/** Fetch inbox stats for badge count */
export function useInboxBadge(pollInterval = 10000) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await fetchStats();
        if (data.success) setUnread(data.stats.unread_total);
      } catch {}
    };
    load();
    const interval = setInterval(load, pollInterval);
    return () => clearInterval(interval);
  }, [pollInterval]);

  return unread;
}
