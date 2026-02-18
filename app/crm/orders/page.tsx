"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useScreen, useToast, useDebounce } from "@/lib/hooks";
import { ORDER_STATUS, ORDER_SOURCE, BANKS } from "@/lib/constants";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";
import { Modal, FormField } from "@/components/admin/shared";

// Bank ID → Arabic name map
const BANK_NAMES: Record<string, string> = Object.fromEntries(
  BANKS.map((b) => [b.id, b.name_ar])
);

export default function OrdersPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<any>(null);
  const [noteText, setNoteText] = useState("");

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/crm/orders?${params}`);
    const json = await res.json();
    setOrders(json.data || []);
    setLoading(false);
  }, [statusFilter, sourceFilter, debouncedSearch]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  const changeStatus = async (orderId: string, status: string) => {
    await fetch("/api/crm/orders", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "status", orderId, status, userName: "مدير" }),
    });
    show(`✅ ${orderId} → ${ORDER_STATUS[status as keyof typeof ORDER_STATUS]?.label || status}`);
    fetchOrders();
    if (selected?.id === orderId) setSelected({ ...selected, status });
  };

  const addNote = async () => {
    if (!noteText.trim() || !selected) return;
    await fetch("/api/crm/orders", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "note", orderId: selected.id, userId: "system", userName: "مدير", text: noteText }),
    });
    show("📝 تمت إضافة الملاحظة");
    setNoteText("");
    fetchOrders();
  };

  const statusTabs = [
    { k: "all", l: "الكل", c: orders.length },
    ...Object.entries(ORDER_STATUS).map(([k, v]) => ({
      k, l: `${v.icon} ${v.label}`, c: orders.filter((o) => o.status === k).length,
    })),
  ];

  const sourceTabs = [
    { k: "all", l: "كل المصادر" },
    ...Object.entries(ORDER_SOURCE).map(([k, v]) => ({ k, l: `${v.icon} ${v.label}` })),
  ];

  const statusActions = (current: string) => {
    const map: Record<string, string[]> = {
      new: ["approved", "rejected", "no_reply_1"],
      approved: ["shipped", "rejected"],
      shipped: ["delivered"],
      no_reply_1: ["approved", "no_reply_2", "rejected"],
      no_reply_2: ["approved", "no_reply_3", "rejected"],
      no_reply_3: ["approved", "rejected"],
    };
    return map[current] || [];
  };

  return (
    <div>
      <h1 className="font-black mb-3" style={{ fontSize: scr.mobile ? 16 : 22 }}>📦 الطلبات</h1>

      {/* Search */}
      <div className="flex items-center gap-1.5 bg-surface-elevated rounded-xl border border-surface-border mb-3"
        style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}>
        <span className="text-sm opacity-30">⌕</span>
        <input className="flex-1 bg-transparent border-none text-white outline-none"
          style={{ fontSize: scr.mobile ? 12 : 14 }} placeholder="ابحث برقم طلب، اسم، أو هاتف..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
        {search && <button onClick={() => setSearch("")} className="text-muted text-xs cursor-pointer bg-transparent border-0">✕</button>}
      </div>

      {/* Status tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto" style={{ flexWrap: scr.desktop ? "wrap" : "nowrap" }}>
        {statusTabs.map((t) => (
          <button key={t.k} onClick={() => setStatusFilter(t.k)}
            className={`chip whitespace-nowrap ${statusFilter === t.k ? "chip-active" : ""}`}>
            {t.l} {t.c > 0 && <span className="text-[8px] opacity-60 mr-0.5">({t.c})</span>}
          </button>
        ))}
      </div>

      {/* Source tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {sourceTabs.map((t) => (
          <button key={t.k} onClick={() => setSourceFilter(t.k)}
            className={`chip whitespace-nowrap text-[10px] ${sourceFilter === t.k ? "chip-active" : ""}`}>{t.l}</button>
        ))}
      </div>

      {/* Orders list */}
      {loading ? <div className="text-center py-12 text-muted">⏳</div> :
        orders.length === 0 ? <div className="text-center py-12 text-dim"><div className="text-3xl mb-2">📦</div><div className="text-sm">لا توجد طلبات</div></div> : (
          <div className="space-y-1.5">
            {orders.map((o) => {
              const st = ORDER_STATUS[o.status as keyof typeof ORDER_STATUS];
              const src = ORDER_SOURCE[o.source as keyof typeof ORDER_SOURCE];
              return (
                <div key={o.id} className="card cursor-pointer hover:border-brand/30 transition-all"
                  style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
                  onClick={() => setSelected(o)}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                        {formatCurrency(Number(o.total))}
                      </span>
                      {/* Quick status buttons */}
                      <div className="flex gap-0.5">
                        {statusActions(o.status).slice(0, 2).map((s) => {
                          const info = ORDER_STATUS[s as keyof typeof ORDER_STATUS];
                          return (
                            <button key={s} onClick={(e) => { e.stopPropagation(); changeStatus(o.id, s); }}
                              className="text-[8px] px-1.5 py-0.5 rounded-md border cursor-pointer"
                              style={{ borderColor: `${info?.color}40`, color: info?.color, background: `${info?.color}10` }}
                              title={info?.label}>
                              {info?.icon}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                    <div className="text-right flex-1 mr-2">
                      <div className="flex items-center gap-1.5 justify-end">
                        <span className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{o.id}</span>
                        {st && <span className="badge" style={{ background: `${st.color}15`, color: st.color }}>{st.icon} {st.label}</span>}
                        {src && <span className="text-[9px]" style={{ color: src.color }}>{src.icon}</span>}
                      </div>
                      <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                        {o.customers?.name || "—"} • {o.customers?.phone || "—"} • {timeAgo(o.created_at)}
                        {o.order_notes?.length > 0 && <span className="mr-1">📝{o.order_notes.length}</span>}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Order Detail Modal */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title={`📦 ${selected?.id || ""}`} wide>
        {selected && (() => {
          const st = ORDER_STATUS[selected.status as keyof typeof ORDER_STATUS];
          const src = ORDER_SOURCE[selected.source as keyof typeof ORDER_SOURCE];
          return (
            <div>
              {/* Status + Actions */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex gap-1 flex-wrap">
                  {statusActions(selected.status).map((s) => {
                    const info = ORDER_STATUS[s as keyof typeof ORDER_STATUS];
                    return (
                      <button key={s} onClick={() => changeStatus(selected.id, s)}
                        className="text-[10px] px-2.5 py-1.5 rounded-lg border cursor-pointer font-bold"
                        style={{ borderColor: `${info?.color}40`, color: info?.color, background: `${info?.color}10` }}>
                        {info?.icon} {info?.label}
                      </button>
                    );
                  })}
                </div>
                {st && <span className="badge text-[10px] px-3 py-1" style={{ background: `${st.color}15`, color: st.color }}>{st.icon} {st.label}</span>}
              </div>

              {/* Info grid */}
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
                <div className="bg-surface-elevated rounded-xl p-3">
                  <div className="text-muted text-[10px] mb-1">👤 الزبون</div>
                  <div className="font-bold text-sm">{selected.customers?.name || "—"}</div>
                  <div className="text-muted text-xs">{selected.customers?.phone || "—"}</div>
                  {selected.customers?.id_number && (
                    <div className="flex justify-between mt-1.5 pt-1.5 border-t border-surface-border">
                      <span className="text-brand font-bold text-xs" dir="ltr">{selected.customers.id_number}</span>
                      <span className="text-dim text-[10px]">🪪 ת.ז</span>
                    </div>
                  )}
                  {selected.customers?.segment && (
                    <span className="badge mt-1" style={{ background: "rgba(196,16,64,0.1)", color: "#c41040" }}>
                      {selected.customers.segment}
                    </span>
                  )}
                </div>
                <div className="bg-surface-elevated rounded-xl p-3">
                  <div className="text-muted text-[10px] mb-1">📍 التوصيل</div>
                  <div className="font-bold text-sm">{selected.shipping_city}</div>
                  <div className="text-muted text-xs">{selected.shipping_address}</div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3">
                  <div className="text-muted text-[10px] mb-1">💳 الدفع</div>
                  <div className="font-bold text-sm">{selected.payment_method}</div>
                  <div className="text-muted text-xs">{formatDateTime(selected.created_at)}</div>
                  {selected.payment_details && (() => {
                    const pd = selected.payment_details;
                    const isBankPay = pd.type === "bank" || pd.method === "bank";
                    const isCreditPay = pd.type === "credit" || pd.type === "credit_direct" || pd.method === "credit";
                    return (
                      <div className="mt-2 pt-2 border-t border-surface-border">
                        {isBankPay && (
                          <>
                            <div className="text-muted text-[9px] mb-1">🏦 تفاصيل البنك</div>
                            <div className="text-xs space-y-0.5">
                              {pd.bank && (
                                <div className="flex justify-between">
                                  <span className="text-brand font-bold">{BANK_NAMES[pd.bank] || pd.bank}</span>
                                  <span className="text-dim">البنك</span>
                                </div>
                              )}
                              {pd.branch && (
                                <div className="flex justify-between">
                                  <span className="text-brand font-bold" dir="ltr">{pd.branch}</span>
                                  <span className="text-dim">الفرع</span>
                                </div>
                              )}
                              {pd.account && (
                                <div className="flex justify-between">
                                  <span className="text-brand font-bold" dir="ltr">{pd.account}</span>
                                  <span className="text-dim">الحساب</span>
                                </div>
                              )}
                              {pd.installments && pd.installments > 1 && (
                                <div className="flex justify-between mt-1 pt-1 border-t border-surface-border">
                                  <span className="text-state-success font-bold">
                                    {pd.installments} دفعة × ₪{pd.monthly_amount || Math.ceil(Number(selected.total) / pd.installments)}
                                  </span>
                                  <span className="text-dim">📅 تقسيط</span>
                                </div>
                              )}
                            </div>
                          </>
                        )}
                        {isCreditPay && (
                          <>
                            <div className="text-muted text-[9px] mb-1">💳 تفاصيل البطاقة</div>
                            <div className="text-xs space-y-0.5">
                              {pd.card && (
                                <div className="flex justify-between">
                                  <span className="text-brand font-bold" dir="ltr">****{pd.card}</span>
                                  <span className="text-dim">بطاقة</span>
                                </div>
                              )}
                              {pd.installments && pd.installments > 1 && (
                                <div className="flex justify-between">
                                  <span className="text-brand font-bold">{pd.installments} دفعات</span>
                                  <span className="text-dim">تقسيط</span>
                                </div>
                              )}
                              {pd.type === "credit_direct" && (
                                <div className="text-state-success text-[10px] mt-1">⚡ دفع مباشر</div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })()}
                </div>
                <div className="bg-surface-elevated rounded-xl p-3">
                  <div className="text-muted text-[10px] mb-1">💰 المبلغ</div>
                  <div className="font-black text-brand text-lg">{formatCurrency(Number(selected.total))}</div>
                  {selected.discount_amount > 0 && <div className="text-state-success text-xs">خصم: -{formatCurrency(selected.discount_amount)}</div>}
                  {src && <div className="text-muted text-xs mt-0.5">{src.icon} {src.label}</div>}
                </div>
              </div>

              {/* Items */}
              {selected.order_items?.length > 0 && (
                <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
                  <div className="font-bold text-right mb-1.5 text-xs">📋 المنتجات</div>
                  {selected.order_items.map((it: any, i: number) => (
                    <div key={i} className="flex justify-between py-1.5 border-b border-surface-border last:border-0">
                      <span className="text-brand text-sm">{formatCurrency(it.price)}</span>
                      <div className="text-right">
                        <span className="text-sm">{it.product_name}</span>
                        <div className="text-muted text-[10px]">
                          {it.product_brand} {it.color && `• ${it.color}`} {it.storage && `• ${it.storage}`} × {it.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Notes */}
              <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="font-bold text-right mb-2 text-xs">📝 ملاحظات حرة</div>
                {selected.customer_notes && (
                  <div className="bg-state-info/10 rounded-lg p-2 mb-2 text-right text-xs text-state-info">
                    💬 ملاحظة الزبون: {selected.customer_notes}
                  </div>
                )}
                {(selected.order_notes || []).map((n: any) => (
                  <div key={n.id} className="bg-surface-elevated rounded-lg p-2 mb-1 text-right">
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[9px] text-dim">{timeAgo(n.created_at)}</span>
                      <span className="text-[10px] text-muted font-bold">{n.user_name}</span>
                    </div>
                    <div className="text-xs">{n.text}</div>
                  </div>
                ))}
                <div className="flex gap-1.5 mt-2">
                  <button onClick={addNote} className="px-3 py-2 rounded-lg bg-brand text-white text-xs font-bold cursor-pointer border-0 flex-shrink-0">إضافة</button>
                  <input className="input text-xs" value={noteText} onChange={(e) => setNoteText(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addNote()} placeholder="أضف ملاحظة..." />
                </div>
              </div>
            </div>
          );
        })()}
      </Modal>

      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
