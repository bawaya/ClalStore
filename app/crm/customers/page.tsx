"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useScreen, useDebounce } from "@/lib/hooks";
import { CUSTOMER_SEGMENT } from "@/lib/constants";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import { Modal } from "@/components/admin/shared";

type HotAccount = {
  id: string;
  customer_id: string;
  hot_mobile_id: string;
  hot_customer_code?: string | null;
  line_phone?: string | null;
  label?: string | null;
  status: "pending" | "active" | "inactive" | "cancelled" | "transferred";
  is_primary: boolean;
  ended_at?: string | null;
};

export default function CustomersPage() {
  const scr = useScreen();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<any>(null);
  const [custOrders, setCustOrders] = useState<any[]>([]);
  const [hotAccounts, setHotAccounts] = useState<HotAccount[]>([]);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);
  const [addingHot, setAddingHot] = useState(false);
  const [newHot, setNewHot] = useState({ hot_mobile_id: "", label: "", is_primary: false });
  const [error, setError] = useState("");

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (segment !== "all") params.set("segment", segment);
      if (debouncedSearch) params.set("search", debouncedSearch);
      const res = await fetch(`/api/crm/customers?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطأ في جلب الزبائن");
      }
      const json = await res.json();
      const cd = json.data ?? json;
      setCustomers(cd.customers ?? (Array.isArray(cd) ? cd : []));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [segment, debouncedSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const loadHotAccounts = async (customerId: string) => {
    try {
      const res = await fetch(`/api/crm/customers/${customerId}`);
      if (!res.ok) return;
      const json = await res.json();
      const cd = json.data ?? json;
      setHotAccounts(cd.hotAccounts || []);
      // Keep selected synced with latest customer row (includes customer_code)
      if (cd.customer) setSelected((prev: any) => ({ ...prev, ...cd.customer }));
    } catch {
      // non-fatal
    }
  };

  const openCustomer = async (c: any) => {
    setSelected(c);
    setEditMode(false);
    setAddingHot(false);
    setNewHot({ hot_mobile_id: "", label: "", is_primary: false });
    setEditForm({
      name: c.name || "",
      email: c.email || "",
      city: c.city || "",
      address: c.address || "",
      id_number: c.id_number || "",
      notes: c.notes || "",
      segment: c.segment || "new",
    });
    try {
      const res = await fetch(`/api/crm/customers?customerId=${c.id}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطأ في جلب طلبات الزبون");
      }
      const json = await res.json();
      const cd = json.data ?? json;
      setCustOrders(cd.orders || []);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    }
    // Load HOT accounts + customer_code
    await loadHotAccounts(c.id);
  };

  const saveCustomer = async () => {
    if (!selected) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/customers/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "خطأ في الحفظ");
      const updated = (j.data ?? j).customer;
      setSelected({ ...selected, ...updated });
      await fetchCustomers();
      setEditMode(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const addHotAccount = async () => {
    if (!selected || !newHot.hot_mobile_id.trim()) return;
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/crm/customers/${selected.id}/hot-accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newHot),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "خطأ في الإضافة");
      await loadHotAccounts(selected.id);
      setAddingHot(false);
      setNewHot({ hot_mobile_id: "", label: "", is_primary: false });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setSaving(false);
    }
  };

  const setPrimaryHot = async (accountId: string) => {
    if (!selected) return;
    try {
      await fetch(`/api/crm/customers/${selected.id}/hot-accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_primary: true }),
      });
      await loadHotAccounts(selected.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    }
  };

  const cancelHot = async (accountId: string) => {
    if (!selected) return;
    if (!window.confirm("هل تريد إغلاق هذا الحساب؟ (سيبقى السجل في القاعدة)")) return;
    try {
      await fetch(`/api/crm/customers/${selected.id}/hot-accounts/${accountId}`, {
        method: "DELETE",
      });
      await loadHotAccounts(selected.id);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    }
  };

  const segTabs = [
    { k: "all", l: "الكل", c: customers.length },
    ...Object.entries(CUSTOMER_SEGMENT).map(([k, v]) => ({
      k, l: `${v.icon} ${v.label}`, c: customers.filter((c) => c.segment === k).length,
    })),
  ];

  return (
    <div>
      <h1 className="font-black mb-3" style={{ fontSize: scr.mobile ? 16 : 22 }}>👥 الزبائن</h1>

      {/* Search */}
      <div className="flex items-center gap-1.5 bg-surface-elevated rounded-xl border border-surface-border mb-3"
        style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}>
        <span className="text-sm opacity-30">⌕</span>
        <input className="flex-1 bg-transparent border-none text-white outline-none"
          style={{ fontSize: scr.mobile ? 12 : 14 }} placeholder="ابحث بالاسم، هاتف، أو إيميل..."
          value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Segment tabs */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {segTabs.map((t) => (
          <button key={t.k} onClick={() => setSegment(t.k)}
            className={`chip whitespace-nowrap ${segment === t.k ? "chip-active" : ""}`}>
            {t.l} {t.c > 0 && <span className="text-[8px] opacity-60 mr-0.5">({t.c})</span>}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && <div className="text-center py-4 text-red-400 text-sm mb-2">⚠️ {error}</div>}

      {/* List */}
      {loading ? <div className="text-center py-12 text-muted">⏳</div> :
        customers.length === 0 ? <div className="text-center py-12 text-dim"><div className="text-3xl mb-2">👥</div><div className="text-sm">لا يوجد زبائن</div></div> : (
          <div className="space-y-1.5">
            {customers.map((c) => {
              const seg = CUSTOMER_SEGMENT[c.segment as keyof typeof CUSTOMER_SEGMENT];
              return (
                <div key={c.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
                  style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
                  onClick={() => openCustomer(c)}>
                  <div className="text-left flex-shrink-0">
                    <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>{formatCurrency(c.total_spent)}</div>
                    <div className="text-muted" style={{ fontSize: scr.mobile ? 8 : 10 }}>{c.total_orders} طلب</div>
                  </div>
                  <div className="flex-1 text-right mr-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{c.name}</span>
                      {seg && <span className="badge" style={{ background: `${seg.color}15`, color: seg.color }}>{seg.icon} {seg.label}</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                      {c.phone} {c.city && `• ${c.city}`}
                      {c.last_order_at && ` • آخر طلب: ${timeAgo(c.last_order_at)}`}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Customer Detail Modal */}
      <Modal
        open={!!selected}
        onClose={() => {
          setSelected(null);
          setCustOrders([]);
          setHotAccounts([]);
          setEditMode(false);
          setAddingHot(false);
        }}
        title={`👤 ${selected?.name || ""}`}
        wide
      >
        {selected && (() => {
          const seg = CUSTOMER_SEGMENT[selected.segment as keyof typeof CUSTOMER_SEGMENT];
          return (
            <div>
              <div className="grid gap-2 mb-3" style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr" }}>
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="text-muted text-[10px]">الإنفاق</div>
                  <div className="font-black text-brand">{formatCurrency(selected.total_spent)}</div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="text-muted text-[10px]">الطلبات</div>
                  <div className="font-black">{selected.total_orders}</div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="text-muted text-[10px]">المتوسط</div>
                  <div className="font-black">{formatCurrency(selected.avg_order_value)}</div>
                </div>
                <div className="bg-surface-elevated rounded-xl p-3 text-center">
                  <div className="text-muted text-[10px]">التصنيف</div>
                  <div className="font-black" style={{ color: seg?.color }}>{seg?.icon} {seg?.label}</div>
                </div>
              </div>

              {/* Customer code */}
              <div className="card mb-3 p-3 text-center">
                <div className="text-muted text-[10px] mb-1">🎖️ كود الزبون</div>
                <div className="text-brand font-black tracking-widest" style={{ fontSize: scr.mobile ? 16 : 20, letterSpacing: "0.18em" }}>
                  {selected.customer_code || "—"}
                </div>
              </div>

              {/* HOT accounts */}
              <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="flex justify-between items-center mb-2">
                  <button
                    onClick={() => setAddingHot(true)}
                    className="text-brand border border-brand/40 rounded-lg"
                    style={{ fontSize: scr.mobile ? 10 : 12, padding: "4px 8px" }}
                  >
                    + إضافة
                  </button>
                  <div className="font-bold text-xs">📱 أكواد HOT ({hotAccounts.length})</div>
                </div>

                {addingHot && (
                  <div className="mb-3 p-2 bg-surface-elevated rounded-lg">
                    <input
                      className="input w-full mb-2"
                      dir="ltr"
                      placeholder="رقم HOT Mobile"
                      value={newHot.hot_mobile_id}
                      onChange={(e) => setNewHot({ ...newHot, hot_mobile_id: e.target.value })}
                    />
                    <input
                      className="input w-full mb-2"
                      placeholder="وصف (اختياري)"
                      value={newHot.label}
                      onChange={(e) => setNewHot({ ...newHot, label: e.target.value })}
                    />
                    <label className="flex items-center gap-2 text-xs mb-2 justify-end">
                      <span>الحساب الرئيسي</span>
                      <input
                        type="checkbox"
                        checked={newHot.is_primary}
                        onChange={(e) => setNewHot({ ...newHot, is_primary: e.target.checked })}
                      />
                    </label>
                    <div className="flex gap-2">
                      <button
                        onClick={addHotAccount}
                        disabled={saving || !newHot.hot_mobile_id.trim()}
                        className="btn-primary flex-1 text-xs"
                      >
                        {saving ? "..." : "حفظ"}
                      </button>
                      <button
                        onClick={() => {
                          setAddingHot(false);
                          setNewHot({ hot_mobile_id: "", label: "", is_primary: false });
                        }}
                        className="text-xs border border-surface-border rounded-lg px-3"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                )}

                {hotAccounts.length === 0 ? (
                  <div className="text-center text-dim text-xs py-3">لا توجد حسابات</div>
                ) : (
                  hotAccounts.map((acc) => (
                    <div key={acc.id} className="flex justify-between items-center py-1.5 border-b border-surface-border last:border-0">
                      <div className="flex gap-1">
                        {!acc.is_primary && acc.status === "active" && (
                          <button
                            onClick={() => setPrimaryHot(acc.id)}
                            className="text-[10px] text-muted"
                            title="جعله الرئيسي"
                          >
                            ☆
                          </button>
                        )}
                        {acc.status === "active" && (
                          <button
                            onClick={() => cancelHot(acc.id)}
                            className="text-[10px] text-red-400"
                            title="إغلاق"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-bold" dir="ltr">
                          {acc.is_primary && <span className="text-brand">★ </span>}
                          {acc.hot_mobile_id}
                        </div>
                        <div className="text-[10px] text-muted">
                          {acc.label || "—"} • {acc.status}
                          {acc.ended_at ? ` • ended ${acc.ended_at.slice(0, 10)}` : ""}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Info (view or edit) */}
              <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="flex justify-between items-center mb-1.5">
                  {editMode ? (
                    <div className="flex gap-2">
                      <button onClick={saveCustomer} disabled={saving} className="btn-primary text-xs px-4">
                        {saving ? "..." : "💾 حفظ"}
                      </button>
                      <button
                        onClick={() => {
                          setEditMode(false);
                          setEditForm({
                            name: selected.name || "",
                            email: selected.email || "",
                            city: selected.city || "",
                            address: selected.address || "",
                            id_number: selected.id_number || "",
                            notes: selected.notes || "",
                            segment: selected.segment || "new",
                          });
                        }}
                        className="text-xs border border-surface-border rounded-lg px-3"
                      >
                        إلغاء
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setEditMode(true)}
                      className="text-brand border border-brand/40 rounded-lg text-[10px] px-2 py-1"
                    >
                      ✏️ تعديل
                    </button>
                  )}
                  <div className="font-bold text-right text-xs">📋 معلومات</div>
                </div>

                {editMode ? (
                  <div className="space-y-2 text-right">
                    <input
                      className="input w-full"
                      placeholder="الاسم"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    />
                    <div className="text-[10px] text-dim">
                      📞 {selected.phone} <span className="text-dim">(غير قابل للتعديل حالياً — اتصل بالإدارة للتصحيح)</span>
                    </div>
                    <input
                      className="input w-full"
                      placeholder="البريد الإلكتروني"
                      value={editForm.email}
                      onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                    />
                    <input
                      className="input w-full"
                      placeholder="المدينة"
                      value={editForm.city}
                      onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                    />
                    <input
                      className="input w-full"
                      placeholder="العنوان"
                      value={editForm.address}
                      onChange={(e) => setEditForm({ ...editForm, address: e.target.value })}
                    />
                    <input
                      className="input w-full"
                      placeholder="رقم الهوية"
                      value={editForm.id_number}
                      onChange={(e) => setEditForm({ ...editForm, id_number: e.target.value })}
                      dir="ltr"
                      maxLength={9}
                    />
                    <textarea
                      className="input w-full min-h-[50px]"
                      placeholder="ملاحظات"
                      value={editForm.notes}
                      onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    />
                  </div>
                ) : (
                  <>
                    <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
                      <div className="text-muted text-xs">📞 {selected.phone}</div>
                      <div className="text-muted text-xs">📧 {selected.email || "—"}</div>
                      <div className="text-muted text-xs">🏙️ {selected.city || "—"}</div>
                      <div className="text-muted text-xs">🪪 {selected.id_number || "—"}</div>
                    </div>
                    {selected.tags?.length > 0 && (
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {selected.tags.map((t: string) => (
                          <span key={t} className="badge bg-brand/10 text-brand">{t}</span>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Order history */}
              <div className="card" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="font-bold text-right mb-1.5 text-xs">📦 سجل الطلبات ({custOrders.length})</div>
                {custOrders.length === 0 ? <div className="text-center text-dim text-xs py-4">لا يوجد طلبات</div> :
                  custOrders.map((o: any) => (
                    <div key={o.id} className="flex justify-between py-1.5 border-b border-surface-border last:border-0">
                      <span className="text-brand font-bold text-sm">{formatCurrency(Number(o.total))}</span>
                      <div className="text-right">
                        <span className="text-sm font-bold">{o.id}</span>
                        <div className="text-muted text-[10px]">{o.status} • {formatDate(o.created_at)}</div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
