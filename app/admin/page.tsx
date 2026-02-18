"use client";

import { useState, useEffect } from "react";
import { useScreen } from "@/lib/hooks";
import { StatCard } from "@/components/admin/shared";
import { ORDER_STATUS, ORDER_SOURCE } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";

interface Stats {
  totalRevenue: number; totalOrders: number; newOrders: number; noReply: number;
  totalProducts: number; lowStock: number; outOfStock: number;
  totalCustomers: number; vipCustomers: number;
  sources: Record<string, number>; statuses: Record<string, number>;
  recentOrders: any[]; topProducts: any[];
  botTotal: number; botEscalated: number;
}

export default function AdminDashboard() {
  const scr = useScreen();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const [dashRes, prodRes, botRes] = await Promise.all([
          fetch("/api/crm/dashboard"),
          fetch("/api/admin/products"),
          fetch("/api/crm/chats?stats=true").catch(() => null),
        ]);
        const dash = await dashRes.json();
        const products = await prodRes.json();
        const botStats = botRes ? await botRes.json().catch(() => ({})) : {};

        const productList = Array.isArray(products) ? products : (products.data || []);
        const totalProducts = productList.length;
        const lowStock = productList.filter((p: any) => p.stock > 0 && p.stock <= 5).length;
        const outOfStock = productList.filter((p: any) => p.stock === 0).length;

        // Top 5 best-selling products
        const topProducts = [...productList]
          .sort((a: any, b: any) => (b.sold || 0) - (a.sold || 0))
          .slice(0, 5);

        const noReply = (dash.byStatus?.no_reply_1 || 0) + (dash.byStatus?.no_reply_2 || 0) + (dash.byStatus?.no_reply_3 || 0);

        setStats({
          totalRevenue: dash.revenue || 0,
          totalOrders: dash.totalOrders || 0,
          newOrders: dash.newCount || 0,
          noReply,
          totalProducts,
          lowStock,
          outOfStock,
          totalCustomers: dash.totalCustomers || 0,
          vipCustomers: dash.vipCount || 0,
          sources: dash.bySource || {},
          statuses: dash.byStatus || {},
          recentOrders: (dash.recentOrders || []).slice(0, 5),
          topProducts,
          botTotal: botStats.total || 0,
          botEscalated: botStats.escalated || 0,
        });
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;
  if (!stats) return null;

  const gridCols = scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr";

  return (
    <div>
      <h1 className="font-black mb-4" style={{ fontSize: scr.mobile ? 16 : 22 }}>📊 داشبورد</h1>

      {/* Stats grid */}
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: gridCols }}>
        <StatCard icon="💰" label="الإيرادات" value={formatCurrency(stats.totalRevenue)} color="#22c55e" />
        <StatCard icon="📦" label="الطلبات" value={stats.totalOrders} sub={`${stats.newOrders} جديد`} />
        <StatCard icon="👥" label="الزبائن" value={stats.totalCustomers} sub={`${stats.vipCustomers} VIP`} />
        <StatCard icon="📱" label="المنتجات" value={stats.totalProducts} sub={`${stats.lowStock} مخزون منخفض`} />
      </div>

      {/* Bot stats row */}
      {stats.botTotal > 0 && (
        <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
          <StatCard icon="🤖" label="محادثات البوت" value={stats.botTotal} color="#a855f7" />
          <StatCard icon="👤" label="تحويل لموظف" value={stats.botEscalated} color="#f97316" />
        </div>
      )}

      {/* Alerts */}
      {(stats.newOrders > 0 || stats.noReply > 0 || stats.outOfStock > 0) && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>⚡ تنبيهات</h3>
          <div className="space-y-1.5">
            {stats.newOrders > 0 && (
              <div className="flex items-center justify-between bg-state-info/10 rounded-xl px-3 py-2">
                <span className="text-state-info font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>🆕 {stats.newOrders}</span>
                <span className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>طلبات جديدة بانتظار المراجعة</span>
              </div>
            )}
            {stats.noReply > 0 && (
              <div className="flex items-center justify-between bg-state-orange/10 rounded-xl px-3 py-2">
                <span className="text-state-orange font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>📞 {stats.noReply}</span>
                <span className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>طلبات بدون رد</span>
              </div>
            )}
            {stats.outOfStock > 0 && (
              <div className="flex items-center justify-between bg-state-error/10 rounded-xl px-3 py-2">
                <span className="text-state-error font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>❌ {stats.outOfStock}</span>
                <span className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>منتجات نفذت من المخزون</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent orders + Top products side by side */}
      <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }}>
        {/* Recent 5 orders */}
        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📦 أحدث الطلبات</h3>
          {stats.recentOrders.length === 0 ? (
            <div className="text-center py-4 text-dim text-xs">لا يوجد طلبات بعد</div>
          ) : (
            stats.recentOrders.map((o: any) => {
              const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
              return (
                <div key={o.id} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-md" style={{ background: `${st?.color || "#3f3f46"}15`, color: st?.color || "#3f3f46" }}>
                      {st?.icon} {st?.label || o.status}
                    </span>
                    <span className="text-brand font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>{formatCurrency(o.total)}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>{o.id}</span>
                    <span className="text-muted text-[9px] mr-1.5">{timeAgo(o.created_at)}</span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Top 5 best selling */}
        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>🏆 أكثر المنتجات مبيعاً</h3>
          {stats.topProducts.length === 0 ? (
            <div className="text-center py-4 text-dim text-xs">لا يوجد بيانات بعد</div>
          ) : (
            stats.topProducts.map((p: any, i: number) => (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-surface-border last:border-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-muted text-[10px]">{p.sold || 0} مبيع</span>
                  <span className="text-brand font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>{formatCurrency(p.price)}</span>
                </div>
                <div className="text-right flex items-center gap-1">
                  <span className="font-bold" style={{ fontSize: scr.mobile ? 10 : 12 }}>{p.name_ar}</span>
                  <span className="text-muted text-xs">{["🥇", "🥈", "🥉", "4️⃣", "5️⃣"][i]}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Status + Source distribution */}
      <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }}>
        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📋 حالات الطلبات</h3>
          {Object.entries(stats.statuses).map(([key, count]) => {
            const s = ORDER_STATUS[key as keyof typeof ORDER_STATUS];
            if (!s || count === 0) return null;
            const pct = stats.totalOrders > 0 ? Math.round((count / stats.totalOrders) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-2 mb-1.5">
                <span className="text-right w-20 text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>{s.icon} {s.label}</span>
                <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <span className="font-bold w-6 text-left" style={{ fontSize: scr.mobile ? 10 : 12 }}>{count}</span>
              </div>
            );
          })}
        </div>

        <div className="card flex-1 mb-3" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: scr.mobile ? 12 : 14 }}>📡 مصادر الطلبات</h3>
          {Object.entries(stats.sources).map(([key, count]) => {
            const s = ORDER_SOURCE[key as keyof typeof ORDER_SOURCE];
            if (!s || count === 0) return null;
            const pct = stats.totalOrders > 0 ? Math.round((count / stats.totalOrders) * 100) : 0;
            return (
              <div key={key} className="flex items-center gap-2 mb-1.5">
                <span className="text-right w-20 text-muted truncate" style={{ fontSize: scr.mobile ? 9 : 11 }}>{s.icon} {s.label}</span>
                <div className="flex-1 h-2 bg-surface-elevated rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, background: s.color }} />
                </div>
                <span className="font-bold w-6 text-left" style={{ fontSize: scr.mobile ? 10 : 12 }}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
