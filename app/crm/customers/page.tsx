"use client";

import { useState, useEffect, useCallback } from "react";
import { useScreen, useDebounce } from "@/lib/hooks";
import { CUSTOMER_SEGMENT } from "@/lib/constants";
import { formatCurrency, formatDate, timeAgo } from "@/lib/utils";
import { Modal } from "@/components/admin/shared";

export default function CustomersPage() {
  const scr = useScreen();
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [selected, setSelected] = useState<any>(null);
  const [custOrders, setCustOrders] = useState<any[]>([]);

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (segment !== "all") params.set("segment", segment);
    if (debouncedSearch) params.set("search", debouncedSearch);
    const res = await fetch(`/api/crm/customers?${params}`);
    const json = await res.json();
    setCustomers(json.data || []);
    setLoading(false);
  }, [segment, debouncedSearch]);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  const openCustomer = async (c: any) => {
    setSelected(c);
    const res = await fetch(`/api/crm/customers?customerId=${c.id}`);
    const json = await res.json();
    setCustOrders(json.orders || []);
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
      <Modal open={!!selected} onClose={() => { setSelected(null); setCustOrders([]); }} title={`👤 ${selected?.name || ""}`} wide>
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

              <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
                <div className="font-bold text-right mb-1.5 text-xs">📋 معلومات</div>
                <div className="grid gap-1" style={{ gridTemplateColumns: "1fr 1fr" }}>
                  <div className="text-muted text-xs">📞 {selected.phone}</div>
                  <div className="text-muted text-xs">📧 {selected.email || "—"}</div>
                  <div className="text-muted text-xs">🏙️ {selected.city || "—"}</div>
                  <div className="text-muted text-xs">🪪 {selected.id_number || "—"}</div>
                </div>
                {selected.tags?.length > 0 && (
                  <div className="flex gap-1 mt-2 flex-wrap">
                    {selected.tags.map((t: string, i: number) => (
                      <span key={i} className="badge bg-brand/10 text-brand">{t}</span>
                    ))}
                  </div>
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
