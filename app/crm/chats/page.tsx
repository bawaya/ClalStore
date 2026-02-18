"use client";

import { useState, useEffect, useCallback } from "react";
import { useScreen } from "@/lib/hooks";
import { StatCard } from "@/components/admin/shared";
import { formatDateTime, timeAgo } from "@/lib/utils";

interface Conversation {
  id: string;
  visitor_id: string;
  channel: "webchat" | "whatsapp" | "sms";
  status: "active" | "closed" | "escalated";
  language: string;
  intent?: string;
  customer_name?: string;
  customer_phone?: string;
  customer_id?: string;
  customer?: { id: string; name: string; phone?: string; email?: string } | null;
  message_count: number;
  last_message?: { content: string; role: string; created_at: string } | null;
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  conversation_id: string;
  role: "user" | "bot" | "system";
  content: string;
  intent?: string;
  created_at: string;
}

interface ChatStats {
  total: number;
  whatsapp: number;
  webchat: number;
  sms: number;
  active: number;
  escalated: number;
  intentCounts: Record<string, number>;
}

const INTENT_LABELS: Record<string, string> = {
  greeting: "👋 ترحيب", products: "📱 منتجات", product_search: "🔍 بحث",
  lines: "📡 باقات", order_status: "📦 حالة طلب", order_create: "🛒 طلب جديد",
  support: "🛠️ دعم", human: "👤 تحويل لموظف", hours: "⏰ ساعات",
  location: "📍 موقع", thanks: "🙏 شكراً", unknown: "❓ غير معروف",
  brand_search: "🔍 بحث ماركة", installment: "💳 تقسيط",
  availability: "📦 توفر", return_policy: "📋 سياسة إرجاع",
};

