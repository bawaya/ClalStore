"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bell, Check, CheckCheck, ExternalLink, X } from "lucide-react";
import { useNotifications } from "@/lib/notifications";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/database";

const TYPE_STYLES: Record<
  Notification["type"],
  { bg: string; text: string; ring: string }
> = {
  order: {
    bg: "bg-emerald-500/10",
    text: "text-emerald-400",
    ring: "ring-emerald-500/20",
  },
  message: {
    bg: "bg-blue-500/10",
    text: "text-blue-400",
    ring: "ring-blue-500/20",
  },
  alert: {
    bg: "bg-amber-500/10",
    text: "text-amber-400",
    ring: "ring-amber-500/20",
  },
  info: {
    bg: "bg-zinc-500/10",
    text: "text-zinc-400",
    ring: "ring-zinc-500/20",
  },
  task: {
    bg: "bg-purple-500/10",
    text: "text-purple-400",
    ring: "ring-purple-500/20",
  },
};

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `${mins} د`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} س`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ي`;
  return new Date(date).toLocaleDateString("ar-EG", {
    month: "short",
    day: "numeric",
  });
}

interface NotificationBellProps {
  userId: string;
}

export default function NotificationBell({ userId }: NotificationBellProps) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const {
    notifications,
    unreadCount,
    loading,
    fetchNotifications,
    markAsRead,
    markAllRead,
    startPolling,
    stopPolling,
  } = useNotifications();

  useEffect(() => {
    if (!userId) return;
    startPolling(userId);
    return () => stopPolling();
  }, [userId, startPolling, stopPolling]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        panelRef.current &&
        !panelRef.current.contains(e.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  const handleToggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev && userId) fetchNotifications(userId);
      return !prev;
    });
  }, [userId, fetchNotifications]);

  const handleNotificationClick = useCallback(
    (notif: Notification) => {
      if (!notif.read) {
        markAsRead(notif.id);
      }
      if (notif.link) {
        window.location.href = notif.link;
        setOpen(false);
      }
    },
    [markAsRead]
  );

  const handleMarkAllRead = useCallback(() => {
    if (userId) markAllRead(userId);
  }, [userId, markAllRead]);

  return (
    <div className="relative">
      {/* Bell Button */}
      <button
        ref={buttonRef}
        onClick={handleToggle}
        className={cn(
          "relative flex h-10 w-10 items-center justify-center rounded-xl",
          "bg-glass-bg border border-glass-border backdrop-blur-sm",
          "transition-all duration-200 hover:bg-glass-hover hover:border-surface-border",
          "focus:outline-none focus:ring-2 focus:ring-brand/30",
          open && "bg-glass-hover border-surface-border"
        )}
        aria-label={`الإشعارات${unreadCount > 0 ? ` (${unreadCount} غير مقروءة)` : ""}`}
      >
        <Bell
          className={cn(
            "h-[18px] w-[18px] transition-colors",
            unreadCount > 0 ? "text-brand-light" : "text-muted"
          )}
        />

        {unreadCount > 0 && (
          <span
            className={cn(
              "absolute -top-1 -left-1 flex items-center justify-center",
              "min-w-[18px] h-[18px] px-1 rounded-full",
              "bg-brand text-white text-[10px] font-bold leading-none",
              "animate-scale-in shadow-glass-glow"
            )}
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {open && (
        <div
          ref={panelRef}
          className={cn(
            "absolute left-0 top-full mt-2 z-modal",
            "w-[360px] max-h-[480px] flex flex-col",
            "rounded-2xl border border-glass-border",
            "bg-surface-card/95 backdrop-blur-xl",
            "shadow-glass-lg",
            "animate-scale-in origin-top-left"
          )}
          role="dialog"
          aria-label="لوحة الإشعارات"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-white">الإشعارات</h3>
              {unreadCount > 0 && (
                <span className="flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-brand/15 text-brand-light text-[11px] font-medium">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] text-muted hover:text-white hover:bg-glass-hover transition-colors"
                  title="تعيين الكل كمقروء"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>قراءة الكل</span>
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="flex items-center justify-center h-7 w-7 rounded-lg text-muted hover:text-white hover:bg-glass-hover transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="flex-1 overflow-y-auto overscroll-contain custom-scrollbar">
            {loading && notifications.length === 0 ? (
              <div className="flex items-center justify-center py-12">
                <div className="h-5 w-5 border-2 border-brand/30 border-t-brand rounded-full animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <div className="flex items-center justify-center h-12 w-12 rounded-full bg-glass-bg border border-glass-border mb-3">
                  <Bell className="h-5 w-5 text-muted" />
                </div>
                <p className="text-sm text-muted">لا توجد إشعارات</p>
              </div>
            ) : (
              <div className="py-1">
                {notifications.map((notif) => {
                  const style = TYPE_STYLES[notif.type] ?? TYPE_STYLES.info;

                  return (
                    <button
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={cn(
                        "w-full flex items-start gap-3 px-4 py-3 text-right",
                        "transition-colors duration-150",
                        "hover:bg-glass-hover",
                        !notif.read && "bg-glass-subtle"
                      )}
                    >
                      {/* Icon */}
                      <div
                        className={cn(
                          "flex-shrink-0 flex items-center justify-center",
                          "h-9 w-9 rounded-xl ring-1",
                          style.bg,
                          style.ring
                        )}
                      >
                        <span className="text-base leading-none">
                          {notif.icon}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              "text-[13px] leading-snug truncate",
                              notif.read
                                ? "text-zinc-400 font-normal"
                                : "text-white font-medium"
                            )}
                          >
                            {notif.title}
                          </p>
                          <span className="flex-shrink-0 text-[10px] text-muted mt-0.5">
                            {timeAgo(notif.created_at)}
                          </span>
                        </div>

                        {notif.body && (
                          <p className="text-[12px] text-muted leading-relaxed mt-0.5 truncate">
                            {notif.body}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-1">
                          <span
                            className={cn(
                              "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium",
                              style.bg,
                              style.text
                            )}
                          >
                            {notif.type}
                          </span>
                          {notif.link && (
                            <ExternalLink className="h-3 w-3 text-dim" />
                          )}
                          {notif.read && (
                            <Check className="h-3 w-3 text-dim" />
                          )}
                        </div>
                      </div>

                      {/* Unread dot */}
                      {!notif.read && (
                        <div className="flex-shrink-0 mt-2">
                          <div className="h-2 w-2 rounded-full bg-brand shadow-glass-glow" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
