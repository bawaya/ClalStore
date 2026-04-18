"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell, ChevronDown, ChevronUp } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { timeAgo } from "@/lib/utils";

type Priority = "urgent" | "high" | "normal" | "low" | string;

type Announcement = {
  id: number;
  title: string;
  body: string;
  priority: Priority;
  target: string;
  created_by: string | null;
  expires_at: string | null;
  created_at: string;
  read: boolean;
};

function priorityStyles(p: Priority): { border: string; dot: string; label: string } {
  switch (p) {
    case "urgent":
      return { border: "border-rose-500/40 bg-rose-500/5", dot: "bg-rose-500", label: "عاجل" };
    case "high":
      return { border: "border-amber-500/40 bg-amber-500/5", dot: "bg-amber-500", label: "مهم" };
    case "normal":
      return { border: "border-slate-500/40 bg-slate-500/5", dot: "bg-slate-400", label: "عادي" };
    case "low":
      return { border: "border-white/10 bg-white/5", dot: "bg-slate-500", label: "منخفض" };
    default:
      return { border: "border-white/10 bg-white/5", dot: "bg-slate-500", label: String(p) };
  }
}

function isExpired(a: Announcement): boolean {
  if (!a.expires_at) return false;
  try {
    return new Date(a.expires_at).getTime() < Date.now();
  } catch {
    return false;
  }
}

export default function AnnouncementsPage() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/employee/announcements", { credentials: "same-origin" });
      const json: unknown = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((json as { error?: string } | undefined)?.error || "فشل التحميل");
      const list = (json as { announcements?: Announcement[] }).announcements;
      const sorted = [...(Array.isArray(list) ? list : [])].sort((a, b) => {
        if (a.read !== b.read) return a.read ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setItems(sorted);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function open(a: Announcement) {
    const next = expanded === a.id ? null : a.id;
    setExpanded(next);
    if (next !== null && !a.read) {
      // Optimistic local update
      setItems((prev) => prev.map((x) => (x.id === a.id ? { ...x, read: true } : x)));
      try {
        await fetch(`/api/employee/announcements/${a.id}/read`, {
          method: "POST",
          headers: csrfHeaders(),
          credentials: "same-origin",
        });
      } catch {
        /* ignore — will retry on next visit */
      }
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-rose-300" aria-hidden />
          <div>
            <div className="text-sm font-bold">الإعلانات · הודעות</div>
            <div className="text-[11px] text-slate-400">رسائل من الإدارة</div>
          </div>
        </div>
      </section>

      {loading && <div className="text-sm text-slate-400">جاري التحميل…</div>}
      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          لا توجد إعلانات.
        </div>
      )}

      <ul className="space-y-2">
        {items.map((a) => {
          const p = priorityStyles(a.priority);
          const expired = isExpired(a);
          const isOpen = expanded === a.id;
          return (
            <li
              key={a.id}
              className={`rounded-2xl border p-4 transition ${p.border} ${
                expired ? "opacity-60" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => open(a)}
                aria-expanded={isOpen}
                className="flex w-full items-start justify-between gap-3 text-right"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-[10px] text-slate-400">
                    <span className={`inline-block h-2 w-2 rounded-full ${p.dot}`} aria-hidden />
                    <span>{p.label}</span>
                    <span>·</span>
                    <span>{timeAgo(a.created_at)}</span>
                    {expired && (
                      <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] text-slate-300">
                        منتهي
                      </span>
                    )}
                    {!a.read && (
                      <span
                        aria-label="غير مقروء"
                        className="inline-block h-2 w-2 rounded-full bg-rose-500"
                      />
                    )}
                  </div>
                  <div className={`mt-1 text-sm ${a.read ? "font-medium text-slate-200" : "font-black text-white"}`}>
                    {a.title}
                  </div>
                </div>
                <span aria-hidden className="shrink-0 text-slate-400">
                  {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </span>
              </button>
              {isOpen && (
                <div className="mt-3 whitespace-pre-wrap border-t border-white/10 pt-3 text-sm text-slate-200">
                  {a.body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
