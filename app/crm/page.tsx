"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useScreen } from "@/lib/hooks";
import { StatCard } from "@/components/admin/shared";
import { ORDER_STATUS, ORDER_SOURCE } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";

export default function CRMDashboard() {
  const scr = useScreen();
  const [data, setData] = useState<any>(null);
  const [inboxStats, setInboxStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const dashRes = await fetch("/api/crm/dashboard");
        if (!dashRes.ok) {
          const err = await dashRes.json().catch(() => ({}));
          throw new Error(err.error || "خطأ في جلب البيانات");
        }
        const dashboard = await dashRes.json();
        setData(dashboard);

        try {
          const inboxRes = await fetch("/api/crm/inbox/stats");
          if (!inboxRes.ok) throw new Error("inbox stats failed");
          const inbox = await inboxRes.json();
          if (inbox?.success) setInboxStats(inbox.stats);
        } catch { /* inbox stats are optional */ }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : "خطأ في التحميل");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;
  if (error) return <div className="text-center py-20 text-red-400">⚠️ {error}</div>;
  if (!data) return null;

  const gridCols = scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr";

  return (
    <div>
      <h1 className="font-black mb-4" style={{ fontSize: scr.mobile ? 16 : 22 }}>📊 داشبورد CRM</h1>

      {/* Stats */}
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: gridCols }}>
        <StatCard icon="💰" label="الإيرادات" value={formatCurrency(data.revenue)} color="#22c55e" />
        <StatCard icon="📦" label="الطلبات" value={data.totalOrders} sub={`${data.newCount} جديد`} />
        <StatCard icon="👥" label="الزبائن" value={data.totalCustomers} sub={`${data.vipCount} VIP`} />
        <StatCard icon="🎯" label="Pipeline" value={formatCurrency(data.pipelineValue)} sub={`${data.pipelineDeals} صفقة`} />
      </div>

      {/* Inbox Stats */}
      {inboxStats && (
        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: gridCols }}>
          <Link href="/crm/inbox?status=active" className="card p-3 hover:border-green-500/40 transition-colors">
            <p className="text-[10px] text-muted">💬 نشطة</p>
            <p className="text-lg font-black text-green-400">{inboxStats.active || 0}</p>
          </Link>
          <Link href="/crm/inbox?status=waiting" className="card p-3 hover:border-yellow-500/40 transition-colors">
            <p className="text-[10px] text-muted">⏳ بانتظار</p>
            <p className="text-lg font-black text-yellow-400">{inboxStats.waiting || 0}</p>
          </Link>
          <div className="card p-3">
            <p className="text-[10px] text-muted">✅ أُنجز اليوم</p>
            <p className="text-lg font-black text-blue-400">{inboxStats.resolved_today || 0}</p>
          </div>
          <div className="card p-3">
            <p className="text-[10px] text-muted">✉️ رسائل اليوم</p>
            <p className="text-lg font-black">{inboxStats.messages_today || 0}</p>
          </div>
          {inboxStats.resolution_rate != null && (
            <div className="card p-3">
              <p className="text-[10px] text-muted">✅ معدل الحل</p>
              <p className="text-lg font-black">{inboxStats.resolution_rate}%</p>
            </div>
          )}
          {inboxStats.avg_response_time != null && (
            <div className="card p-3">
              <p className="text-[10px] text-muted">⏱️ متوسط الرد (د)</p>
              <p className="text-lg font-black">{inboxStats.avg_response_time}</p>
            </div>
          )}
        </div>
      )}

      {/* Suggested follow-ups */}
      {data.suggestedFollowups && data.suggestedFollowups.length > 0 && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📞 اقتراحات للمتابعة</h3>
          <div className="space-y-1.5">
            {data.suggestedFollowups.slice(0, 8).map((c: any) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-surface-elevated">
                <a href={c.phone ? `https://wa.me/972${c.phone.replace(/\D/g, "").replace(/^0/, "")}` : "#"} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded-lg bg-[#25D366] text-white text-[10px] font-bold cursor-pointer">
                  تواصل
                </a>
                <div className="text-right flex-1 mr-2">
                  <div className="font-bold text-sm">{c.name}</div>
                  <div className="text-muted text-[10px]">{c.phone || "—"} • آخر طلب: {c.last_order_at ? new Date(c.last_order_at).toLocaleDateString("ar-EG") : "لم يطلب"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Alerts */}
      {data.alerts.length > 0 && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>⚡ تنبيهات ذكية</h3>
          <div className="space-y-1.5">
            {data.alerts.map((a: any, i: number) => (
              <div key={i} className="flex items-center justify-between rounded-xl px-3 py-2"
                style={{ background: `${a.color}15` }}>
                <span className="font-bold" style={{ fontSize: scr.mobile ? 10 : 12, color: a.color }}>{a.count}</span>
                <span className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>{a.msg}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Charts row */}
      <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }}>
        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📋 توزيع الحالات</h3>
          {Object.entries(data.byStatus || {}).map(([key, count]) => {
            const s = ORDER_STATUS[key as keyof typeof ORDER_STATUS];
            if (!s) return null;
            const pct = Math.round(((count as number) / Math.max(data.totalOrders, 1)) * 100);
            return (
              <Link key={key} href={`/crm/orders?status=${key}`} className="flex items-center gap-2 mb-1.5 hover:opacity-80">
                <span className="text-right w-24 text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>{s.icon} {s.label}</span>
                <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <span className="font-bold w-6 text-left" style={{ fontSize: scr.mobile ? 10 : 12 }}>{count as number}</span>
              </Link>
            );
          })}
        </div>

        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📡 المصادر</h3>
          {Object.entries(data.bySource || {}).map(([key, count]) => {
            const s = ORDER_SOURCE[key as keyof typeof ORDER_SOURCE];
            if (!s) return null;
            const pct = Math.round(((count as number) / Math.max(data.totalOrders, 1)) * 100);
            return (
              <div key={key} className="flex items-center gap-2 mb-1.5">
                <span className="text-right w-24 text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>{s.icon} {s.label}</span>
                <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <span className="font-bold w-6 text-left" style={{ fontSize: scr.mobile ? 10 : 12 }}>{count as number}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent orders */}
      <div className="card" style={{ padding: scr.mobile ? 12 : 18 }}>
        <div className="flex items-center justify-between mb-2">
          <Link href="/crm/orders" className="text-brand text-xs font-bold">عرض الكل →</Link>
          <h3 className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>📦 آخر الطلبات</h3>
        </div>
        {(data.recentOrders || []).map((o: any) => {
          const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
          const src = ORDER_SOURCE[o.source as keyof typeof ORDER_SOURCE];
          return (
            <Link key={o.id} href={`/crm/orders?search=${o.id}`}
              className="flex items-center justify-between py-2 border-b border-surface-border last:border-0 hover:bg-surface-elevated/50 px-1 rounded-lg">
              <span className="font-bold text-brand" style={{ fontSize: scr.mobile ? 12 : 14 }}>₪{Number(o.total).toLocaleString()}</span>
              <div className="flex-1 text-right mx-2">
                <span className="font-bold" style={{ fontSize: scr.mobile ? 11 : 13 }}>{o.id}</span>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 8 : 10 }}>
                  {st && <span style={{ color: st.color }}>{st.icon} {st.label}</span>}
                  {src && <span className="mr-1.5">{src.icon}</span>}
                  <span className="mr-1.5">{timeAgo(o.created_at)}</span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
