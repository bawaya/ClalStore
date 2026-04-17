"use client";

// ═══════════════════════════════════════════════════════════
// Command Center v3 — White-Label Professional Edition
// Usage: <CommandCenter config={CLALMOBILE_CONFIG} />
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, BarChart, Bar, CartesianGrid, Legend,
  ComposedChart, Line,
} from "recharts";
import type { BrandConfig } from "@/lib/brand-config";
import { csrfHeaders } from "@/lib/csrf-client";
import type { CRMData, InboxData, TaskItem, AnalyticsData, TxItem, ExpenseItem, MonthlyRow } from "./command-center/types";
import {
  GOLD, CYAN, DARK, CARD, CARD2, BORDER, TEXT, MUTED, RED, GREEN, PURPLE,
  BRAND_DEFAULT, TEAL_DEFAULT,
  DEMO_CRM, DEMO_INBOX, DEMO_TASKS, DEMO_ANALYTICS, DEMO_EXPENSES, DEMO_MONTHLY,
  DEMO_TRANSACTIONS, REVENUE_STREAMS,
  STATUS_COLORS, STATUS_LABELS, SOURCE_LABELS, SOURCE_COLORS,
  PRIORITY_COLORS, PRIORITY_LABELS,
} from "./command-center/data";
import { GlowCard, Badge, Dot, CTooltip, CTooltipPlain, AnimNum, SectionHeader } from "./command-center/ui";

// ── Main Component ──

