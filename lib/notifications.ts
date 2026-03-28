// =====================================================
// ClalMobile — Notification Store (Zustand)
// Client-side state for the internal notification system
// =====================================================

import { create } from "zustand";
import type { Notification } from "@/types/database";
import { csrfHeaders } from "@/lib/csrf-client";

interface NotificationStore {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  polling: ReturnType<typeof setInterval> | null;

  fetchNotifications: (userId: string) => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllRead: (userId: string) => Promise<void>;
  addNotification: (n: Notification) => void;
  createNotification: (payload: {
    user_id?: string | null;
    type: Notification["type"];
    title: string;
    body?: string;
    link?: string;
    icon?: string;
  }) => Promise<Notification | null>;
  startPolling: (userId: string) => void;
  stopPolling: () => void;
}

export const useNotifications = create<NotificationStore>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  polling: null,

  fetchNotifications: async (userId: string) => {
    try {
      set({ loading: true });
      const res = await fetch(
        `/api/notifications?user_id=${encodeURIComponent(userId)}`
      );
      if (!res.ok) return;

      const json = await res.json();
      set({
        notifications: json.data ?? [],
        unreadCount: json.unreadCount ?? 0,
        loading: false,
      });
    } catch {
      set({ loading: false });
    }
  },

  markAsRead: async (id: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      ),
      unreadCount: Math.max(
        0,
        state.unreadCount -
          (state.notifications.find((n) => n.id === id && !n.read) ? 1 : 0)
      ),
    }));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify({ id }),
      });
    } catch {}
  },

  markAllRead: async (userId: string) => {
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));

    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: csrfHeaders(),
        body: JSON.stringify({ user_id: userId, mark_all: true }),
      });
    } catch {}
  },

  addNotification: (n: Notification) => {
    set((state) => ({
      notifications: [n, ...state.notifications].slice(0, 50),
      unreadCount: state.unreadCount + (n.read ? 0 : 1),
    }));
  },

  createNotification: async (payload) => {
    try {
      const res = await fetch("/api/notifications", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify(payload),
      });
      if (!res.ok) return null;

      const json = await res.json();
      if (json.data) {
        get().addNotification(json.data);
      }
      return json.data ?? null;
    } catch {
      return null;
    }
  },

  startPolling: (userId: string) => {
    const existing = get().polling;
    if (existing) clearInterval(existing);

    get().fetchNotifications(userId);

    const interval = setInterval(() => {
      get().fetchNotifications(userId);
    }, 30_000);

    set({ polling: interval });
  },

  stopPolling: () => {
    const interval = get().polling;
    if (interval) {
      clearInterval(interval);
      set({ polling: null });
    }
  },
}));
