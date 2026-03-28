// =====================================================
// ClalMobile — Supabase Realtime for CRM Inbox
// Replaces polling with live subscriptions on
// inbox_conversations and inbox_messages tables.
// Handles connection drops and reconnection gracefully.
// =====================================================

"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { createBrowserSupabase } from "@/lib/supabase";
import type { RealtimeChannel, RealtimePostgresChangesPayload } from "@supabase/supabase-js";

export type RealtimeEvent = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
};

type RealtimeCallback = (event: RealtimeEvent) => void;

/**
 * Hook: subscribe to Supabase Realtime on inbox tables.
 * Fires `onEvent` for INSERT/UPDATE on inbox_conversations and inbox_messages.
 * Automatically reconnects on connection drops.
 */
export function useInboxRealtime(onEvent: RealtimeCallback) {
  const callbackRef = useRef(onEvent);
  callbackRef.current = onEvent;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const [connected, setConnected] = useState(false);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (reconnectTimer.current) {
      clearTimeout(reconnectTimer.current);
      reconnectTimer.current = null;
    }
    if (channelRef.current) {
      const supabase = createBrowserSupabase();
      if (supabase) {
        supabase.removeChannel(channelRef.current);
      }
      channelRef.current = null;
    }
    setConnected(false);
  }, []);

  const subscribe = useCallback(() => {
    const supabase = createBrowserSupabase();
    if (!supabase) return;

    // Clean up any existing channel
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    const channel = supabase
      .channel("crm-inbox-realtime", {
        config: { broadcast: { self: false } },
      })
      // Listen for changes on inbox_conversations
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_conversations",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          callbackRef.current({
            table: "inbox_conversations",
            eventType: payload.eventType as RealtimeEvent["eventType"],
            new: (payload.new || {}) as Record<string, unknown>,
            old: (payload.old || {}) as Record<string, unknown>,
          });
        }
      )
      // Listen for changes on inbox_messages
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inbox_messages",
        },
        (payload: RealtimePostgresChangesPayload<Record<string, unknown>>) => {
          callbackRef.current({
            table: "inbox_messages",
            eventType: payload.eventType as RealtimeEvent["eventType"],
            new: (payload.new || {}) as Record<string, unknown>,
            old: (payload.old || {}) as Record<string, unknown>,
          });
        }
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          setConnected(true);
        } else if (status === "CLOSED" || status === "CHANNEL_ERROR") {
          setConnected(false);
          // Reconnect after a delay
          if (!reconnectTimer.current) {
            reconnectTimer.current = setTimeout(() => {
              reconnectTimer.current = null;
              subscribe();
            }, 5000);
          }
        }
      });

    channelRef.current = channel;
  }, []);

  useEffect(() => {
    subscribe();
    return cleanup;
  }, [subscribe, cleanup]);

  return { connected };
}