export default function ChatsPage() {
  const scr = useScreen();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [stats, setStats] = useState<ChatStats | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMsgs, setLoadingMsgs] = useState(false);
  const [filter, setFilter] = useState<"all" | "whatsapp" | "webchat" | "sms">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "closed" | "escalated">("all");
  const [search, setSearch] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (filter !== "all") params.set("channel", filter);
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (search) params.set("search", search);
      params.set("limit", "100");

      const [convosRes, statsRes] = await Promise.all([
        fetch(`/api/crm/chats?${params}`),
        fetch("/api/crm/chats?stats=true"),
      ]);
      const convosData = await convosRes.json();
      const statsData = await statsRes.json();
      setConversations(convosData.conversations || []);
      setStats(statsData);
    } catch (err) {
      console.error("Chats fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [filter, statusFilter, search]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openChat = async (id: string) => {
    setSelectedId(id);
    setLoadingMsgs(true);
    try {
      const res = await fetch(`/api/crm/chats/${id}/messages`);
      const data = await res.json();
      setMessages(data.data || []);
    } catch { setMessages([]); }
    finally { setLoadingMsgs(false); }
  };

  const closeChat = async (id: string) => {
    try {
      await fetch(`/api/crm/chats/${id}/messages`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "close" }),
      });
      setConversations((prev) => prev.map((c) => c.id === id ? { ...c, status: "closed" as const } : c));
      if (selectedId === id) setSelectedId(null);
    } catch (err) { console.error("Close error:", err); }
  };

  const filtered = conversations;
  const selected = conversations.find((c) => c.id === selectedId);

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <h1 className="font-black mb-4" style={{ fontSize: scr.mobile ? 16 : 22 }}>💬 المحادثات</h1>

      {/* Stats */}
      <div className="grid gap-2 mb-4" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
        <StatCard icon="💬" label="إجمالي المحادثات" value={stats?.total || 0} />
        <StatCard icon="📱" label="واتساب" value={stats?.whatsapp || 0} color="#25d366" />
        <StatCard icon="🌐" label="ويب شات" value={stats?.webchat || 0} color="#3b82f6" />
        <StatCard icon="👤" label="تحويل لموظف" value={stats?.escalated || 0} color="#f97316" />
      </div>

      {/* Intent distribution */}
      {stats && Object.keys(stats.intentCounts).length > 0 && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 12 : 14 }}>🧠 توزيع النوايا</h3>
          <div className="flex gap-1.5 flex-wrap">
            {Object.entries(stats.intentCounts).sort((a, b) => b[1] - a[1]).map(([intent, count]) => (
              <span key={intent} className="badge bg-surface-elevated text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                {INTENT_LABELS[intent] || intent}: {count}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="mb-3">
        <input
          className="input w-full"
          placeholder="🔍 بحث بالاسم أو الهاتف أو الزائر..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Filters — Channel */}
      <div className="flex gap-1 mb-2">
        {[
          { k: "all" as const, l: "الكل" },
          { k: "whatsapp" as const, l: "📱 واتساب" },
          { k: "webchat" as const, l: "🌐 ويب شات" },
          { k: "sms" as const, l: "📩 SMS" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`chip ${filter === f.k ? "chip-active" : ""}`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Filters — Status */}
      <div className="flex gap-1 mb-3">
        {[
          { k: "all" as const, l: "كل الحالات" },
          { k: "active" as const, l: "🟢 نشط" },
          { k: "closed" as const, l: "⚪ مغلق" },
          { k: "escalated" as const, l: "🔴 تحويل" },
        ].map((f) => (
          <button key={f.k} onClick={() => setStatusFilter(f.k)}
            className={`chip ${statusFilter === f.k ? "chip-active" : ""}`}>
            {f.l}
          </button>
        ))}
      </div>

      {/* Main content: list + chat viewer */}
      <div style={{ display: scr.mobile ? "block" : "flex", gap: 12 }}>
        {/* Conversations list */}
        <div className={selectedId && !scr.mobile ? "w-2/5" : "w-full"} style={selectedId && scr.mobile ? { display: "none" } : undefined}>
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-dim">
              <div className="text-3xl mb-2">💬</div>
              <div className="text-sm">لا توجد محادثات بعد</div>
              <div className="text-muted text-xs mt-1">المحادثات ستظهر هنا عندما يتواصل العملاء عبر الشات أو الواتساب</div>
            </div>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => {
                const isActive = c.status === "active";
                const isEscalated = c.status === "escalated";
                const isSelected = c.id === selectedId;
                return (
                  <button key={c.id} onClick={() => openChat(c.id)}
                    className="w-full text-right bg-surface-elevated rounded-xl cursor-pointer border-0 transition-colors hover:bg-surface-input block"
                    style={{
                      padding: scr.mobile ? "8px 10px" : "10px 14px",
                      borderRight: isSelected ? "3px solid #c41040" : isEscalated ? "3px solid #f97316" : isActive ? "3px solid #22c55e" : "3px solid transparent",
                      background: isSelected ? "rgba(196,16,64,0.08)" : undefined,
                    }}>
                    <div className="flex items-center gap-2">
                      <span className="text-lg flex-shrink-0">
                        {c.channel === "whatsapp" ? "📱" : c.channel === "sms" ? "📩" : "🌐"}
                      </span>
                      <div className="flex-1 text-right">
                        <div className="flex items-center justify-between">
                          <span className="text-muted text-[10px]">{timeAgo(c.updated_at)}</span>
                          <span className="font-bold" style={{ fontSize: scr.mobile ? 11 : 13 }}>
                            {c.customer_name || c.visitor_id.slice(0, 12)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                          <span className="text-[9px] px-1.5 py-0.5 rounded-md"
                            style={{
                              background: isEscalated ? "rgba(249,115,22,0.15)" : isActive ? "rgba(34,197,94,0.15)" : "rgba(113,113,122,0.15)",
                              color: isEscalated ? "#f97316" : isActive ? "#22c55e" : "#71717a",
                            }}>
                            {isEscalated ? "تحويل" : isActive ? "نشط" : "مغلق"}
                          </span>
                          <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 10 }}>
                            {c.intent ? (INTENT_LABELS[c.intent] || c.intent) : ""} • {c.message_count} رسالة
                            {c.customer_phone && <span className="mr-1">📞</span>}
                          </div>
                        </div>
                        {c.last_message && (
                          <div className="text-muted truncate mt-0.5" style={{ fontSize: scr.mobile ? 9 : 10, maxWidth: "100%" }}>
                            {c.last_message.role === "bot" ? "🤖 " : c.last_message.role === "user" ? "👤 " : ""}
                            {c.last_message.content.length > 60 ? c.last_message.content.slice(0, 60) + "…" : c.last_message.content}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Chat viewer */}
        {selectedId && (
          <div className={scr.mobile ? "w-full" : "flex-1"}>
            <div className="card" style={{ padding: 0 }}>
              {/* Header */}
              <div className="flex items-center justify-between border-b border-surface-border" style={{ padding: scr.mobile ? "8px 10px" : "10px 14px" }}>
                <div className="flex gap-1">
                  {selected?.status !== "closed" && (
                    <button onClick={() => closeChat(selectedId)} className="chip text-[9px]" title="إغلاق المحادثة">✕ إغلاق</button>
                  )}
                </div>
                <div className="text-right flex items-center gap-2">
                  {scr.mobile && (
                    <button onClick={() => setSelectedId(null)} className="text-muted text-xs bg-transparent border-0 cursor-pointer p-1">→ رجوع</button>
                  )}
                  <div>
                    <div className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                      {selected?.customer_name || selected?.visitor_id.slice(0, 16)}
                    </div>
                    <div className="text-muted text-[10px]">
                      {selected?.channel === "whatsapp" ? "📱 واتساب" : selected?.channel === "sms" ? "📩 SMS" : "🌐 ويب شات"}
                      {selected?.customer_phone && ` • ${selected.customer_phone}`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div className="overflow-y-auto" style={{ maxHeight: scr.mobile ? 300 : 400, padding: scr.mobile ? 8 : 12 }}>
                {loadingMsgs ? (
                  <div className="text-center py-10 text-muted text-sm">⏳</div>
                ) : messages.length === 0 ? (
                  <div className="text-center py-10 text-dim text-sm">لا توجد رسائل</div>
                ) : (
                  <div className="space-y-2">
                    {messages.map((m) => (
                      <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                        <div className="max-w-[80%] rounded-xl px-3 py-2" style={{
                          background: m.role === "user" ? "rgba(196,16,64,0.15)" : m.role === "system" ? "rgba(249,115,22,0.1)" : "rgba(59,130,246,0.1)",
                          textAlign: "right",
                        }}>
                          <div className="text-[9px] text-muted mb-0.5">
                            {m.role === "user" ? "👤 العميل" : m.role === "system" ? "⚙️ النظام" : "🤖 البوت"}
                            {m.intent && <span className="mr-1">[{m.intent}]</span>}
                          </div>
                          <div style={{ fontSize: scr.mobile ? 11 : 13, whiteSpace: "pre-wrap" }}>{m.content}</div>
                          <div className="text-[8px] text-dim mt-0.5">{formatDateTime(m.created_at)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
