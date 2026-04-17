"use client";

export const dynamic = "force-dynamic";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Modal, ToastContainer } from "@/components/admin/shared";
import { ManualOrderModal } from "@/components/orders/ManualOrderModal";
import { ORDER_SOURCE, ORDER_STATUS } from "@/lib/constants";
import { csrfHeaders } from "@/lib/csrf-client";
import { useDebounce, useScreen, useToast } from "@/lib/hooks";
import { formatCurrency, formatDateTime, timeAgo } from "@/lib/utils";

type OrderHistoryEntry = {
  id: string;
  old_status?: string;
  new_status: string;
  changed_by_name?: string;
  notes?: string;
  created_at: string;
};

export function OrdersManagementPage({
  title = "הזמנות",
  titleIcon = "📦",
}: {
  title?: string;
  titleIcon?: string;
}) {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const searchParams = useSearchParams();

  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") || "all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [search, setSearch] = useState(searchParams.get("search") || "");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<any>(null);
  const [noteText, setNoteText] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState("");
  const [manualOpen, setManualOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [statusHistory, setStatusHistory] = useState<OrderHistoryEntry[]>([]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);
      if (sourceFilter !== "all") params.set("source", sourceFilter);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      if (amountMin) params.set("amountMin", amountMin);
      if (amountMax) params.set("amountMax", amountMax);
      const res = await fetch(`/api/crm/orders?${params}`);
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה בטעינת ההזמנות");
      }
      const rows = json.data?.data || json.data || [];
      setOrders(Array.isArray(rows) ? rows : []);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה לא צפויה"}`, "error");
    } finally {
      setLoading(false);
    }
  }, [amountMax, amountMin, dateFrom, dateTo, debouncedSearch, show, sourceFilter, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (!selected?.id) {
      setStatusHistory([]);
      return;
    }

    let active = true;
    setHistoryLoading(true);
    fetch(`/api/admin/orders/${selected.id}/history`)
      .then((res) => res.json())
      .then((json) => {
        if (!active) return;
        setStatusHistory(json.data || []);
      })
      .catch(() => {
        if (active) setStatusHistory([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, [selected?.id]);

  const refreshAndReselect = async (orderId?: string) => {
    await fetchOrders();
    if (!orderId) return;
    const res = await fetch(`/api/crm/orders?search=${orderId}`);
    const json = await res.json().catch(() => null);
    const rows = json?.data?.data || json?.data || [];
    const found = Array.isArray(rows) ? rows.find((row: any) => row.id === orderId) : null;
    if (found) setSelected(found);
  };

  const changeStatus = async (orderId: string, status: string) => {
    try {
      const res = await fetch("/api/crm/orders", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "status", orderId, status }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה בעדכון הסטטוס");
      }
      show(`✅ ${orderId} → ${ORDER_STATUS[status as keyof typeof ORDER_STATUS]?.labelHe || status}`);
      await refreshAndReselect(orderId);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה לא צפויה"}`, "error");
    }
  };

  const addNote = async () => {
    if (!selected?.id || !noteText.trim()) return;
    try {
      const res = await fetch("/api/crm/orders", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "note", orderId: selected.id, text: noteText.trim() }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה בהוספת הערה");
      }
      setNoteText("");
      show("✅ ההערה נשמרה");
      await refreshAndReselect(selected.id);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה לא צפויה"}`, "error");
    }
  };

  const deleteOrder = async (orderId: string) => {
    const confirmed = window.confirm(`למחוק את ההזמנה ${orderId}?`);
    if (!confirmed) return;
    try {
      const res = await fetch("/api/crm/orders", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "delete", orderId }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה במחיקת ההזמנה");
      }
      setSelected(null);
      show(`✅ ההזמנה ${orderId} נמחקה`);
      await fetchOrders();
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה לא צפויה"}`, "error");
    }
  };

  const applyBulkStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    try {
      const res = await fetch("/api/crm/orders", {
        method: "PUT",
        headers: csrfHeaders(),
        body: JSON.stringify({ action: "bulk_status", ids: [...selectedIds], status: bulkStatus }),
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        throw new Error(json.error || "שגיאה בעדכון מרובה");
      }
      setSelectedIds(new Set());
      setBulkStatus("");
      show(`✅ עודכנו ${json.data?.updated || selectedIds.size} הזמנות`);
      await fetchOrders();
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "שגיאה לא צפויה"}`, "error");
    }
  };

  const exportCSV = () => {
    const headers = ["ID", "Date", "Status", "Source", "Total", "Customer", "Phone"];
    const rows = orders.map((order) => [
      order.id,
      order.created_at,
      order.status,
      order.source,
      order.total,
      order.customers?.name || "",
      order.customers?.phone || "",
    ]);
    const csv = [
      headers.join(","),
      ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
    ].join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === orders.length) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(orders.map((order) => order.id)));
  };

  const statusTabs = [
    { key: "all", label: "הכל", count: orders.length },
    ...Object.entries(ORDER_STATUS).map(([key, info]) => ({
      key,
      label: `${info.icon} ${info.labelHe}`,
      count: orders.filter((order) => order.status === key).length,
    })),
  ];

  const sourceTabs = [
    { key: "all", label: "כל המקורות" },
    ...Object.entries(ORDER_SOURCE).map(([key, info]) => ({
      key,
      label: `${info.icon} ${info.labelHe}`,
    })),
  ];

  const statusActions = (current: string) => {
    const map: Record<string, string[]> = {
      new: ["approved", "processing", "rejected", "no_reply_1"],
      approved: ["processing", "shipped", "cancelled"],
      processing: ["shipped", "cancelled"],
      shipped: ["delivered", "returned"],
      no_reply_1: ["approved", "no_reply_2", "rejected"],
      no_reply_2: ["approved", "no_reply_3", "rejected"],
      no_reply_3: ["approved", "rejected"],
    };
    return map[current] || [];
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="flex gap-2">
          <button onClick={() => setManualOpen(true)} className="btn-primary">
            הזמנה ידנית +
          </button>
          <button onClick={exportCSV} className="chip">📥 CSV</button>
        </div>
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>
          {titleIcon} {title}
        </h1>
      </div>

      <div className="mb-3 flex items-center gap-2 rounded-xl border border-surface-border bg-surface-elevated px-3 py-2">
        <span className="text-sm opacity-40">⌕</span>
        <input
          className="flex-1 bg-transparent outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="חיפוש לפי הזמנה, שם או טלפון"
        />
      </div>

      <div className="mb-2 flex gap-1 overflow-x-auto">
        {statusTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setStatusFilter(tab.key)}
            className={`chip whitespace-nowrap ${statusFilter === tab.key ? "chip-active" : ""}`}
          >
            {tab.label} {tab.count > 0 ? `(${tab.count})` : ""}
          </button>
        ))}
      </div>

      <div className="mb-2 flex gap-1 overflow-x-auto">
        {sourceTabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setSourceFilter(tab.key)}
            className={`chip whitespace-nowrap ${sourceFilter === tab.key ? "chip-active" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input max-w-[160px]" />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input max-w-[160px]" />
        <input type="number" placeholder="₪ Min" value={amountMin} onChange={(e) => setAmountMin(e.target.value)} className="input max-w-[120px]" dir="ltr" />
        <input type="number" placeholder="₪ Max" value={amountMax} onChange={(e) => setAmountMax(e.target.value)} className="input max-w-[120px]" dir="ltr" />
      </div>

      {selectedIds.size > 0 && (
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 p-3">
          <span className="text-xs font-bold">{selectedIds.size} נבחרו</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)} className="input max-w-[200px]">
            <option value="">שינוי סטטוס...</option>
            {Object.entries(ORDER_STATUS).map(([key, info]) => (
              <option key={key} value={key}>{info.labelHe}</option>
            ))}
          </select>
          <button onClick={applyBulkStatus} disabled={!bulkStatus} className="btn-primary disabled:opacity-50">החל</button>
          <button onClick={() => setSelectedIds(new Set())} className="btn-outline">ניקוי</button>
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-muted">⏳</div>
      ) : orders.length === 0 ? (
        <div className="py-16 text-center text-muted">אין הזמנות להצגה</div>
      ) : (
        <div className="space-y-2">
          <div className="flex items-center gap-2 px-2 py-1">
            <input
              type="checkbox"
              checked={orders.length > 0 && selectedIds.size === orders.length}
              onChange={toggleSelectAll}
            />
            <span className="text-xs text-muted">בחר הכל</span>
          </div>

          {orders.map((order) => {
            const statusInfo = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS];
            const sourceInfo = ORDER_SOURCE[order.source as keyof typeof ORDER_SOURCE];
            return (
              <div
                key={order.id}
                className="card cursor-pointer hover:border-brand/30"
                style={{ padding: scr.mobile ? "12px 14px" : "16px 18px" }}
                onClick={() => setSelected(order)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(order.id)}
                    onChange={() => toggleSelect(order.id)}
                    onClick={(e) => e.stopPropagation()}
                  />
                  <div className="flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-left">
                        <div className="font-black text-brand">{formatCurrency(Number(order.total || 0))}</div>
                        <div className="text-xs text-muted">{timeAgo(order.created_at)}</div>
                      </div>
                      <div className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <span className="font-bold">{order.id}</span>
                          {statusInfo && (
                            <span className="badge" style={{ background: `${statusInfo.color}15`, color: statusInfo.color }}>
                              {statusInfo.icon} {statusInfo.labelHe}
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-muted">
                          {order.customers?.name || "—"} • {order.customers?.phone || "—"} • {sourceInfo?.labelHe || order.source}
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap justify-end gap-1">
                      {statusActions(order.status).map((status) => {
                        const info = ORDER_STATUS[status as keyof typeof ORDER_STATUS];
                        return (
                          <button
                            key={status}
                            onClick={(e) => {
                              e.stopPropagation();
                              changeStatus(order.id, status);
                            }}
                            className="rounded-lg border px-2 py-1 text-[10px]"
                            style={{ borderColor: `${info.color}40`, color: info.color, background: `${info.color}10` }}
                          >
                            {info.labelHe}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `📦 ${selected.id}` : "הזמנה"}
        wide
      >
        {selected && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-1">
                {statusActions(selected.status).map((status) => {
                  const info = ORDER_STATUS[status as keyof typeof ORDER_STATUS];
                  return (
                    <button
                      key={status}
                      onClick={() => changeStatus(selected.id, status)}
                      className="rounded-lg border px-3 py-1.5 text-xs font-bold"
                      style={{ borderColor: `${info.color}40`, color: info.color, background: `${info.color}10` }}
                    >
                      {info.labelHe}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => deleteOrder(selected.id)}
                className="rounded-lg border border-state-error/30 bg-state-error/10 px-3 py-1.5 text-xs font-bold text-state-error"
              >
                מחיקה
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-xl bg-surface-elevated p-3">
                <div className="mb-1 text-xs text-muted">לקוח</div>
                <div className="font-bold">{selected.customers?.name || "—"}</div>
                <div className="text-xs text-muted">{selected.customers?.phone || "—"}</div>
                {selected.customers?.id_number && (
                  <div className="mt-2 text-xs text-brand" dir="ltr">{selected.customers.id_number}</div>
                )}
              </div>
              <div className="rounded-xl bg-surface-elevated p-3">
                <div className="mb-1 text-xs text-muted">פרטי הזמנה</div>
                <div className="font-bold">{formatCurrency(Number(selected.total || 0))}</div>
                <div className="text-xs text-muted">{formatDateTime(selected.created_at)}</div>
                <div className="text-xs text-muted">{ORDER_SOURCE[selected.source as keyof typeof ORDER_SOURCE]?.labelHe || selected.source}</div>
              </div>
            </div>

            {selected.order_items?.length > 0 && (
              <div className="card p-3">
                <div className="mb-2 font-bold text-sm">פריטים</div>
                <div className="space-y-2">
                  {selected.order_items.map((item: any, index: number) => (
                    <div key={`${item.product_id || item.product_name}-${index}`} className="flex items-center justify-between border-b border-surface-border pb-2 last:border-0 last:pb-0">
                      <span className="text-sm font-bold">{formatCurrency(Number(item.price || 0) * Number(item.quantity || 0))}</span>
                      <div className="text-right">
                        <div className="text-sm">{item.product_name}</div>
                        <div className="text-xs text-muted">{item.product_brand} • ×{item.quantity}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="card p-3">
              <div className="mb-2 font-bold text-sm">הערות</div>
              {(selected.order_notes || []).map((note: any) => (
                <div key={note.id} className="mb-2 rounded-lg bg-surface-elevated p-2 text-right">
                  <div className="flex items-center justify-between text-[10px] text-muted">
                    <span>{timeAgo(note.created_at)}</span>
                    <span>{note.user_name}</span>
                  </div>
                  <div className="text-sm">{note.text}</div>
                </div>
              ))}
              <div className="mt-2 flex gap-2">
                <button onClick={addNote} className="btn-primary">הוסף</button>
                <input
                  className="input"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") addNote();
                  }}
                  placeholder="הערה חדשה..."
                />
              </div>
            </div>

            <div className="card p-3">
              <div className="mb-2 font-bold text-sm">היסטוריית סטטוס</div>
              {historyLoading ? (
                <div className="text-xs text-muted">טוען...</div>
              ) : statusHistory.length === 0 ? (
                <div className="text-xs text-muted">אין שינויים מתועדים עדיין</div>
              ) : (
                <div className="space-y-2">
                  {statusHistory.map((entry) => {
                    const oldStatus = entry.old_status ? ORDER_STATUS[entry.old_status as keyof typeof ORDER_STATUS] : null;
                    const newStatus = ORDER_STATUS[entry.new_status as keyof typeof ORDER_STATUS];
                    return (
                      <div key={entry.id} className="rounded-xl border border-surface-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="flex flex-wrap items-center gap-2">
                            {oldStatus ? (
                              <span className="badge" style={{ background: `${oldStatus.color}15`, color: oldStatus.color }}>
                                {oldStatus.labelHe}
                              </span>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                            <span className="text-muted">→</span>
                            <span className="badge" style={{ background: `${newStatus.color}15`, color: newStatus.color }}>
                              {newStatus.labelHe}
                            </span>
                          </div>
                          <div className="text-muted">{formatDateTime(entry.created_at)}</div>
                        </div>
                        <div className="mt-1 text-xs text-muted">👤 {entry.changed_by_name || "מערכת"}</div>
                        {entry.notes && <div className="mt-1 text-sm">{entry.notes}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ManualOrderModal
        open={manualOpen}
        onClose={() => setManualOpen(false)}
        onCreated={(order) => {
          setSelected(order);
          void fetchOrders();
        }}
        show={show}
      />

      <ToastContainer toasts={toasts} />
    </div>
  );
}