export default function CommandCenter({ config: brandConfig }: { config?: Partial<BrandConfig> }) {
  const brand: Partial<BrandConfig> = brandConfig || {};
  const APP_NAME = brand.name || "Command Center";
  const APP_LOGO = brand.logo || "C";
  const BRAND = brand.colors?.brand || BRAND_DEFAULT;
  const TEAL = brand.colors?.teal || TEAL_DEFAULT;
  const showInbox = brand.features?.inbox !== false;
  const showFinance = brand.features?.finance !== false;
  const showAnalytics = brand.features?.analytics !== false;
  const showKanban = brand.features?.kanban !== false;

  const [tab, setTab] = useState("dashboard");
  const [apiConfig, setApiConfig] = useState({ baseUrl: brand.baseUrl || "", token: "" });
  const [showConfig, setShowConfig] = useState(false);
  const [live, setLive] = useState({ crm: false, inbox: false, tasks: false, analytics: false });
  const [crm, setCrm] = useState<CRMData>(DEMO_CRM);
  const [inbox, setInbox] = useState<InboxData>(DEMO_INBOX);
  const [tasks, setTasks] = useState<TaskItem[]>(DEMO_TASKS);
  const [analytics, setAnalytics] = useState<AnalyticsData>(DEMO_ANALYTICS);
  const [dragTask, setDragTask] = useState<TaskItem | null>(null);
  const [hoveredCol, setHoveredCol] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [finTab, setFinTab] = useState("overview");
  const [expenses] = useState<ExpenseItem[]>(DEMO_EXPENSES);
  const [monthly] = useState<MonthlyRow[]>(DEMO_MONTHLY);
  const [transactions, setTransactions] = useState<TxItem[]>(DEMO_TRANSACTIONS);
  const [txFilter, setTxFilter] = useState("all");
  const [showAddTx, setShowAddTx] = useState(false);
  const [newTx, setNewTx] = useState({ type: "expense", category: "", amount: "", note: "", method: "بطاقة" });
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", due_date: "" });
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);

  const headers = useMemo(() => {
    const h: Record<string, string> = { "Content-Type": "application/json", ...csrfHeaders() };
    if (apiConfig.token) h["Authorization"] = `Bearer ${apiConfig.token}`;
    return h;
  }, [apiConfig.token]);

  const base = apiConfig.baseUrl;

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const ls = { crm: false, inbox: false, tasks: false, analytics: false };
    try {
      const r = await fetch(`${base}/api/crm/dashboard`, { headers, credentials: "include" });
      if (r.ok) { const j = await r.json(); if (j.success !== false && (j.data || j.revenue != null)) { setCrm(j.data || j); ls.crm = true; } }
    } catch { /* demo fallback */ }
    try {
      const r = await fetch(`${base}/api/crm/inbox/stats`, { headers, credentials: "include" });
      if (r.ok) { const j = await r.json(); if (j.success !== false) { setInbox(j.data?.stats || j.stats || j); ls.inbox = true; } }
    } catch { /* demo fallback */ }
    try {
      const r = await fetch(`${base}/api/crm/tasks`, { headers, credentials: "include" });
      if (r.ok) { const j = await r.json(); if (Array.isArray(j.data || j)) { setTasks(j.data || j); ls.tasks = true; } }
    } catch { /* demo fallback */ }
    try {
      const r = await fetch(`${base}/api/admin/analytics/dashboard`, { headers, credentials: "include" });
      if (r.ok) { const j = await r.json(); if (j.success !== false) { setAnalytics(j.data || j); ls.analytics = true; } }
    } catch { /* demo fallback */ }
    setLive(ls);
    setLastSync(new Date());
    setLoading(false);
  }, [base, headers]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const updateTaskStatus = async (id: string, status: string) => {
    setTasks(p => p.map(t => t.id === id ? { ...t, status } : t));
    if (live.tasks) {
      try { await fetch(`${base}/api/crm/tasks`, { method: "PUT", headers, body: JSON.stringify({ id, status }) }); } catch { /* ignore */ }
    }
  };

  const onDrop = (e: React.DragEvent, s: string) => {
    e.preventDefault();
    if (dragTask) { updateTaskStatus(dragTask.id, s); setDragTask(null); }
    setHoveredCol(null);
  };

  const addTask = () => {
    if (!newTask.title.trim()) return;
    const task: TaskItem = {
      id: `t-${Date.now()}`, title: newTask.title.trim(),
      priority: newTask.priority, status: "open",
      due_date: newTask.due_date || undefined,
    };
    setTasks(prev => [task, ...prev]);
    if (live.tasks) {
      try { fetch(`${base}/api/crm/tasks`, { method: "POST", headers, body: JSON.stringify(task) }); } catch { /* ignore */ }
    }
    setNewTask({ title: "", priority: "medium", due_date: "" });
    setShowAddTask(false);
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
    if (live.tasks) {
      try { fetch(`${base}/api/crm/tasks`, { method: "DELETE", headers, body: JSON.stringify({ id }) }); } catch { /* ignore */ }
    }
  };

  const startEdit = (task: TaskItem) => setEditingTask({ ...task });

  const saveEdit = () => {
    if (!editingTask || !editingTask.title.trim()) return;
    setTasks(prev => prev.map(t => t.id === editingTask.id ? { ...editingTask, title: editingTask.title.trim() } : t));
    if (live.tasks) {
      try { fetch(`${base}/api/crm/tasks`, { method: "PUT", headers, body: JSON.stringify(editingTask) }); } catch { /* ignore */ }
    }
    setEditingTask(null);
  };

  const addTransaction = () => {
    if (!newTx.category || !newTx.amount) return;
    const tx: TxItem = {
      id: Date.now(), date: new Date().toISOString().split("T")[0],
      type: newTx.type, category: newTx.category,
      amount: Number(newTx.amount), note: newTx.note, method: newTx.method,
    };
    setTransactions(prev => [tx, ...prev]);
    setNewTx({ type: "expense", category: "", amount: "", note: "", method: "بطاقة" });
    setShowAddTx(false);
  };

  // ── Computed ──
  const liveCount = Object.values(live).filter(Boolean).length;
  const isDemo = liveCount === 0;
  const m = analytics.metrics || {};
  const totalRevenue = REVENUE_STREAMS.reduce((s, r) => s + r.value, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.actual, 0);
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const totalBudget = expenses.reduce((s, e) => s + e.budget, 0);
  const budgetUsed = totalBudget > 0 ? Math.round((totalExpenses / totalBudget) * 100) : 0;
  const filteredTx = txFilter === "all" ? transactions : transactions.filter(t => t.type === txFilter);
  const txIncome = transactions.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const txExpense = transactions.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const pieData = Object.entries(crm.byStatus || {}).map(([k, v]) => ({ name: STATUS_LABELS[k] || k, value: v, color: STATUS_COLORS[k] || MUTED }));
  const sourceData = Object.entries(crm.bySource || {}).map(([k, v]) => ({ name: SOURCE_LABELS[k] || k, value: v, color: SOURCE_COLORS[k] || MUTED }));
  const sortedExp = [...expenses].sort((a, b) => b.actual - a.actual);

  const allTabs = [
    { id: "dashboard", label: "📊 لوحة القيادة" },
    showKanban ? { id: "kanban", label: "📋 المهام" } : null,
    showFinance ? { id: "finance", label: "💰 المالية" } : null,
    showAnalytics ? { id: "analytics", label: "📈 التحليلات" } : null,
  ].filter(Boolean) as { id: string; label: string }[];

  const finTabs = [
    { id: "overview", label: "نظرة عامة" },
    { id: "pnl", label: "أرباح وخسائر" },
    { id: "expenses", label: "المصاريف" },
    { id: "transactions", label: "الحركات" },
  ];

  const taskCols = [
    { key: "open", name: "مفتوحة", icon: "🔵", color: "#3b82f6" },
    { key: "in_progress", name: "قيد التنفيذ", icon: "🟡", color: "#eab308" },
    { key: "done", name: "مكتملة ✓", icon: "🟢", color: "#22c55e" },
  ];

  const inputStyle: React.CSSProperties = {
    width: "100%", background: CARD, border: `1px solid ${BORDER}`,
    color: TEXT, borderRadius: 8, padding: "8px 12px", fontSize: 12,
  };

  return (
    <div style={{ background: DARK, minHeight: "100vh", color: TEXT, fontFamily: "'Segoe UI', Tahoma, sans-serif", direction: "rtl" }}>
      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px) } to { opacity: 1; transform: translateY(0) } }
        input:focus, select:focus { border-color: ${CYAN} !important; outline: none; box-shadow: 0 0 0 2px ${CYAN}22; }
        button:hover { filter: brightness(1.15); }
        ::-webkit-scrollbar { width: 6px; height: 6px; }
        ::-webkit-scrollbar-track { background: ${DARK}; }
        ::-webkit-scrollbar-thumb { background: ${BORDER}; border-radius: 3px; }
      `}</style>

      {/* ═══════ HEADER ═══════ */}
      <div style={{
        background: `linear-gradient(135deg, ${CARD} 0%, ${DARK} 100%)`,
        borderBottom: `1px solid ${BORDER}`, padding: "12px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 10,
            background: `linear-gradient(135deg, ${BRAND}, ${CYAN})`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 900, color: "#fff", boxShadow: `0 0 20px ${BRAND}44`,
          }}>{APP_LOGO}</div>
          <div>
            <h1 style={{
              margin: 0, fontSize: 17, fontWeight: 800,
              background: `linear-gradient(90deg, ${GOLD}, ${CYAN})`,
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            }}>{APP_NAME}</h1>
            <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 3 }}>
              <span style={{ fontSize: 10, color: isDemo ? RED : GREEN, fontWeight: 700 }}>
                {isDemo ? "⚠️ وضع تجريبي" : `🟢 متصل — ${liveCount}/4 APIs`}
              </span>
              {lastSync && <span style={{ fontSize: 9, color: MUTED }}>آخر تحديث: {lastSync.toLocaleTimeString("ar-EG")}</span>}
              <div style={{ display: "flex", gap: 3, marginInlineStart: 4 }}>
                {["CRM", "Inbox", "Tasks", "Analytics"].map((k, i) => (
                  <div key={k} title={`${k}: ${Object.values(live)[i] ? "متصل" : "تجريبي"}`}
                    style={{ width: 7, height: 7, borderRadius: 4, background: Object.values(live)[i] ? GREEN : `${RED}55`, transition: "all 0.3s" }} />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <button onClick={() => setShowConfig(!showConfig)} style={{
            padding: "7px 14px", borderRadius: 8, border: `1px solid ${BORDER}`,
            background: "transparent", color: MUTED, fontSize: 12, cursor: "pointer", fontWeight: 600,
          }}>⚙️</button>
          <button onClick={fetchAll} disabled={loading} style={{
            padding: "7px 14px", borderRadius: 8, border: "none",
            background: `${BRAND}22`, color: BRAND_DEFAULT, fontSize: 12, cursor: "pointer",
            fontWeight: 700, opacity: loading ? 0.5 : 1,
          }}>{loading ? "⏳ جاري..." : "🔄 تحديث"}</button>
          <div style={{ display: "flex", gap: 3, background: CARD2, borderRadius: 10, padding: 3, border: `1px solid ${BORDER}` }}>
            {allTabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                fontSize: 12, fontWeight: 600, transition: "all 0.3s",
                background: tab === t.id ? `linear-gradient(135deg, ${GOLD}22, ${CYAN}22)` : "transparent",
                color: tab === t.id ? GOLD : MUTED,
                boxShadow: tab === t.id ? `0 0 12px ${GOLD}15` : "none",
              }}>{t.label}</button>
            ))}
          </div>
        </div>
      </div>

      {/* Config Panel */}
      {showConfig && (
        <div style={{ background: CARD2, borderBottom: `1px solid ${BORDER}`, padding: "14px 20px", display: "flex", gap: 12, alignItems: "flex-end", flexWrap: "wrap" }}>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>🔗 Base URL</label>
            <input value={apiConfig.baseUrl} onChange={e => setApiConfig({ ...apiConfig, baseUrl: e.target.value })} style={inputStyle} dir="ltr" />
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>🔑 Auth Token (اختياري)</label>
            <input type="password" value={apiConfig.token} onChange={e => setApiConfig({ ...apiConfig, token: e.target.value })} placeholder="يُرسل تلقائياً مع الكوكيز" style={inputStyle} dir="ltr" />
          </div>
          <button onClick={() => { fetchAll(); setShowConfig(false); }} style={{
            padding: "9px 24px", borderRadius: 8, border: "none",
            background: `linear-gradient(135deg, ${BRAND}, ${CYAN})`, color: "#fff",
            fontSize: 12, fontWeight: 700, cursor: "pointer",
          }}>🔌 اتصل وحفظ</button>
        </div>
      )}

      {/* ═══════ CONTENT ═══════ */}
      <div style={{ padding: "20px", maxWidth: 1350, margin: "0 auto" }}>

        {/* ══════════════════════ DASHBOARD ══════════════════════ */}
        {tab === "dashboard" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 12, marginBottom: 20 }}>
              {([
                { label: "الإيرادات", val: crm.revenue, prefix: "₪", color: GREEN, icon: "💰" },
                { label: "الطلبات", val: crm.totalOrders, color: CYAN, icon: "📦", sub: `${crm.newCount} جديد` },
                { label: "الزبائن", val: crm.totalCustomers, color: PURPLE, icon: "👥", sub: `${crm.vipCount} VIP` },
                showInbox ? { label: "محادثات نشطة", val: inbox.active || 0, color: GREEN, icon: "💬", sub: `${inbox.unread_total || 0} غير مقروءة` } : null,
                { label: "Pipeline", val: crm.pipelineValue, prefix: "₪", color: GOLD, icon: "🎯", sub: `${crm.pipelineDeals} صفقة` },
                { label: "صافي الربح", val: netProfit, prefix: "₪", color: netProfit >= 0 ? TEAL : RED, icon: "📊" },
              ].filter(Boolean) as { label: string; val: number; prefix?: string; color: string; icon: string; sub?: string }[]).map((k, i) => (
                <GlowCard key={i} glow={k.color} style={{ animation: `slideUp 0.4s ease ${i * 0.06}s both` }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <p style={{ margin: "0 0 4px", fontSize: 11, color: MUTED, fontWeight: 600 }}>{k.label}</p>
                      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: k.color, lineHeight: 1.1 }}>
                        <AnimNum value={k.val || 0} prefix={k.prefix} />
                      </p>
                      {k.sub && <p style={{ margin: "4px 0 0", fontSize: 10, color: MUTED }}>{k.sub}</p>}
                    </div>
                    <span style={{ fontSize: 24 }}>{k.icon}</span>
                  </div>
                </GlowCard>
              ))}
            </div>

            {/* Charts */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <GlowCard glow={CYAN}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: CYAN, fontWeight: 700 }}>📊 حالات الطلبات</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={pieData} cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3} dataKey="value" stroke="none">
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie><Tooltip content={<CTooltipPlain />} /></PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  {pieData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                      <Dot color={d.color} size={7} /><span style={{ color: MUTED }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </GlowCard>
              <GlowCard glow={PURPLE}>
                <h3 style={{ margin: "0 0 10px", fontSize: 14, color: PURPLE, fontWeight: 700 }}>📡 مصادر الطلبات</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart><Pie data={sourceData} cx="50%" cy="50%" outerRadius={65} innerRadius={35} paddingAngle={3} dataKey="value" stroke="none">
                    {sourceData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie><Tooltip content={<CTooltipPlain />} /></PieChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", justifyContent: "center", gap: 10, flexWrap: "wrap", marginTop: 4 }}>
                  {sourceData.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                      <Dot color={d.color} size={7} /><span style={{ color: MUTED }}>{d.name} ({d.value})</span>
                    </div>
                  ))}
                </div>
              </GlowCard>
            </div>

            {/* Alerts + Recent */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <GlowCard glow={RED}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: RED, fontWeight: 700 }}>⚡ تنبيهات</h3>
                {(crm.alerts || []).length === 0
                  ? <p style={{ color: MUTED, fontSize: 12, textAlign: "center", padding: 20 }}>لا توجد تنبيهات 👍</p>
                  : (crm.alerts || []).map((a, i) => (
                    <div key={i} style={{
                      display: "flex", justifyContent: "space-between", alignItems: "center",
                      background: `${a.color}10`, borderRadius: 10, padding: "10px 14px", marginBottom: 8, border: `1px solid ${a.color}15`,
                    }}>
                      <span style={{ color: a.color, fontWeight: 800, fontSize: 16 }}>{a.count}</span>
                      <span style={{ color: TEXT, fontSize: 12, fontWeight: 500 }}>{a.msg}</span>
                    </div>
                  ))}
              </GlowCard>
              <GlowCard glow={GREEN}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: GREEN, fontWeight: 700 }}>📦 آخر الطلبات</h3>
                {(crm.recentOrders || []).slice(0, 4).map((o, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "8px 0", borderBottom: i < 3 ? `1px solid ${BORDER}30` : "none",
                  }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <Badge text={STATUS_LABELS[o.status] || o.status} color={STATUS_COLORS[o.status] || MUTED} />
                      <span style={{ color: BRAND_DEFAULT, fontWeight: 700, fontSize: 13 }}>₪{Number(o.total).toLocaleString()}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 700, fontSize: 12, color: TEXT }}>{o.id}</span>
                      <span style={{ color: MUTED, fontSize: 10 }}>{new Date(o.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                ))}
              </GlowCard>
            </div>
          </div>
        )}

        {/* ══════════════════════ KANBAN ══════════════════════ */}
        {tab === "kanban" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {!live.tasks ? <Badge text="⚠️ بيانات تجريبية" color={RED} /> : <Badge text="🟢 متصل — الحفظ مباشر" color={GREEN} />}
                <button onClick={() => { setShowAddTask(!showAddTask); setEditingTask(null); }} style={{
                  padding: "7px 16px", borderRadius: 8, border: "none",
                  background: showAddTask ? `${RED}22` : `${TEAL}22`, color: showAddTask ? RED : TEAL,
                  fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>{showAddTask ? "✕ إلغاء" : "＋ مهمة جديدة"}</button>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: GOLD }}>📋 لوحة المهام — {tasks.length} مهمة</h2>
            </div>

            {showAddTask && (
              <GlowCard glow={TEAL} style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, color: TEAL, fontWeight: 700 }}>إضافة مهمة جديدة</h4>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>عنوان المهمة *</label>
                    <input value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })}
                      placeholder="مثال: متابعة طلب العميل..." onKeyDown={e => e.key === "Enter" && addTask()} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>الأولوية</label>
                    <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                      <option value="high">🔴 عاجل</option><option value="medium">🟡 عادي</option><option value="low">🔵 منخفض</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>تاريخ الاستحقاق</label>
                    <input type="date" value={newTask.due_date} onChange={e => setNewTask({ ...newTask, due_date: e.target.value })} style={inputStyle} dir="ltr" />
                  </div>
                  <button onClick={addTask} style={{
                    padding: "9px 24px", borderRadius: 8, border: "none",
                    background: `linear-gradient(135deg, ${TEAL}, ${CYAN})`, color: "#fff",
                    fontSize: 13, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                    opacity: newTask.title.trim() ? 1 : 0.4,
                  }}>✓ إضافة</button>
                </div>
              </GlowCard>
            )}

            {editingTask && (
              <GlowCard glow={GOLD} style={{ marginBottom: 16 }}>
                <h4 style={{ margin: "0 0 12px", fontSize: 14, color: GOLD, fontWeight: 700 }}>✏️ تعديل المهمة</h4>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto auto", gap: 10, alignItems: "flex-end" }}>
                  <div>
                    <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>العنوان</label>
                    <input value={editingTask.title} onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                      onKeyDown={e => e.key === "Enter" && saveEdit()} style={inputStyle} />
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>الأولوية</label>
                    <select value={editingTask.priority} onChange={e => setEditingTask({ ...editingTask, priority: e.target.value })} style={inputStyle}>
                      <option value="high">🔴 عاجل</option><option value="medium">🟡 عادي</option><option value="low">🔵 منخفض</option>
                    </select>
                  </div>
                  <div>
                    <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>تاريخ الاستحقاق</label>
                    <input type="date" value={editingTask.due_date ? editingTask.due_date.split("T")[0] : ""} onChange={e => setEditingTask({ ...editingTask, due_date: e.target.value || undefined })} style={inputStyle} dir="ltr" />
                  </div>
                  <button onClick={saveEdit} style={{ padding: "9px 20px", borderRadius: 8, border: "none", background: `linear-gradient(135deg, ${GOLD}, ${CYAN})`, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓ حفظ</button>
                  <button onClick={() => setEditingTask(null)} style={{ padding: "9px 16px", borderRadius: 8, border: `1px solid ${BORDER}`, background: "transparent", color: MUTED, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>إلغاء</button>
                </div>
              </GlowCard>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
              {taskCols.map(col => {
                const ct = tasks.filter(t => t.status === col.key);
                const isHovered = hoveredCol === col.key;
                return (
                  <div key={col.key}
                    onDragOver={e => { e.preventDefault(); setHoveredCol(col.key); }}
                    onDragLeave={() => setHoveredCol(null)}
                    onDrop={e => onDrop(e, col.key)}
                    style={{
                      background: isHovered ? `${col.color}08` : `${CARD2}66`, borderRadius: 14, padding: 14, minHeight: 320,
                      border: `1.5px ${isHovered ? "solid" : "dashed"} ${isHovered ? col.color : BORDER}`, transition: "all 0.3s",
                    }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                      <span style={{ background: `${col.color}22`, color: col.color, borderRadius: 20, padding: "3px 12px", fontSize: 12, fontWeight: 700 }}>{ct.length}</span>
                      <h4 style={{ margin: 0, fontSize: 14, color: col.color, fontWeight: 700 }}>{col.icon} {col.name}</h4>
                    </div>
                    {ct.map(task => (
                      <div key={task.id} draggable onDragStart={() => setDragTask(task)} style={{
                        background: editingTask?.id === task.id ? `${GOLD}10` : CARD, borderRadius: 10, padding: 12, marginBottom: 8,
                        cursor: "grab", borderInlineStart: `3px solid ${PRIORITY_COLORS[task.priority] || MUTED}`,
                        boxShadow: `0 2px 10px #00000025`, transition: "all 0.2s",
                        border: editingTask?.id === task.id ? `1px solid ${GOLD}44` : `1px solid transparent`,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                          <div style={{ display: "flex", gap: 4 }}>
                            <button onClick={(e) => { e.stopPropagation(); startEdit(task); setShowAddTask(false); }} title="تعديل" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, padding: "2px 4px", borderRadius: 4, color: MUTED, opacity: 0.6 }}>✏️</button>
                            <button onClick={(e) => { e.stopPropagation(); deleteTask(task.id); }} title="حذف" style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, padding: "2px 4px", borderRadius: 4, color: MUTED, opacity: 0.6 }}>🗑️</button>
                          </div>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 600, lineHeight: 1.5, flex: 1, textAlign: "start", textDecoration: col.key === "done" ? "line-through" : "none", opacity: col.key === "done" ? 0.5 : 1 }}>{task.title}</p>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <Badge text={PRIORITY_LABELS[task.priority] || task.priority} color={PRIORITY_COLORS[task.priority] || MUTED} />
                          {task.due_date && (
                            <span style={{ fontSize: 10, color: new Date(task.due_date) < new Date() && col.key !== "done" ? RED : MUTED }}>
                              📅 {new Date(task.due_date).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                    {ct.length === 0 && <p style={{ textAlign: "center", color: `${MUTED}66`, fontSize: 11, padding: "30px 10px", fontStyle: "italic" }}>اسحب مهمة هنا أو أضف واحدة جديدة</p>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ══════════════════════ FINANCE ══════════════════════ */}
        {tab === "finance" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div style={{ display: "flex", gap: 4, background: CARD2, borderRadius: 10, padding: 3, border: `1px solid ${BORDER}` }}>
                {finTabs.map(t => (
                  <button key={t.id} onClick={() => setFinTab(t.id)} style={{
                    padding: "7px 16px", borderRadius: 8, border: "none", cursor: "pointer",
                    fontSize: 12, fontWeight: 600, transition: "all 0.3s",
                    background: finTab === t.id ? `linear-gradient(135deg, ${TEAL}22, ${GOLD}22)` : "transparent",
                    color: finTab === t.id ? TEAL : MUTED,
                  }}>{t.label}</button>
                ))}
              </div>
              <h2 style={{ margin: 0, fontSize: 17, color: TEAL, fontWeight: 800 }}>💰 إدارة المالية</h2>
            </div>

            {/* Overview */}
            {finTab === "overview" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 18 }}>
                  {[
                    { label: "إجمالي الإيرادات", val: totalRevenue, prefix: "₪", color: GREEN, icon: "💰" },
                    { label: "إجمالي المصاريف", val: totalExpenses, prefix: "₪", color: RED, icon: "💸" },
                    { label: "صافي الربح", val: netProfit, prefix: "₪", color: netProfit >= 0 ? TEAL : RED, icon: "📊" },
                    { label: "هامش الربح", val: profitMargin, suffix: "%", color: profitMargin >= 20 ? TEAL : GOLD, icon: "🎯" },
                    { label: "الميزانية المستخدمة", val: budgetUsed, suffix: "%", color: budgetUsed <= 80 ? GREEN : GOLD, icon: "📋" },
                    { label: "متوسط الطلب", val: m.avgOrderValue || 1311, prefix: "₪", color: CYAN, icon: "📦" },
                  ].map((k, i) => (
                    <GlowCard key={i} glow={k.color} style={{ animation: `slideUp 0.3s ease ${i * 0.05}s both`, textAlign: "center" }}>
                      <span style={{ fontSize: 20 }}>{k.icon}</span>
                      <p style={{ margin: "4px 0 2px", fontSize: 10, color: MUTED, fontWeight: 600 }}>{k.label}</p>
                      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, color: k.color }}><AnimNum value={k.val || 0} prefix={k.prefix} suffix={k.suffix} /></p>
                    </GlowCard>
                  ))}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14, marginBottom: 16 }}>
                  <GlowCard glow={TEAL}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 14, color: TEAL, fontWeight: 700 }}>📈 الإيرادات مقابل المصاريف</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={monthly}>
                        <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                        <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 11 }} />
                        <YAxis tick={{ fill: MUTED, fontSize: 10 }} />
                        <Tooltip content={<CTooltip />} />
                        <Bar dataKey="revenue" fill={GREEN} radius={[4, 4, 0, 0]} name="إيرادات" barSize={18} opacity={0.8} />
                        <Bar dataKey="expenses" fill={RED} radius={[4, 4, 0, 0]} name="مصاريف" barSize={18} opacity={0.6} />
                        <Line type="monotone" dataKey="profit" stroke={TEAL} strokeWidth={2.5} dot={{ fill: TEAL, r: 4 }} name="صافي ربح" />
                        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </GlowCard>
                  <GlowCard glow={GOLD}>
                    <h3 style={{ margin: "0 0 12px", fontSize: 14, color: GOLD, fontWeight: 700 }}>💎 مصادر الإيرادات</h3>
                    <ResponsiveContainer width="100%" height={160}>
                      <PieChart><Pie data={REVENUE_STREAMS} cx="50%" cy="50%" outerRadius={60} innerRadius={30} paddingAngle={3} dataKey="value" stroke="none">
                        {REVENUE_STREAMS.map((d, i) => <Cell key={i} fill={d.color} />)}
                      </Pie><Tooltip content={<CTooltip />} /></PieChart>
                    </ResponsiveContainer>
                    <div style={{ marginTop: 8 }}>
                      {REVENUE_STREAMS.map((r, i) => (
                        <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "4px 0" }}>
                          <span style={{ fontSize: 12, fontWeight: 700, color: r.color }}>₪{r.value.toLocaleString()}</span>
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}><Dot color={r.color} size={7} /><span style={{ fontSize: 11, color: MUTED }}>{r.name}</span></div>
                        </div>
                      ))}
                    </div>
                  </GlowCard>
                </div>
                <GlowCard glow={PURPLE}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: PURPLE, fontWeight: 700 }}>💹 اتجاه الأرباح الشهرية</h3>
                  <ResponsiveContainer width="100%" height={180}>
                    <AreaChart data={monthly}>
                      <defs><linearGradient id="gPr" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={TEAL} stopOpacity={0.4} /><stop offset="100%" stopColor={TEAL} stopOpacity={0} /></linearGradient></defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                      <XAxis dataKey="month" tick={{ fill: MUTED, fontSize: 11 }} />
                      <YAxis tick={{ fill: MUTED, fontSize: 10 }} />
                      <Tooltip content={<CTooltip />} />
                      <Area type="monotone" dataKey="profit" stroke={TEAL} fill="url(#gPr)" strokeWidth={2.5} name="صافي الربح" dot={{ fill: TEAL, r: 4 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </GlowCard>
              </div>
            )}

            {/* P&L */}
            {finTab === "pnl" && (
              <div>
                <GlowCard glow={TEAL} style={{ marginBottom: 16 }}>
                  <h3 style={{ margin: "0 0 16px", fontSize: 15, color: TEAL, textAlign: "center", fontWeight: 800 }}>📋 تقرير الأرباح والخسائر — مارس 2026</h3>
                  <div style={{ background: `${GREEN}08`, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${GREEN}18` }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, color: GREEN, fontWeight: 700 }}>💰 الإيرادات</h4>
                    {REVENUE_STREAMS.map((r, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < REVENUE_STREAMS.length - 1 ? `1px solid ${BORDER}18` : "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: GREEN }}>₪{r.value.toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: TEXT }}>{r.name}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 8, borderTop: `2px solid ${GREEN}35` }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: GREEN }}>₪{totalRevenue.toLocaleString()}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: GREEN }}>إجمالي الإيرادات</span>
                    </div>
                  </div>
                  <div style={{ background: `${RED}06`, borderRadius: 12, padding: 16, marginBottom: 12, border: `1px solid ${RED}15` }}>
                    <h4 style={{ margin: "0 0 10px", fontSize: 14, color: RED, fontWeight: 700 }}>💸 المصاريف</h4>
                    {sortedExp.map((e, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: i < sortedExp.length - 1 ? `1px solid ${BORDER}12` : "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: RED }}>₪{e.actual.toLocaleString()}</span>
                        <span style={{ fontSize: 12, color: TEXT }}>{e.icon} {e.name}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 0 0", marginTop: 8, borderTop: `2px solid ${RED}35` }}>
                      <span style={{ fontSize: 16, fontWeight: 900, color: RED }}>₪{totalExpenses.toLocaleString()}</span>
                      <span style={{ fontSize: 13, fontWeight: 800, color: RED }}>إجمالي المصاريف</span>
                    </div>
                  </div>
                  <div style={{ background: netProfit >= 0 ? `${TEAL}10` : `${RED}10`, borderRadius: 12, padding: 18, border: `2px solid ${netProfit >= 0 ? TEAL : RED}35`, textAlign: "center" }}>
                    <p style={{ margin: "0 0 4px", fontSize: 12, color: MUTED, fontWeight: 600 }}>صافي الربح</p>
                    <p style={{ margin: 0, fontSize: 36, fontWeight: 900, color: netProfit >= 0 ? TEAL : RED }}>₪{netProfit.toLocaleString()}</p>
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: netProfit >= 0 ? TEAL : RED, fontWeight: 700 }}>هامش الربح: {profitMargin}%</p>
                  </div>
                </GlowCard>
                <GlowCard glow={CYAN}>
                  <h3 style={{ margin: "0 0 14px", fontSize: 14, color: CYAN, fontWeight: 700 }}>📅 تقرير P&L الشهري</h3>
                  <div style={{ overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead><tr style={{ borderBottom: `2px solid ${BORDER}` }}>
                        {["الشهر", "الإيرادات", "المصاريف", "صافي الربح", "الطلبات", "متوسط الطلب"].map((h, i) => (
                          <th key={i} style={{ padding: "10px 8px", textAlign: i === 0 ? "right" : "center", color: MUTED, fontWeight: 700, fontSize: 11 }}>{h}</th>
                        ))}
                      </tr></thead>
                      <tbody>
                        {monthly.map((row, i) => (
                          <tr key={i} style={{ borderBottom: `1px solid ${BORDER}25` }}>
                            <td style={{ padding: "10px 8px", fontWeight: 700, fontSize: 12 }}>{row.month}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center", color: GREEN, fontWeight: 700 }}>₪{row.revenue.toLocaleString()}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center", color: RED, fontWeight: 700 }}>₪{row.expenses.toLocaleString()}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center", color: row.profit >= 0 ? TEAL : RED, fontWeight: 800 }}>₪{row.profit.toLocaleString()}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center", fontSize: 12 }}>{row.orders}</td>
                            <td style={{ padding: "10px 8px", textAlign: "center", color: CYAN, fontWeight: 600 }}>₪{row.avgOrder.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </GlowCard>
              </div>
            )}

            {/* Expenses */}
            {finTab === "expenses" && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12, marginBottom: 18 }}>
                  {sortedExp.map((e, i) => {
                    const pct = e.budget > 0 ? Math.round((e.actual / e.budget) * 100) : 0;
                    const over = pct > 100;
                    return (
                      <GlowCard key={i} glow={e.color} style={{ animation: `slideUp 0.3s ease ${i * 0.04}s both` }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                          <Badge text={over ? "تجاوز ⚠️" : `${pct}%`} color={over ? RED : pct > 80 ? GOLD : GREEN} />
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: 18 }}>{e.icon}</span><span style={{ fontSize: 12, fontWeight: 700 }}>{e.name}</span>
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 10, color: MUTED }}>ميزانية: ₪{e.budget.toLocaleString()}</span>
                          <span style={{ fontSize: 16, fontWeight: 800, color: over ? RED : e.color }}>₪{e.actual.toLocaleString()}</span>
                        </div>
                        <div style={{ height: 8, borderRadius: 4, background: `${BORDER}44`, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 4, background: over ? `linear-gradient(90deg, ${RED}, ${GOLD})` : pct > 80 ? GOLD : e.color, transition: "width 0.8s ease" }} />
                        </div>
                        <p style={{ margin: "6px 0 0", fontSize: 10, color: over ? RED : MUTED, fontWeight: 600 }}>
                          {over ? `تجاوز بـ ₪${(e.actual - e.budget).toLocaleString()}` : `متبقي ₪${(e.budget - e.actual).toLocaleString()}`}
                        </p>
                      </GlowCard>
                    );
                  })}
                </div>
                <GlowCard glow={PURPLE}>
                  <h3 style={{ margin: "0 0 14px", fontSize: 14, color: PURPLE, fontWeight: 700 }}>📊 توزيع المصاريف — الفعلي مقابل الميزانية</h3>
                  <ResponsiveContainer width="100%" height={Math.max(300, sortedExp.length * 42)}>
                    <BarChart data={sortedExp} layout="vertical" margin={{ top: 5, right: 10, left: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={BORDER} horizontal={false} />
                      <XAxis type="number" tick={{ fill: MUTED, fontSize: 10 }} tickFormatter={(v: number) => `₪${(v / 1000).toFixed(0)}k`} />
                      <YAxis dataKey="name" type="category" tick={{ fill: TEXT, fontSize: 11, fontWeight: 600 }} width={120} />
                      <Tooltip content={<CTooltip />} /><Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                      <Bar dataKey="actual" name="فعلي" barSize={16} radius={[0, 6, 6, 0]}>
                        {sortedExp.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                      <Bar dataKey="budget" name="ميزانية" barSize={16} radius={[0, 6, 6, 0]} opacity={0.2}>
                        {sortedExp.map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlowCard>
              </div>
            )}

            {/* Transactions */}
            {finTab === "transactions" && (
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
                  <button onClick={() => setShowAddTx(!showAddTx)} style={{
                    padding: "8px 18px", borderRadius: 8, border: "none",
                    background: showAddTx ? `${RED}22` : `${TEAL}22`, color: showAddTx ? RED : TEAL,
                    fontSize: 12, fontWeight: 700, cursor: "pointer",
                  }}>{showAddTx ? "✕ إلغاء" : "＋ إضافة حركة جديدة"}</button>
                  <div style={{ display: "flex", gap: 4 }}>
                    {[{ k: "all", l: "الكل" }, { k: "income", l: "💰 إيرادات" }, { k: "expense", l: "💸 مصاريف" }].map(f => (
                      <button key={f.k} onClick={() => setTxFilter(f.k)} style={{
                        padding: "6px 14px", borderRadius: 8, border: `1px solid ${txFilter === f.k ? TEAL : BORDER}`,
                        background: txFilter === f.k ? `${TEAL}15` : "transparent", color: txFilter === f.k ? TEAL : MUTED,
                        fontSize: 11, cursor: "pointer", fontWeight: 600,
                      }}>{f.l}</button>
                    ))}
                  </div>
                </div>
                {showAddTx && (
                  <GlowCard glow={TEAL} style={{ marginBottom: 14 }}>
                    <h4 style={{ margin: "0 0 12px", fontSize: 13, color: TEAL, fontWeight: 700 }}>إضافة حركة مالية</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 10, alignItems: "flex-end" }}>
                      <div>
                        <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>النوع</label>
                        <select value={newTx.type} onChange={e => setNewTx({ ...newTx, type: e.target.value })} style={inputStyle}>
                          <option value="income">💰 إيراد</option><option value="expense">💸 مصروف</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>الفئة</label>
                        <input value={newTx.category} onChange={e => setNewTx({ ...newTx, category: e.target.value })} placeholder="مبيعات / إيجار..." style={inputStyle} />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>المبلغ ₪</label>
                        <input type="number" value={newTx.amount} onChange={e => setNewTx({ ...newTx, amount: e.target.value })} placeholder="0" style={inputStyle} dir="ltr" />
                      </div>
                      <div>
                        <label style={{ fontSize: 10, color: MUTED, display: "block", marginBottom: 4 }}>ملاحظة</label>
                        <input value={newTx.note} onChange={e => setNewTx({ ...newTx, note: e.target.value })} placeholder="تفاصيل إضافية..." style={inputStyle} />
                      </div>
                      <button onClick={addTransaction} style={{
                        padding: "9px 20px", borderRadius: 8, border: "none",
                        background: `linear-gradient(135deg, ${TEAL}, ${CYAN})`, color: "#fff",
                        fontSize: 12, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
                      }}>✓ حفظ</button>
                    </div>
                  </GlowCard>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 14 }}>
                  <GlowCard glow={GREEN} style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 20 }}>💰</span>
                    <p style={{ margin: "4px 0", fontSize: 10, color: MUTED, fontWeight: 600 }}>إجمالي الإيرادات</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: GREEN }}>₪{txIncome.toLocaleString()}</p>
                  </GlowCard>
                  <GlowCard glow={RED} style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 20 }}>💸</span>
                    <p style={{ margin: "4px 0", fontSize: 10, color: MUTED, fontWeight: 600 }}>إجمالي المصاريف</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: RED }}>₪{txExpense.toLocaleString()}</p>
                  </GlowCard>
                  <GlowCard glow={TEAL} style={{ textAlign: "center" }}>
                    <span style={{ fontSize: 20 }}>📊</span>
                    <p style={{ margin: "4px 0", fontSize: 10, color: MUTED, fontWeight: 600 }}>الصافي</p>
                    <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: txIncome - txExpense >= 0 ? TEAL : RED }}>₪{(txIncome - txExpense).toLocaleString()}</p>
                  </GlowCard>
                </div>
                <GlowCard glow={CYAN}>
                  <h3 style={{ margin: "0 0 12px", fontSize: 14, color: CYAN, fontWeight: 700 }}>📒 سجل الحركات المالية</h3>
                  {filteredTx.length === 0
                    ? <p style={{ textAlign: "center", color: MUTED, padding: 20 }}>لا توجد حركات</p>
                    : filteredTx.map((tx, i) => (
                      <div key={tx.id} style={{
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                        padding: "10px 6px", borderBottom: i < filteredTx.length - 1 ? `1px solid ${BORDER}20` : "none",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ fontSize: 18 }}>{tx.type === "income" ? "💰" : "💸"}</span>
                          <span style={{ fontSize: 10, color: MUTED }}>{tx.date}</span>
                        </div>
                        <div style={{ flex: 1, margin: "0 14px", textAlign: "start" }}>
                          <span style={{ fontSize: 12, fontWeight: 600, display: "block" }}>{tx.category}</span>
                          {tx.note && <span style={{ fontSize: 10, color: MUTED }}>{tx.note}</span>}
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <Badge text={tx.method} color={CYAN} />
                          <span style={{ fontSize: 15, fontWeight: 800, color: tx.type === "income" ? GREEN : RED, minWidth: 90, textAlign: "end" }}>
                            {tx.type === "income" ? "+" : "-"}₪{tx.amount.toLocaleString()}
                          </span>
                        </div>
                      </div>
                    ))}
                </GlowCard>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════ ANALYTICS ══════════════════════ */}
        {tab === "analytics" && (
          <div style={{ animation: "fadeIn 0.4s ease" }}>
            <SectionHeader title="تحليلات الأداء" icon="📈" color={GOLD}
              badge={!live.analytics ? <Badge text="⚠️ بيانات تجريبية" color={RED} /> : <Badge text="🟢 بيانات حقيقية" color={GREEN} />} />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 18 }}>
              {[
                { label: "الإيرادات", val: m.totalRevenue, prefix: "₪", change: m.revenueChange, color: GREEN, icon: "💰" },
                { label: "الطلبات", val: m.totalOrders, change: m.ordersChange, color: CYAN, icon: "📦" },
                { label: "متوسط الطلب", val: m.avgOrderValue, prefix: "₪", color: GOLD, icon: "📊" },
                { label: "زبائن جدد", val: m.newCustomers, change: m.customersChange, color: PURPLE, icon: "👥" },
                { label: "معدل التحويل", val: m.conversionRate, suffix: "%", color: BRAND_DEFAULT, icon: "🎯" },
                { label: "سلال متروكة", val: m.abandonmentRate, suffix: "%", color: RED, icon: "🛒" },
              ].map((k, i) => (
                <GlowCard key={i} glow={k.color} style={{ textAlign: "center", animation: `slideUp 0.3s ease ${i * 0.05}s both` }}>
                  <span style={{ fontSize: 18 }}>{k.icon}</span>
                  <p style={{ margin: "4px 0 2px", fontSize: 10, color: MUTED, fontWeight: 600 }}>{k.label}</p>
                  <p style={{ margin: 0, fontSize: 22, fontWeight: 800, color: k.color }}><AnimNum value={k.val || 0} prefix={k.prefix} suffix={k.suffix} /></p>
                  {k.change != null && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: k.change >= 0 ? GREEN : RED, fontWeight: 700 }}>
                      {k.change >= 0 ? "▲" : "▼"} {Math.abs(k.change)}%
                    </p>
                  )}
                </GlowCard>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <GlowCard glow={GREEN}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: GREEN, fontWeight: 700 }}>📈 الإيرادات اليومية</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics.dailyRevenue || []}>
                    <defs><linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={GREEN} stopOpacity={0.3} /><stop offset="100%" stopColor={GREEN} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} />
                    <YAxis tick={{ fill: MUTED, fontSize: 10 }} />
                    <Tooltip content={<CTooltip />} />
                    <Area type="monotone" dataKey="value" stroke={GREEN} fill="url(#gRev)" strokeWidth={2} name="إيرادات" dot={{ fill: GREEN, r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </GlowCard>
              <GlowCard glow={CYAN}>
                <h3 style={{ margin: "0 0 12px", fontSize: 14, color: CYAN, fontWeight: 700 }}>👥 نمو الزبائن الأسبوعي</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={analytics.customerGrowth || []}>
                    <defs><linearGradient id="gCust" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={CYAN} stopOpacity={0.3} /><stop offset="100%" stopColor={CYAN} stopOpacity={0} /></linearGradient></defs>
                    <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                    <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 10 }} />
                    <YAxis tick={{ fill: MUTED, fontSize: 10 }} />
                    <Tooltip content={<CTooltipPlain />} />
                    <Area type="monotone" dataKey="value" stroke={CYAN} fill="url(#gCust)" strokeWidth={2} name="زبائن جدد" dot={{ fill: CYAN, r: 3 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </GlowCard>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <GlowCard glow={GOLD}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, color: GOLD, fontWeight: 700 }}>🏆 أكثر المنتجات مبيعاً</h3>
                {(analytics.topProducts || []).map((p, i) => {
                  const mx = Math.max(...(analytics.topProducts || []).map(x => x.value), 1);
                  const colors = [GOLD, CYAN, PURPLE, GREEN, BRAND];
                  const medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣"];
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 800, color: colors[i] }}>{p.value} مبيعات</span>
                        <span style={{ fontSize: 11, color: TEXT, fontWeight: 600 }}>{medals[i]} {p.label}</span>
                      </div>
                      <div style={{ height: 8, borderRadius: 4, background: `${BORDER}44`, overflow: "hidden" }}>
                        <div style={{ width: `${(p.value / mx) * 100}%`, height: "100%", borderRadius: 4, background: `linear-gradient(90deg, ${colors[i]}, ${colors[i]}88)`, transition: "width 1s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </GlowCard>
              <GlowCard glow={BRAND}>
                <h3 style={{ margin: "0 0 14px", fontSize: 14, color: BRAND_DEFAULT, fontWeight: 700 }}>📊 مقارنة الأداء</h3>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                  {[
                    { label: "الإيرادات", curr: m.totalRevenue, prev: m.prevRevenue, prefix: "₪", icon: "📈" },
                    { label: "الطلبات", curr: m.totalOrders, prev: m.prevOrders, icon: "📦" },
                    { label: "الزبائن", curr: m.newCustomers, prev: m.prevCustomers, icon: "👥" },
                  ].map((s, i) => {
                    const change = s.prev > 0 ? Math.round(((s.curr - s.prev) / s.prev) * 100) : 0;
                    return (
                      <div key={i} style={{ background: CARD2, borderRadius: 12, padding: 14, textAlign: "center", border: `1px solid ${BORDER}` }}>
                        <span style={{ fontSize: 20 }}>{s.icon}</span>
                        <p style={{ margin: "6px 0 2px", fontSize: 10, color: MUTED, fontWeight: 600 }}>{s.label}</p>
                        <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: TEXT }}>{s.prefix || ""}{(s.curr || 0).toLocaleString()}</p>
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: change >= 0 ? GREEN : RED, fontWeight: 700 }}>
                          {change >= 0 ? "▲" : "▼"} {Math.abs(change)}% من السابق
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 10, color: MUTED }}>{s.prefix || ""}{(s.prev || 0).toLocaleString()}</p>
                      </div>
                    );
                  })}
                </div>
              </GlowCard>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
