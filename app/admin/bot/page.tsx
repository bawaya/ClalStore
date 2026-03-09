"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { createBrowserSupabase } from "@/lib/supabase";

type Tab = "analytics" | "templates" | "policies" | "handoffs" | "conversations";

interface Template {
  id: string;
  key: string;
  content_ar: string;
  content_he: string;
  variables: string[];
  active: boolean;
}

interface Policy {
  id: string;
  type: string;
  title_ar: string;
  title_he: string;
  content_ar: string;
  content_he: string;
  active: boolean;
}

interface Handoff {
  id: string;
  reason: string;
  summary: string;
  status: string;
  assigned_to: string | null;
  created_at: string;
  customer_phone: string | null;
  customer_name: string | null;
}

interface Analytics {
  date: string;
  channel: string;
  total_conversations: number;
  total_messages: number;
  handoffs: number;
  avg_csat: number;
  store_clicks: number;
}

interface Conversation {
  id: string;
  visitor_id: string;
  channel: string;
  status: string;
  language: string;
  message_count: number;
  created_at: string;
  updated_at: string;
  customer_name: string | null;
}

export default function BotAdminPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [tab, setTab] = useState<Tab>("analytics");
  const [loading, setLoading] = useState(true);

  // Data states
  const [analytics, setAnalytics] = useState<Analytics[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [handoffs, setHandoffs] = useState<Handoff[]>([]);
  const [conversations, setConversations] = useState<Conversation[]>([]);

  // Editing states
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [editingPolicy, setEditingPolicy] = useState<Policy | null>(null);

  const sb = createBrowserSupabase();

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === "analytics") {
        const { data } = await sb
          .from("bot_analytics")
          .select("*")
          .order("date", { ascending: false })
          .limit(30);
        setAnalytics((data || []) as Analytics[]);
      } else if (tab === "templates") {
        const { data } = await sb.from("bot_templates").select("*").order("key");
        setTemplates((data || []) as Template[]);
      } else if (tab === "policies") {
        const { data } = await sb.from("bot_policies").select("*").order("type");
        setPolicies((data || []) as Policy[]);
      } else if (tab === "handoffs") {
        const { data } = await sb
          .from("bot_handoffs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(50);
        setHandoffs((data || []) as Handoff[]);
      } else if (tab === "conversations") {
        const { data } = await sb
          .from("bot_conversations")
          .select("*")
          .order("updated_at", { ascending: false })
          .limit(50);
        setConversations((data || []) as Conversation[]);
      }
    } catch (err) {
      console.error("Load error:", err);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => { loadData(); }, [loadData]);

  const tabs: { key: Tab; icon: string; label: string }[] = [
    { key: "analytics", icon: "📊", label: "إحصائيات" },
    { key: "templates", icon: "📝", label: "قوالب" },
    { key: "policies", icon: "📋", label: "سياسات" },
    { key: "handoffs", icon: "👤", label: "تحويلات" },
    { key: "conversations", icon: "💬", label: "محادثات" },
  ];

  // ===== Save Template =====
  const saveTemplate = async (t: Template) => {
    try {
      const { error } = await (sb.from("bot_templates") as any).update({
        content_ar: t.content_ar,
        content_he: t.content_he,
        variables: t.variables,
        active: t.active,
      }).eq("id", t.id);
      if (error) throw error;
      show("✅ تم حفظ القالب");
      setEditingTemplate(null);
      loadData();
    } catch { show("❌ خطأ في الحفظ"); }
  };

  // ===== Save Policy =====
  const savePolicy = async (p: Policy) => {
    try {
      const { error } = await (sb.from("bot_policies") as any).update({
        title_ar: p.title_ar,
        title_he: p.title_he,
        content_ar: p.content_ar,
        content_he: p.content_he,
        active: p.active,
      }).eq("id", p.id);
      if (error) throw error;
      show("✅ تم حفظ السياسة");
      setEditingPolicy(null);
      loadData();
    } catch { show("❌ خطأ في الحفظ"); }
  };

  // ===== Resolve Handoff =====
  const resolveHandoff = async (id: string) => {
    try {
      const { error } = await (sb.from("bot_handoffs") as any).update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
      }).eq("id", id);
      if (error) throw error;
      show("✅ تم الحل");
      loadData();
    } catch { show("❌ خطأ"); }
  };

  const cardStyle = "bg-surface-card border border-surface-border rounded-2xl p-4";
  const btnStyle = "px-3 py-1.5 rounded-xl text-[11px] font-bold cursor-pointer transition-colors";

  return (
    <div dir="rtl" className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-black">🤖 إدارة البوت</h1>
        <button
          onClick={loadData}
          className={`${btnStyle} bg-brand/10 text-brand border border-brand/20 hover:bg-brand/20`}
        >
          🔄 تحديث
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`${btnStyle} ${tab === t.key ? "bg-brand text-white" : "bg-surface-card text-muted border border-surface-border hover:text-white"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Loading */}
      {loading && <div className="text-center py-10 text-muted">⏳</div>}

      {/* ===== ANALYTICS ===== */}
      {!loading && tab === "analytics" && (
        <div className="space-y-3">
          {/* Summary Cards */}
          {analytics.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: "محادثات", value: analytics.reduce((s, a) => s + a.total_conversations, 0), icon: "💬" },
                { label: "رسائل", value: analytics.reduce((s, a) => s + a.total_messages, 0), icon: "📨" },
                { label: "تحويلات", value: analytics.reduce((s, a) => s + a.handoffs, 0), icon: "👤" },
                { label: "نقرات المتجر", value: analytics.reduce((s, a) => s + a.store_clicks, 0), icon: "🛒" },
              ].map((c, i) => (
                <div key={i} className={cardStyle}>
                  <div className="text-muted text-[10px] mb-1">{c.icon} {c.label}</div>
                  <div className="text-xl font-black">{c.value.toLocaleString()}</div>
                </div>
              ))}
            </div>
          )}

          {/* Charts */}
          {analytics.length > 1 && (
            <div className="grid grid-cols-1 desktop:grid-cols-2 gap-3">
              <div className={cardStyle}>
                <h3 className="text-[10px] font-bold text-muted mb-2">💬 المحادثات</h3>
                <BotBarChart data={[...analytics].reverse()} valueKey="total_conversations" color="#10b981" />
              </div>
              <div className={cardStyle}>
                <h3 className="text-[10px] font-bold text-muted mb-2">👤 التصعيدات</h3>
                <BotBarChart data={[...analytics].reverse()} valueKey="handoffs" color="#ef4444" />
              </div>
              <div className={cardStyle}>
                <h3 className="text-[10px] font-bold text-muted mb-2">🛒 نقرات المتجر</h3>
                <BotBarChart data={[...analytics].reverse()} valueKey="store_clicks" color="#6366f1" />
              </div>
              <div className={cardStyle}>
                <h3 className="text-[10px] font-bold text-muted mb-2">📨 الرسائل</h3>
                <BotBarChart data={[...analytics].reverse()} valueKey="total_messages" color="#f59e0b" />
              </div>
            </div>
          )}

          {/* Daily Table */}
          <div className={cardStyle}>
            <h3 className="text-xs font-bold mb-3">📅 يومي (آخر 30 يوم)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted border-b border-surface-border">
                    <th className="py-2 text-right">التاريخ</th>
                    <th className="py-2 text-center">القناة</th>
                    <th className="py-2 text-center">محادثات</th>
                    <th className="py-2 text-center">رسائل</th>
                    <th className="py-2 text-center">تحويلات</th>
                    <th className="py-2 text-center">CSAT</th>
                    <th className="py-2 text-center">نقرات</th>
                  </tr>
                </thead>
                <tbody>
                  {analytics.map((a, i) => (
                    <tr key={i} className="border-b border-surface-border/50">
                      <td className="py-2">{new Date(a.date).toLocaleDateString("ar-EG")}</td>
                      <td className="py-2 text-center">{a.channel === "webchat" ? "💻" : "📱"}</td>
                      <td className="py-2 text-center">{a.total_conversations}</td>
                      <td className="py-2 text-center">{a.total_messages}</td>
                      <td className="py-2 text-center">{a.handoffs}</td>
                      <td className="py-2 text-center">{a.avg_csat ? `${a.avg_csat.toFixed(1)}⭐` : "—"}</td>
                      <td className="py-2 text-center">{a.store_clicks}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {analytics.length === 0 && <p className="text-muted text-center py-6 text-xs">لا توجد بيانات بعد</p>}
          </div>
        </div>
      )}

      {/* ===== TEMPLATES ===== */}
      {!loading && tab === "templates" && (
        <div className="space-y-3">
          {templates.map((t) => (
            <div key={t.id} className={cardStyle}>
              {editingTemplate?.id === t.id ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand">{t.key}</span>
                    <label className="flex items-center gap-2 text-[10px]">
                      <input
                        type="checkbox"
                        checked={editingTemplate.active}
                        onChange={(e) => setEditingTemplate({ ...editingTemplate, active: e.target.checked })}
                        className="accent-brand"
                      />
                      مفعّل
                    </label>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">المحتوى (عربي)</label>
                    <textarea
                      value={editingTemplate.content_ar}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content_ar: e.target.value })}
                      className="w-full bg-surface-elevated border border-surface-border rounded-xl p-2 text-white text-xs min-h-[80px] outline-none"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">המתוכן (עברית)</label>
                    <textarea
                      value={editingTemplate.content_he}
                      onChange={(e) => setEditingTemplate({ ...editingTemplate, content_he: e.target.value })}
                      className="w-full bg-surface-elevated border border-surface-border rounded-xl p-2 text-white text-xs min-h-[80px] outline-none"
                      dir="rtl"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => saveTemplate(editingTemplate)} className={`${btnStyle} bg-green-600 text-white`}>💾 حفظ</button>
                    <button onClick={() => setEditingTemplate(null)} className={`${btnStyle} bg-surface-elevated text-muted border border-surface-border`}>إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{t.key}</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${t.active ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                        {t.active ? "مفعّل" : "معطّل"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted line-clamp-2">{t.content_ar}</p>
                  </div>
                  <button
                    onClick={() => setEditingTemplate({ ...t })}
                    className={`${btnStyle} bg-brand/10 text-brand border border-brand/20`}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          ))}
          {templates.length === 0 && <p className="text-muted text-center py-6 text-xs">لا توجد قوالب</p>}
        </div>
      )}

      {/* ===== POLICIES ===== */}
      {!loading && tab === "policies" && (
        <div className="space-y-3">
          {policies.map((p) => (
            <div key={p.id} className={cardStyle}>
              {editingPolicy?.id === p.id ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-brand">{p.type}</span>
                    <label className="flex items-center gap-2 text-[10px]">
                      <input
                        type="checkbox"
                        checked={editingPolicy.active}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, active: e.target.checked })}
                        className="accent-brand"
                      />
                      مفعّل
                    </label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-muted block mb-1">العنوان (عربي)</label>
                      <input
                        value={editingPolicy.title_ar}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, title_ar: e.target.value })}
                        className="w-full bg-surface-elevated border border-surface-border rounded-xl p-2 text-white text-xs outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-muted block mb-1">הכותרת (עברית)</label>
                      <input
                        value={editingPolicy.title_he}
                        onChange={(e) => setEditingPolicy({ ...editingPolicy, title_he: e.target.value })}
                        className="w-full bg-surface-elevated border border-surface-border rounded-xl p-2 text-white text-xs outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">المحتوى (عربي)</label>
                    <textarea
                      value={editingPolicy.content_ar}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, content_ar: e.target.value })}
                      className="w-full bg-surface-elevated border border-surface-border rounded-xl p-2 text-white text-xs min-h-[100px] outline-none"
                      dir="rtl"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted block mb-1">התוכן (עברית)</label>
                    <textarea
                      value={editingPolicy.content_he}
                      onChange={(e) => setEditingPolicy({ ...editingPolicy, content_he: e.target.value })}
                      className="w-full bg-surface-elevated border border-surface-border rounded-xl p-2 text-white text-xs min-h-[100px] outline-none"
                      dir="rtl"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => savePolicy(editingPolicy)} className={`${btnStyle} bg-green-600 text-white`}>💾 حفظ</button>
                    <button onClick={() => setEditingPolicy(null)} className={`${btnStyle} bg-surface-elevated text-muted border border-surface-border`}>إلغاء</button>
                  </div>
                </div>
              ) : (
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-bold">{p.title_ar}</span>
                      <span className="text-[9px] text-muted">({p.type})</span>
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${p.active ? "bg-green-600/20 text-green-400" : "bg-red-600/20 text-red-400"}`}>
                        {p.active ? "مفعّل" : "معطّل"}
                      </span>
                    </div>
                    <p className="text-[11px] text-muted line-clamp-2">{p.content_ar}</p>
                  </div>
                  <button
                    onClick={() => setEditingPolicy({ ...p })}
                    className={`${btnStyle} bg-brand/10 text-brand border border-brand/20`}
                  >
                    ✏️
                  </button>
                </div>
              )}
            </div>
          ))}
          {policies.length === 0 && <p className="text-muted text-center py-6 text-xs">لا توجد سياسات</p>}
        </div>
      )}

      {/* ===== HANDOFFS ===== */}
      {!loading && tab === "handoffs" && (
        <div className="space-y-3">
          {handoffs.map((h) => (
            <div key={h.id} className={cardStyle}>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${h.status === "pending" ? "bg-yellow-600/20 text-yellow-400" : h.status === "resolved" ? "bg-green-600/20 text-green-400" : "bg-blue-600/20 text-blue-400"}`}>
                      {h.status === "pending" ? "⏳ معلّق" : h.status === "resolved" ? "✅ تم الحل" : "🔄 " + h.status}
                    </span>
                    <span className="text-[10px] text-muted">{new Date(h.created_at).toLocaleString("ar-EG")}</span>
                  </div>
                  {h.customer_name && <p className="text-xs font-bold">👤 {h.customer_name}</p>}
                  {h.customer_phone && <p className="text-[10px] text-muted">📞 {h.customer_phone}</p>}
                  <p className="text-[10px] mt-1">السبب: {h.reason}</p>
                  {h.summary && <p className="text-[10px] text-muted mt-1 line-clamp-3">{h.summary}</p>}
                </div>
                {h.status === "pending" && (
                  <button
                    onClick={() => resolveHandoff(h.id)}
                    className={`${btnStyle} bg-green-600/10 text-green-400 border border-green-600/20`}
                  >
                    ✅ حل
                  </button>
                )}
              </div>
            </div>
          ))}
          {handoffs.length === 0 && <p className="text-muted text-center py-6 text-xs">لا توجد تحويلات</p>}
        </div>
      )}

      {/* ===== CONVERSATIONS ===== */}
      {!loading && tab === "conversations" && (
        <div className="space-y-3">
          {conversations.map((c) => (
            <div key={c.id} className={cardStyle}>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs">{c.channel === "webchat" ? "💻" : "📱"}</span>
                  <span className="text-[10px] font-bold">{c.visitor_id?.slice(0, 20)}</span>
                  {c.customer_name && <span className="text-[10px] text-brand">({c.customer_name})</span>}
                </div>
                <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${c.status === "active" ? "bg-green-600/20 text-green-400" : c.status === "escalated" ? "bg-yellow-600/20 text-yellow-400" : "bg-zinc-600/20 text-zinc-400"}`}>
                  {c.status}
                </span>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted">
                <span>💬 {c.message_count} رسالة</span>
                <span>🌐 {c.language}</span>
                <span>{new Date(c.updated_at).toLocaleString("ar-EG")}</span>
              </div>
            </div>
          ))}
          {conversations.length === 0 && <p className="text-muted text-center py-6 text-xs">لا توجد محادثات</p>}
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-4 left-4 z-50 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className="bg-surface-card border border-surface-border rounded-xl px-4 py-2 text-xs shadow-2xl animate-in slide-in-from-bottom-2">
            {t.message}
          </div>
        ))}
      </div>
    </div>
  );
}

function BotBarChart({ data, valueKey, color }: {
  data: { date: string; [key: string]: any }[];
  valueKey: string;
  color: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(...data.map((d) => d[valueKey] || 0), 1);
  return (
    <div>
      <div className="flex items-end gap-[2px]" style={{ height: 80 }}>
        {data.map((d, i) => {
          const val = d[valueKey] || 0;
          const h = Math.max((val / max) * 100, 2);
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm hover:opacity-80"
              style={{ height: `${h}%`, background: color, minWidth: 3 }}
              title={`${new Date(d.date).toLocaleDateString("ar-EG")}: ${val}`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[8px] text-dim mt-1">
        <span>{new Date(data[0]?.date).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
        <span>{new Date(data[data.length - 1]?.date).toLocaleDateString("ar-EG", { day: "numeric", month: "short" })}</span>
      </div>
    </div>
  );
}
