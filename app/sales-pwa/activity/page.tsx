"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  DollarSign,
  XCircle,
  AlertTriangle,
  Target,
  Trophy,
  FileEdit,
  CheckCircle2,
  Circle,
} from "lucide-react";
import { timeAgo } from "@/lib/utils";

type Activity = {
  id: number;
  event_type: string;
  title: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type ActivityResponse = {
  activities: Activity[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

const PAGE = 50;

function eventMeta(type: string): { Icon: typeof Circle; ringCls: string; bgCls: string } {
  switch (type) {
    case "sale_registered":
      return { Icon: DollarSign, ringCls: "ring-emerald-500/40", bgCls: "bg-emerald-500/15 text-emerald-300" };
    case "sale_cancelled":
      return { Icon: XCircle, ringCls: "ring-rose-500/40", bgCls: "bg-rose-500/15 text-rose-300" };
    case "sanction_added":
      return { Icon: AlertTriangle, ringCls: "ring-amber-500/40", bgCls: "bg-amber-500/15 text-amber-300" };
    case "target_set":
    case "target_updated":
      return { Icon: Target, ringCls: "ring-sky-500/40", bgCls: "bg-sky-500/15 text-sky-300" };
    case "milestone_reached":
      return { Icon: Trophy, ringCls: "ring-amber-500/40", bgCls: "bg-amber-500/15 text-amber-300" };
    case "correction_submitted":
      return { Icon: FileEdit, ringCls: "ring-violet-500/40", bgCls: "bg-violet-500/15 text-violet-300" };
    case "correction_resolved":
      return { Icon: CheckCircle2, ringCls: "ring-violet-500/40", bgCls: "bg-violet-500/15 text-violet-300" };
    default:
      return { Icon: Circle, ringCls: "ring-slate-500/40", bgCls: "bg-slate-500/15 text-slate-300" };
  }
}

export default function ActivityPage() {
  const [items, setItems] = useState<Activity[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const sentinel = useRef<HTMLDivElement | null>(null);

  const loadMore = useCallback(
    async (reset = false) => {
      if (loading) return;
      setLoading(true);
      setError("");
      const nextOffset = reset ? 0 : offset;
      try {
        const res = await fetch(`/api/employee/activity?limit=${PAGE}&offset=${nextOffset}`, {
          credentials: "same-origin",
        });
        const json: unknown = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error((json as { error?: string } | undefined)?.error || "فشل التحميل");
        const data = json as Partial<ActivityResponse>;
        const list = Array.isArray(data.activities) ? data.activities : [];
        setItems((prev) => (reset ? list : [...prev, ...list]));
        setOffset(nextOffset + list.length);
        setHasMore(Boolean(data.hasMore));
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "خطأ");
      } finally {
        setLoading(false);
      }
    },
    [loading, offset],
  );

  // Initial load
  useEffect(() => {
    loadMore(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting) && hasMore && !loading) {
          loadMore();
        }
      },
      { rootMargin: "200px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, loading, loadMore]);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
        <div className="text-sm font-bold">سجل النشاط · פעילות</div>
        <div className="text-[11px] text-slate-400">كل الأحداث الخاصة بحسابك</div>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </div>
      )}

      {!loading && items.length === 0 && !error && (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-slate-300">
          لا يوجد نشاط بعد.
        </div>
      )}

      <ol className="relative space-y-3 border-r border-white/10 pr-5">
        {items.map((a) => {
          const meta = eventMeta(a.event_type);
          const Icon = meta.Icon;
          return (
            <li key={a.id} className="relative">
              <span
                aria-hidden
                className={`absolute -right-[30px] top-1.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ${meta.ringCls} ${meta.bgCls}`}
              >
                <Icon className="h-3 w-3" />
              </span>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-bold">{a.title}</div>
                    {a.description && (
                      <div className="mt-0.5 text-xs text-slate-300">{a.description}</div>
                    )}
                  </div>
                  <time className="shrink-0 text-[11px] text-slate-400">{timeAgo(a.created_at)}</time>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      <div ref={sentinel} />

      {loading && <div className="text-center text-sm text-slate-400">جاري التحميل…</div>}
      {!hasMore && items.length > 0 && (
        <div className="text-center text-xs text-slate-500">— نهاية السجل —</div>
      )}
    </div>
  );
}
