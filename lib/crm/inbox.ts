// =====================================================
// ClalMobile — Inbox API Calls + Hooks
// Realtime-first live inbox for CRM (Supabase Realtime)
// Falls back to polling if Realtime is unavailable
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
import { useInboxRealtime, type RealtimeEvent } from "./realtime";
import { csrfHeaders } from "@/lib/csrf-client";

// ===== API Helpers =====

async function api<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { ...csrfHeaders(), ...opts?.headers },
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

export async function fetchAllLabels() {
  return api<{ success: boolean; labels: InboxLabel[] }>("/api/crm/inbox/labels");
}

export async function addLabelToConversation(conversationId: string, labelId: string) {
  return api<{ success: boolean }>("/api/crm/inbox/labels", {
    method: "POST",
    body: JSON.stringify({ conversation_id: conversationId, label_id: labelId }),
  });
}

export async function removeLabelFromConversation(conversationId: string, labelId: string) {
  return api<{ success: boolean }>(`/api/crm/inbox/labels?conversation_id=${conversationId}&label_id=${labelId}`, {
    method: "DELETE",
  });
}

export async function createLabel(name: string, color: string) {
  return api<{ success: boolean; label?: InboxLabel }>("/api/crm/inbox/labels", {
    method: "PUT",
    body: JSON.stringify({ name, color }),
  });
}

// ===== Hooks =====

// Fallback polling interval when Realtime is not connected (ms)
const FALLBACK_POLL_MS = 15_000;

/**
 * Realtime-first conversations list.
 * Subscribes to Supabase Realtime for instant updates.
 * Falls back to slow polling if Realtime is unavailable.
 */
export function useInboxConversations(params: {
  status?: string;
  search?: string;
  assigned?: string;
  label?: string;
  sentiment?: string;
}, pollInterval = FALLBACK_POLL_MS) {
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [stats, setStats] = useState<InboxStats | null>(null);
  const [loading, setLoading] = useState(true);
  const paramsRef = useRef(params);
  useEffect(() => { paramsRef.current = params; });

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

  // Realtime: refresh on any conversation/message change
  const handleRealtime = useCallback(
    (event: RealtimeEvent) => {
      if (
        event.table === "inbox_conversations" ||
        event.table === "inbox_messages"
      ) {
        load(false);
      }
    },
    [load]
  );

  const { connected } = useInboxRealtime(handleRealtime);

  // Initial fetch + fallback polling when Realtime is not connected
  useEffect(() => {
    load(true);
    if (!connected) {
      const interval = setInterval(() => load(false), pollInterval);
      return () => clearInterval(interval);
    }
  }, [load, pollInterval, connected, params.status, params.search, params.assigned, params.label, params.sentiment]);

  return { conversations, stats, loading, refresh: () => load(true), realtimeConnected: connected };
}

/**
 * Realtime-first messages for a single conversation.
 * Subscribes to Supabase Realtime for instant message delivery.
 * Falls back to slow polling if Realtime is unavailable.
 */
export function useInboxMessages(conversationId: string | null, pollInterval = FALLBACK_POLL_MS) {
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const lastMsgCount = useRef(0);
  const [newMessageArrived, setNewMessageArrived] = useState(false);
  const convIdRef = useRef(conversationId);
  useEffect(() => { convIdRef.current = conversationId; });

  const load = useCallback(async (showLoading = false) => {
    if (!convIdRef.current) return;
    if (showLoading) setLoading(true);
    try {
      const data = await fetchConversation(convIdRef.current);
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
  }, []);

  // Realtime: refresh when a message arrives for the current conversation
  const handleRealtime = useCallback(
    (event: RealtimeEvent) => {
      if (!convIdRef.current) return;
      const convId = convIdRef.current;

      if (event.table === "inbox_messages") {
        const msgConvId =
          (event.new as Record<string, unknown>)?.conversation_id ||
          (event.old as Record<string, unknown>)?.conversation_id;
        if (msgConvId === convId) {
          load(false);
        }
      }

      if (event.table === "inbox_conversations") {
        const eventConvId =
          (event.new as Record<string, unknown>)?.id ||
          (event.old as Record<string, unknown>)?.id;
        if (eventConvId === convId) {
          load(false);
        }
      }
    },
    [load]
  );

  const { connected } = useInboxRealtime(handleRealtime);

  useEffect(() => {
    if (!conversationId) { setDetail(null); return; }
    lastMsgCount.current = 0;
    load(true);
    if (!connected) {
      const interval = setInterval(() => load(false), pollInterval);
      return () => clearInterval(interval);
    }
  }, [conversationId, load, pollInterval, connected]);

  return { detail, loading, newMessageArrived, refresh: () => load(true), realtimeConnected: connected };
}

/**
 * Realtime-first inbox badge count.
 * Uses Realtime for instant unread updates, falls back to polling.
 */
export function useInboxBadge(pollInterval = 30_000) {
  const [unread, setUnread] = useState(0);

  const loadStats = useCallback(async () => {
    try {
      const data = await fetchStats();
      if (data.success) setUnread(data.stats.unread_total);
    } catch {}
  }, []);

  // Realtime: refresh badge on any conversation change
  const handleRealtime = useCallback(
    (event: RealtimeEvent) => {
      if (
        event.table === "inbox_conversations" ||
        event.table === "inbox_messages"
      ) {
        loadStats();
      }
    },
    [loadStats]
  );

  const { connected } = useInboxRealtime(handleRealtime);

  useEffect(() => {
    loadStats();
    if (!connected) {
      const interval = setInterval(loadStats, pollInterval);
      return () => clearInterval(interval);
    }
  }, [loadStats, pollInterval, connected]);

  return unread;
}
