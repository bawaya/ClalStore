"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { StatCard, ToastContainer } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";

interface BridgeData {
  month: string;
  commissions: {
    lines_count: number;
    lines_commission: number;
    device_sales: number;
    devices_commission: number;
    milestones: number;
    sanctions_total: number;
    loyalty_bonus: number;
    net_commission: number;
  };
  crm: {
    total_orders: number;
    delivered_orders: number;
    synced_orders: number;
    unsynced_orders: number;
    total_revenue: number;
  };
  leaderboard: { name: string; lines: number; devices: number; commission: number }[];
  sync_gaps: { order_id: string; status: string; total: number; created_at: string }[];
  today: { sales: number; commission: number; lines: number; devices_revenue: number };
}

export default function LiveDashboard() {
  const scr = useScreen();
  const { toasts, show: toast } = useToast();
  const [data, setData] = useState<BridgeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/commissions/bridge?view=dashboard&month=${month}`);
      if (!res.ok) throw new Error("HTTP " + res.status);
      const json = await res.json();
      if (!json.success) throw new Error(json.error || "API Error");
      setData(json.data);
      setLastUpdate(new Date().toLocaleTimeString("ar-EG"));
    } catch (e: any) {
      toast("خطأ: " + e.message, "error");
    } finally {
      setLoading(false);
    }
  }, [month, toast]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchData, 30_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchData]);

  const cm = data?.commissions;
  const crm = data?.crm;

  return (
    <div className="space-y-4">
      <ToastContainer toasts={toasts} />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-bold">📊 לוח חי — CRM ↔ עמלות</h1>
          <p className="text-xs text-gray-400">
            {lastUpdate ? `עדכון אחרון: ${lastUpdate}` : "טוען..."}
            {autoRefresh && " • רענון אוטומטי כל 30 שניות"}
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="month"
            value={month}
            onChange={(e) => { setMonth(e.target.value); setLoading(true); }}
            className="input"
            style={{ width: 160, fontSize: 12, padding: "6px 10px" }}
          />
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`chip ${autoRefresh ? "chip-active" : ""}`}
            style={{ fontSize: 11 }}
          >
            {autoRefresh ? "⏸ עצור" : "▶ רענון"}
          </button>
          <button onClick={fetchData} className="chip" style={{ fontSize: 11 }}>🔄</button>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
        <Link href="/admin/commissions/team" className="chip">צוות</Link>
        <Link href="/admin/commissions/live" className="chip chip-active">📊 לוח חי</Link>
      </div>

      {loading && !data ? (
        <div className="text-center py-10 text-gray-400">⏳ טוען נתונים...</div>
      ) : !data ? (
        <div className="text-center py-10 text-red-400">❌ לא ניתן לטעון נתונים</div>
      ) : (
        <>
          {/* Today Stats */}
          <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
            <StatCard icon="🔥" label="מכירות היום" value={String(data.today.sales)} color="#FF0050" />
            <StatCard icon="💰" label="עמלות היום" value={formatCurrency(data.today.commission)} color="#22c55e" />
            <StatCard icon="📡" label="קווים היום" value={String(data.today.lines)} color="#3b82f6" />
            <StatCard icon="📱" label="מכשירים היום" value={formatCurrency(data.today.devices_revenue)} color="#ff9100" />
          </div>

          {/* Commission Summary */}
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-3">💰 סיכום עמלות — {month}</h3>
            <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr" }}>
              <StatCard icon="📡" label="עמלות קווים" value={formatCurrency(cm!.lines_commission)} sub={`${cm!.lines_count} קווים`} color="#3b82f6" />
              <StatCard icon="📱" label="עמלות מכשירים" value={formatCurrency(cm!.devices_commission)} sub={formatCurrency(cm!.device_sales) + " מכירות"} color="#22c55e" />
              <StatCard icon="🎯" label="בונוס אבני דרך" value={`${cm!.milestones} × ₪2,500`} color="#ffd600" />
              <StatCard icon="❤️" label="בונוס נאמנות" value={formatCurrency(cm!.loyalty_bonus)} color="#ff9100" />
              <StatCard icon="⚠️" label="סנקציות" value={`-${formatCurrency(cm!.sanctions_total)}`} color="#ef4444" />
              <StatCard icon="🏆" label="נטו" value={formatCurrency(cm!.net_commission)} color="#22c55e" />
            </div>
          </div>

          {/* CRM Status */}
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-3">📦 סטטוס הזמנות CRM</h3>
            {crm!.unsynced_orders > 0 && (
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-3 mb-3 text-sm flex items-center gap-3">
                <span className="text-2xl font-black text-red-400">{crm!.unsynced_orders}</span>
                <span>הזמנות שהושלמו <strong>ללא סנכרון</strong> עם מערכת העמלות</span>
              </div>
            )}
            {crm!.unsynced_orders === 0 && (
              <div className="bg-green-900/30 border border-green-700 rounded-lg p-3 mb-3 text-sm text-green-400">
                ✅ כל ההזמנות מסונכרנות
              </div>
            )}
            <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
              <StatCard icon="📦" label="סה״כ הזמנות" value={String(crm!.total_orders)} color="#a78bfa" />
              <StatCard icon="✅" label="הושלמו" value={String(crm!.delivered_orders)} color="#22c55e" />
              <StatCard icon="🔄" label="מסונכרנות" value={String(crm!.synced_orders)} color="#3b82f6" />
              <StatCard icon="💵" label="הכנסות" value={formatCurrency(crm!.total_revenue)} color="#ffd600" />
            </div>
          </div>

          {/* Leaderboard */}
          {data.leaderboard.length > 0 && (
            <div className="card p-4">
              <h3 className="font-bold text-sm mb-3">🏆 טבלת מובילים</h3>
              <div className="space-y-2">
                {data.leaderboard.slice(0, 8).map((e, i) => (
                  <div
                    key={e.name}
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{
                      background: i === 0 ? "#3a2a00" : i === 1 ? "#2a2a30" : i === 2 ? "#2a1a00" : "#1a1a24",
                      border: `1px solid ${i === 0 ? "#664400" : i === 1 ? "#444" : i === 2 ? "#553300" : "#2a2a3a"}`,
                    }}
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-black text-sm"
                      style={{
                        background: i === 0 ? "#ffd600" : i === 1 ? "#aaa" : i === 2 ? "#cd7f32" : "#333",
                        color: i < 3 ? "#000" : "#888",
                      }}
                    >
                      {i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="font-bold text-sm">{e.name}</div>
                      <div className="text-xs text-gray-400">{e.lines} קווים • {e.devices} מכשירים</div>
                    </div>
                    <div className="font-black text-green-400">{formatCurrency(e.commission)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Sync Gaps */}
          {data.sync_gaps.length > 0 && (
            <div className="card p-4">
              <h3 className="font-bold text-sm mb-3 text-red-400">⚠️ הזמנות לא מסונכרנות ({data.sync_gaps.length})</h3>
              <div className="space-y-1">
                {data.sync_gaps.slice(0, 10).map((g) => (
                  <div key={g.order_id} className="flex items-center justify-between p-2 bg-red-900/20 rounded text-xs">
                    <span className="font-mono">{g.order_id}</span>
                    <span>{g.status}</span>
                    <span>{formatCurrency(g.total)}</span>
                    <span className="text-gray-400">{new Date(g.created_at).toLocaleDateString("he-IL")}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Device Milestones */}
          <div className="card p-4">
            <h3 className="font-bold text-sm mb-3">🎯 אבני דרך מכשירים (₪2,500 לכל 50K)</h3>
            <div className="space-y-2">
              {[50000, 100000, 150000, 200000, 250000, 300000].map((ms) => {
                const done = cm!.device_sales >= ms;
                const pct = Math.min(100, Math.round((cm!.device_sales / ms) * 100));
                return (
                  <div key={ms} className="flex items-center gap-3 text-xs">
                    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${done ? "bg-green-500" : "bg-gray-600"}`} />
                    <div className="flex-1">
                      <div className="flex justify-between mb-1">
                        <span className="font-bold">{formatCurrency(ms)}</span>
                        <span className={done ? "text-green-400" : "text-gray-400"}>
                          {done ? "✅ הושג" : `${formatCurrency(ms - cm!.device_sales)} נותרו`}
                        </span>
                      </div>
                      <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-1000"
                          style={{ width: `${done ? 100 : pct}%`, background: done ? "#22c55e" : "#ffd600" }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
