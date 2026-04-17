// =====================================================
// ClalMobile — CRM Inbox Realtime (Supabase Realtime)
// Subscribes to inbox_conversations + inbox_messages changes
// =====================================================

"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabase } from "@/lib/supabase";

export interface RealtimeEvent {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

type RealtimeHandler = (event: RealtimeEvent) => void;

export function useInboxRealtime(onEvent: RealtimeHandler): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onEvent);

  useEffect(() => {
    handlerRef.current = onEvent;
  });

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    const channel = supabase
      .channel("inbox-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_conversations" },
        (payload: any) => {
          handlerRef.current({
            table: "inbox_conversations",
            eventType: payload.eventType,
            new: payload.new || {},
            old: payload.old || {},
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "inbox_messages" },
        (payload: any) => {
          handlerRef.current({
            table: "inbox_messages",
            eventType: payload.eventType,
            new: payload.new || {},
            old: payload.old || {},
          });
        }
      )
      .subscribe((status: string) => {
        setConnected(status === "SUBSCRIBED");
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { connected };
}
