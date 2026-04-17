"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { CUSTOMER_SEGMENT } from "@/lib/constants";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";

type Tab = "summary" | "orders" | "hot" | "timeline" | "conversations" | "deals" | "notes";

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "summary", label: "ملخص", icon: "📊" },
  { key: "orders", label: "طلبات", icon: "📦" },
  { key: "hot", label: "حسابات HOT", icon: "🔥" },
  { key: "timeline", label: "Timeline", icon: "🕒" },
  { key: "conversations", label: "محادثات", icon: "💬" },
  { key: "deals", label: "صفقات", icon: "🤝" },
  { key: "notes", label: "ملاحظات", icon: "📝" },
];

const HOT_STATUS_MAP: Record<string, { label: string; color: string }> = {
  pending: { label: "قيد الانتظار", color: "#f59e0b" },
  verified: { label: "تم التحقق", color: "#06b6d4" },
  active: { label: "نشط", color: "#22c55e" },
  inactive: { label: "غير نشط", color: "#6b7280" },
  conflict: { label: "تعارض", color: "#ef4444" },
  transferred: { label: "محوّل", color: "#8b5cf6" },
};

const TIMELINE_ICON_MAP: Record<string, string> = {
  order: "📦",
  deal: "🤝",
  conversation: "💬",
  note: "📝",
  hot: "🔥",
  audit: "🛡️",
};

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const scr = useScreen();

  const [tab, setTab] = useState<Tab>("summary");
  const [customer, setCustomer] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [notes, setNotes] = useState<any[]>([]);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [hotAccounts, setHotAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<any>({});
  const [saving, setSaving] = useState(false);

  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  const [hotFormOpen, setHotFormOpen] = useState(false);
  const [editingHotId, setEditingHotId] = useState<string | null>(null);
  const [savingHot, setSavingHot] = useState(false);
  const [hotData, setHotData] = useState<any>({
    hot_mobile_id: "",
    hot_customer_code: "",
    line_phone: "",
    label: "",
    status: "pending",
    is_primary: false,
    notes: "",
  });

  const fetch360 = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/customers/${id}/360`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطأ في جلب بيانات العميل");
      }
      const json = await res.json();
      const data = json.data ?? json;
      setCustomer(data.customer);
      setOrders(data.orders || []);
      setDeals(data.deals || []);
      setConversations(data.conversations || []);
      setNotes(data.notes || []);
      setHotAccounts(data.hotAccounts || []);
      setTimeline(data.timeline || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetch360();
  }, [fetch360]);

  const startEdit = () => {
    setEditForm({
      name: customer?.name || "",
      phone: customer?.phone || "",
      email: customer?.email || "",
      city: customer?.city || "",
      address: customer?.address || "",
      id_number: customer?.id_number || "",
      segment: customer?.segment || "new",
      birthday: customer?.birthday || "",
      gender: customer?.gender || "",
      notes: customer?.notes || "",
    });
    setEditing(true);
  };

  const saveEdit = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل التحديث");
      }
      setEditing(false);
      await fetch360();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const addNote = async () => {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/crm/customers/${id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل إضافة الملاحظة");
      }
      setNoteText("");
      await fetch360();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setAddingNote(false);
    }
  };

  const resetHotForm = () => {
    setHotData({
      hot_mobile_id: "",
      hot_customer_code: "",
      line_phone: "",
      label: "",
      status: "pending",
      is_primary: false,
      notes: "",
    });
    setEditingHotId(null);
    setHotFormOpen(false);
  };

  const saveHotAccount = async () => {
    setSavingHot(true);
    try {
      const url = editingHotId
        ? `/api/crm/customers/${id}/hot-accounts?accountId=${editingHotId}`
        : `/api/crm/customers/${id}/hot-accounts`;
      const res = await fetch(url, {
        method: editingHotId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(hotData),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل حفظ حساب HOT");
      }
      resetHotForm();
      await fetch360();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSavingHot(false);
    }
  };

  const archiveHotAccount = async (accountId: string) => {
    try {
      const res = await fetch(`/api/crm/customers/${id}/hot-accounts?accountId=${accountId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل أرشفة حساب HOT");
      }
      await fetch360();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    }
  };

  const startEditHot = (account: any) => {
    setHotData({
      hot_mobile_id: account.hot_mobile_id || "",
      hot_customer_code: account.hot_customer_code || "",
      line_phone: account.line_phone || "",
      label: account.label || "",
      status: account.status || "pending",
      is_primary: account.is_primary || false,
      notes: account.notes || "",
    });
    setEditingHotId(account.id);
    setHotFormOpen(true);
  };

  if (loading) {
    return <div className="py-12 text-center text-muted">⏳ جاري التحميل...</div>;
  }

  if (!customer) {
    return (
      <div className="py-12 text-center text-dim">
        <div className="mb-2 text-3xl">❌</div>
        <div className="text-sm">{error || "العميل غير موجود"}</div>
        <button onClick={() => router.push("/crm/customers")} className="btn mt-3 text-sm">
          ← العودة للقائمة
        </button>
      </div>
    );
  }

  const segment = CUSTOMER_SEGMENT[customer.segment as keyof typeof CUSTOMER_SEGMENT];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push("/crm/customers")}
            className="text-lg text-muted hover:text-white"
          >
            ←
          </button>
          <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>
            👤 {customer.name}
          </h1>
          {segment && (
            <span className="badge" style={{ background: `${segment.color}15`, color: segment.color }}>
              {segment.icon} {segment.label}
            </span>
          )}
        </div>
        <button onClick={startEdit} className="btn text-xs">
          ✏️ تعديل
        </button>
      </div>

      {error && <div className="mb-2 py-2 text-center text-sm text-red-400">⚠️ {error}</div>}

      <div
        className="mb-3 grid gap-2"
        style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}
      >
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-[10px] text-muted">الإنفاق</div>
          <div className="font-black text-brand">{formatCurrency(customer.total_spent)}</div>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-[10px] text-muted">الطلبات</div>
          <div className="font-black">{customer.total_orders}</div>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-[10px] text-muted">المتوسط</div>
          <div className="font-black">{formatCurrency(customer.avg_order_value)}</div>
        </div>
        <div className="rounded-xl bg-surface-elevated p-3 text-center">
          <div className="text-[10px] text-muted">HOT</div>
          <div className="font-black">{hotAccounts.length}</div>
        </div>
      </div>

      <div className="mb-3 flex gap-1 overflow-x-auto">
        {TABS.map((item) => (
          <button
            key={item.key}
            onClick={() => setTab(item.key)}
            className={`chip whitespace-nowrap ${tab === item.key ? "chip-active" : ""}`}
          >
            {item.icon} {item.label}
          </button>
        ))}
      </div>

      {tab === "summary" && (
        <div className="space-y-3">
          <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
            <div className="mb-2 text-right text-xs font-bold">📋 معلومات العميل</div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <div className="text-xs text-muted">📞 {customer.phone}</div>
              <div className="text-xs text-muted">📧 {customer.email || "—"}</div>
              <div className="text-xs text-muted">🏙️ {customer.city || "—"}</div>
              <div className="text-xs text-muted">📍 {customer.address || "—"}</div>
              <div className="text-xs text-muted">🪪 {customer.id_number || "—"}</div>
              <div className="text-xs text-muted">🕐 منذ: {timeAgo(customer.created_at)}</div>
              {customer.customer_code && (
                <div className="col-span-2 text-xs text-muted">
                  🎟️ كود العميل: <span className="font-mono text-brand">{customer.customer_code}</span>
                </div>
              )}
            </div>
            {customer.tags?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {customer.tags.map((tag: string) => (
                  <span key={tag} className="badge bg-brand/10 text-brand">
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {timeline.length > 0 && (
            <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
              <div className="mb-2 text-right text-xs font-bold">🕒 آخر النشاطات</div>
              <div className="space-y-2">
                {timeline.slice(0, 5).map((entry: any) => (
                  <div
                    key={entry.id}
                    className="flex items-start justify-between gap-3 rounded-xl border border-surface-border bg-surface-elevated p-3"
                  >
                    <div className="text-left text-[10px] text-muted">
                      <div>{formatDate(entry.createdAt)}</div>
                      <div>{timeAgo(entry.createdAt)}</div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-sm font-bold text-white">
                        {(TIMELINE_ICON_MAP[entry.type] || "🕒")} {entry.title}
                      </div>
                      {entry.description && (
                        <div className="mt-1 text-[11px] text-muted">{entry.description}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "orders" && (
        <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
          <div className="mb-2 text-right text-xs font-bold">📦 سجل الطلبات ({orders.length})</div>
          {orders.length === 0 ? (
            <div className="py-4 text-center text-xs text-dim">لا يوجد طلبات</div>
          ) : (
            orders.map((order: any) => (
              <div key={order.id} className="border-b border-surface-border py-2 last:border-0">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-brand">{formatCurrency(Number(order.total))}</span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{order.id}</div>
                    <div className="text-[10px] text-muted">
                      {order.status} • {order.source} • {formatDate(order.created_at)}
                    </div>
                    {order.order_items?.length > 0 && (
                      <div className="text-[9px] text-muted">
                        {order.order_items.map((item: any) => item.product_name).join("، ")}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "hot" && (
        <div className="space-y-3">
          {hotFormOpen ? (
            <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
              <div className="mb-2 flex items-center justify-between">
                <button onClick={resetHotForm} className="text-xs text-muted">
                  ✕ إلغاء
                </button>
                <div className="text-right text-xs font-bold">
                  🔥 {editingHotId ? "تعديل" : "إضافة"} حساب HOT
                </div>
              </div>

              <div className="space-y-2">
                <div>
                  <label className="mb-0.5 block text-right text-[10px] text-muted">معرّف HOT Mobile</label>
                  <input
                    className="input w-full"
                    value={hotData.hot_mobile_id}
                    onChange={(event) => setHotData({ ...hotData, hot_mobile_id: event.target.value })}
                    dir="ltr"
                    placeholder="HOT Mobile ID"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-right text-[10px] text-muted">كود عميل HOT</label>
                  <input
                    className="input w-full"
                    value={hotData.hot_customer_code}
                    onChange={(event) =>
                      setHotData({ ...hotData, hot_customer_code: event.target.value })
                    }
                    dir="ltr"
                    placeholder="HOT Customer Code"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-right text-[10px] text-muted">رقم الخط</label>
                  <input
                    className="input w-full"
                    value={hotData.line_phone}
                    onChange={(event) => setHotData({ ...hotData, line_phone: event.target.value })}
                    dir="ltr"
                    placeholder="05XXXXXXXX"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-right text-[10px] text-muted">التسمية</label>
                  <input
                    className="input w-full"
                    value={hotData.label}
                    onChange={(event) => setHotData({ ...hotData, label: event.target.value })}
                    placeholder="مثلاً: الحساب الرئيسي"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-right text-[10px] text-muted">الحالة</label>
                    <select
                      className="input w-full"
                      value={hotData.status}
                      onChange={(event) => setHotData({ ...hotData, status: event.target.value })}
                    >
                      {Object.entries(HOT_STATUS_MAP).map(([key, value]) => (
                        <option key={key} value={key}>
                          {value.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end pb-1">
                    <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={hotData.is_primary}
                        onChange={(event) =>
                          setHotData({ ...hotData, is_primary: event.target.checked })
                        }
                      />
                      حساب رئيسي ⭐
                    </label>
                  </div>
                </div>
                <div>
                  <label className="mb-0.5 block text-right text-[10px] text-muted">ملاحظات</label>
                  <textarea
                    className="input w-full"
                    rows={2}
                    value={hotData.notes}
                    onChange={(event) => setHotData({ ...hotData, notes: event.target.value })}
                  />
                </div>
                <button onClick={saveHotAccount} disabled={savingHot} className="btn-brand w-full text-xs">
                  {savingHot ? "⏳ جاري الحفظ..." : "💾 حفظ"}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setHotFormOpen(true)} className="btn-brand w-full text-xs">
              ➕ إضافة حساب HOT
            </button>
          )}

          <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
            <div className="mb-2 text-right text-xs font-bold">
              🔥 حسابات HOT Mobile ({hotAccounts.length})
            </div>
            {hotAccounts.length === 0 ? (
              <div className="py-4 text-center text-xs text-dim">لا يوجد حسابات HOT مرتبطة</div>
            ) : (
              hotAccounts.map((account: any) => {
                const status = HOT_STATUS_MAP[account.status] || HOT_STATUS_MAP.pending;
                return (
                  <div key={account.id} className="border-b border-surface-border py-2 last:border-0">
                    <div className="flex items-start justify-between">
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEditHot(account)}
                          className="text-[10px] text-muted hover:text-white"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => archiveHotAccount(account.id)}
                          className="text-[10px] text-muted hover:text-red-400"
                        >
                          🗑️
                        </button>
                      </div>
                      <div className="flex-1 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {account.is_primary && <span className="text-[9px] text-yellow-400">⭐</span>}
                          <span className="text-sm font-bold">
                            {account.label || account.hot_customer_code || account.hot_mobile_id}
                          </span>
                          <span
                            className="badge text-[9px]"
                            style={{ background: `${status.color}20`, color: status.color }}
                          >
                            {status.label}
                          </span>
                        </div>
                        <div className="mt-0.5 space-x-2 space-x-reverse text-[10px] text-muted">
                          {account.hot_mobile_id && <span>ID: {account.hot_mobile_id}</span>}
                          {account.hot_customer_code && <span>Code: {account.hot_customer_code}</span>}
                          {account.line_phone && <span>📱 {account.line_phone}</span>}
                        </div>
                        {account.notes && <div className="mt-0.5 text-[9px] text-muted">📝 {account.notes}</div>}
                        <div className="mt-0.5 text-[9px] text-muted">
                          {account.source} • {timeAgo(account.created_at)}
                          {account.created_by_name && ` • ${account.created_by_name}`}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {tab === "timeline" && (
        <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
          <div className="mb-2 text-right text-xs font-bold">🕒 Timeline ({timeline.length})</div>
          {timeline.length === 0 ? (
            <div className="py-4 text-center text-xs text-dim">لا يوجد سجل زمني بعد</div>
          ) : (
            <div className="space-y-2">
              {timeline.map((entry: any) => (
                <div
                  key={entry.id}
                  className="rounded-xl border border-surface-border bg-surface-elevated p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-left text-[10px] text-muted">
                      <div>{formatDate(entry.createdAt)}</div>
                      <div>{timeAgo(entry.createdAt)}</div>
                    </div>
                    <div className="flex-1 text-right">
                      <div className="text-sm font-bold text-white">
                        {(TIMELINE_ICON_MAP[entry.type] || "🕒")} {entry.title}
                      </div>
                      {entry.description && (
                        <div className="mt-1 text-[11px] text-muted">{entry.description}</div>
                      )}
                      {entry.actorName && (
                        <div className="mt-1 text-[10px] text-brand">بواسطة: {entry.actorName}</div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "conversations" && (
        <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
          <div className="mb-2 text-right text-xs font-bold">💬 المحادثات ({conversations.length})</div>
          {conversations.length === 0 ? (
            <div className="py-4 text-center text-xs text-dim">لا يوجد محادثات</div>
          ) : (
            conversations.map((conversation: any) => (
              <div key={conversation.id} className="border-b border-surface-border py-2 last:border-0">
                <div className="flex justify-between">
                  <span
                    className={`badge text-[9px] ${
                      conversation.status === "active"
                        ? "bg-green-500/20 text-green-400"
                        : "bg-gray-500/20 text-gray-400"
                    }`}
                  >
                    {conversation.status}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-bold">{conversation.channel || "webchat"}</div>
                    <div className="text-[10px] text-muted">
                      {conversation.customer_name || "—"} • {timeAgo(conversation.updated_at)}
                    </div>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "deals" && (
        <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
          <div className="mb-2 text-right text-xs font-bold">🤝 الصفقات ({deals.length})</div>
          {deals.length === 0 ? (
            <div className="py-4 text-center text-xs text-dim">لا يوجد صفقات</div>
          ) : (
            deals.map((deal: any) => (
              <div key={deal.id} className="border-b border-surface-border py-2 last:border-0">
                <div className="flex justify-between">
                  <span className="text-sm font-bold text-brand">
                    {formatCurrency(Number(deal.estimated_value || deal.value || 0))}
                  </span>
                  <div className="text-right">
                    <div className="text-sm font-bold">
                      {deal.product_name || deal.product_summary || "صفقة"}
                    </div>
                    <div className="text-[10px] text-muted">
                      {deal.stage} • {deal.employee_name || "—"} • {formatDate(deal.created_at)}
                    </div>
                    {deal.order_id && (
                      <div className="text-[9px] text-green-400">✅ تم التحويل → {deal.order_id}</div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "notes" && (
        <div className="space-y-3">
          <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
            <div className="mb-2 text-right text-xs font-bold">📝 إضافة ملاحظة</div>
            <div className="flex gap-2">
              <button
                onClick={addNote}
                disabled={addingNote || !noteText.trim()}
                className="btn-brand flex-shrink-0 text-xs"
              >
                {addingNote ? "⏳" : "💾"}
              </button>
              <textarea
                className="input flex-1"
                rows={2}
                value={noteText}
                onChange={(event) => setNoteText(event.target.value)}
                placeholder="اكتب ملاحظة..."
              />
            </div>
          </div>

          <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
            <div className="mb-2 text-right text-xs font-bold">📝 الملاحظات ({notes.length})</div>
            {notes.length === 0 ? (
              <div className="py-4 text-center text-xs text-dim">لا يوجد ملاحظات</div>
            ) : (
              notes.map((note: any) => (
                <div key={note.id} className="border-b border-surface-border py-2 last:border-0">
                  <div className="text-right text-sm">{note.text}</div>
                  <div className="mt-1 text-right text-[10px] text-muted">
                    {note.user_name} • {timeAgo(note.created_at)}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full overflow-y-auto rounded-2xl bg-surface"
            style={{ maxWidth: 500, maxHeight: "85vh", padding: scr.mobile ? 16 : 24 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => setEditing(false)} className="text-sm text-muted">
                ✕
              </button>
              <h2 className="text-sm font-black">✏️ تعديل العميل</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-right text-xs text-muted">الاسم</label>
                <input
                  className="input w-full"
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">الهاتف</label>
                <input
                  className="input w-full"
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">إيميل</label>
                <input
                  className="input w-full"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">المدينة</label>
                <input
                  className="input w-full"
                  value={editForm.city}
                  onChange={(event) => setEditForm({ ...editForm, city: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">العنوان</label>
                <input
                  className="input w-full"
                  value={editForm.address}
                  onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">رقم الهوية</label>
                <input
                  className="input w-full"
                  value={editForm.id_number}
                  onChange={(event) => setEditForm({ ...editForm, id_number: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">التصنيف</label>
                <select
                  className="input w-full"
                  value={editForm.segment}
                  onChange={(event) => setEditForm({ ...editForm, segment: event.target.value })}
                >
                  {Object.entries(CUSTOMER_SEGMENT).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.icon} {value.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">تاريخ الميلاد</label>
                <input
                  type="date"
                  className="input w-full"
                  value={editForm.birthday}
                  onChange={(event) => setEditForm({ ...editForm, birthday: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">ملاحظات</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                />
              </div>
              <button onClick={saveEdit} disabled={saving} className="btn-brand w-full">
                {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full overflow-y-auto rounded-2xl bg-surface"
            style={{ maxWidth: 500, maxHeight: "85vh", padding: scr.mobile ? 16 : 24 }}
          >
            <div className="mb-4 flex items-center justify-between">
              <button onClick={() => setEditing(false)} className="text-sm text-muted">
                ✕
              </button>
              <h2 className="text-sm font-black">✏️ تعديل العميل</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="mb-1 block text-right text-xs text-muted">الاسم</label>
                <input
                  className="input w-full"
                  value={editForm.name}
                  onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">الهاتف</label>
                <input
                  className="input w-full"
                  value={editForm.phone}
                  onChange={(event) => setEditForm({ ...editForm, phone: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">إيميل</label>
                <input
                  className="input w-full"
                  value={editForm.email}
                  onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">المدينة</label>
                <input
                  className="input w-full"
                  value={editForm.city}
                  onChange={(event) => setEditForm({ ...editForm, city: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">العنوان</label>
                <input
                  className="input w-full"
                  value={editForm.address}
                  onChange={(event) => setEditForm({ ...editForm, address: event.target.value })}
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">رقم الهوية</label>
                <input
                  className="input w-full"
                  value={editForm.id_number}
                  onChange={(event) => setEditForm({ ...editForm, id_number: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">التصنيف</label>
                <select
                  className="input w-full"
                  value={editForm.segment}
                  onChange={(event) => setEditForm({ ...editForm, segment: event.target.value })}
                >
                  {Object.entries(CUSTOMER_SEGMENT).map(([key, value]) => (
                    <option key={key} value={key}>
                      {value.icon} {value.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">تاريخ الميلاد</label>
                <input
                  type="date"
                  className="input w-full"
                  value={editForm.birthday}
                  onChange={(event) => setEditForm({ ...editForm, birthday: event.target.value })}
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-1 block text-right text-xs text-muted">ملاحظات</label>
                <textarea
                  className="input w-full"
                  rows={2}
                  value={editForm.notes}
                  onChange={(event) => setEditForm({ ...editForm, notes: event.target.value })}
                />
              </div>
              <button onClick={saveEdit} disabled={saving} className="btn-brand w-full">
                {saving ? "⏳ جاري الحفظ..." : "💾 حفظ التعديلات"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
