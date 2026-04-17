"use client";

export const dynamic = "force-dynamic";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useScreen, useDebounce } from "@/lib/hooks";
import { CUSTOMER_SEGMENT } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Modal } from "@/components/admin/shared";

type CustomerRow = {
  id: string;
  name: string;
  phone: string;
  email?: string;
  city?: string;
  segment: string;
  source?: string;
  customer_code?: string;
  total_orders: number;
  total_spent: number;
  avg_order_value: number;
  last_order_at?: string;
  tags?: string[];
  created_at: string;
};

const SOURCES = [
  { k: "all", l: "الكل" },
  { k: "manual", l: "يدوي" },
  { k: "store", l: "المتجر" },
  { k: "pipeline", l: "Pipeline" },
  { k: "whatsapp", l: "واتساب" },
  { k: "webchat", l: "دردشة" },
];

export default function CustomersPage() {
  const scr = useScreen();
  const router = useRouter();
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [segment, setSegment] = useState("all");
  const [source, setSource] = useState("all");
  const [search, setSearch] = useState("");
  const [hotSearch, setHotSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const debouncedHotSearch = useDebounce(hotSearch, 300);
  const [error, setError] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    segment: "new",
    source: "manual",
    notes: "",
  });

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (segment !== "all") params.set("segment", segment);
      if (source !== "all") params.set("source", source);
      if (debouncedSearch) params.set("search", debouncedSearch);
      if (debouncedHotSearch) params.set("hot_search", debouncedHotSearch);
      const res = await fetch(`/api/crm/customers?${params}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "خطأ في جلب الزبائن");
      }
      const json = await res.json();
      const cd = json.data ?? json;
      setCustomers(cd.customers ?? []);
      setTotal(cd.total ?? 0);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }, [segment, source, debouncedSearch, debouncedHotSearch]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleCreate = async () => {
    if (!form.name.trim() || !form.phone.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch("/api/crm/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "فشل إنشاء العميل");
      }
      setShowCreate(false);
      setForm({ name: "", phone: "", email: "", city: "", segment: "new", source: "manual", notes: "" });
      fetchCustomers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "خطأ");
    } finally {
      setCreating(false);
    }
  };

  // Stats
  const totalSpent = customers.reduce((s, c) => s + Number(c.total_spent || 0), 0);
  const totalOrders = customers.reduce((s, c) => s + Number(c.total_orders || 0), 0);

  const segTabs = [
    { k: "all", l: "الكل", c: total },
    ...Object.entries(CUSTOMER_SEGMENT).map(([k, v]) => ({
      k,
      l: `${v.icon} ${v.label}`,
      c: customers.filter((c) => c.segment === k).length,
    })),
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>
          👥 الزبائن
        </h1>
        <button
          onClick={() => setShowCreate(true)}
          className="btn-brand"
          style={{ fontSize: scr.mobile ? 11 : 13, padding: scr.mobile ? "6px 12px" : "8px 16px" }}
        >
          + عميل جديد
        </button>
      </div>

      {/* Stats bar */}
      <div
        className="grid gap-2 mb-3"
        style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr" }}
      >
        <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
          <div className="text-muted text-[9px]">العملاء</div>
          <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>
            {total}
          </div>
        </div>
        <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
          <div className="text-muted text-[9px]">إجمالي الإنفاق</div>
          <div className="font-black text-green-400" style={{ fontSize: scr.mobile ? 12 : 16 }}>
            {formatCurrency(totalSpent)}
          </div>
        </div>
        <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
          <div className="text-muted text-[9px]">إجمالي الطلبات</div>
          <div className="font-black" style={{ fontSize: scr.mobile ? 14 : 18 }}>
            {totalOrders}
          </div>
        </div>
        {!scr.mobile && (
          <div className="bg-surface-elevated rounded-xl p-2.5 text-center">
            <div className="text-muted text-[9px]">متوسط الطلب</div>
            <div className="font-black" style={{ fontSize: 16 }}>
              {totalOrders > 0 ? formatCurrency(totalSpent / totalOrders) : "₪0"}
            </div>
          </div>
        )}
      </div>

      {/* Search */}
      <div
        className="flex items-center gap-1.5 bg-surface-elevated rounded-xl border border-surface-border mb-3"
        style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}
      >
        <span className="text-sm opacity-30">⌕</span>
        <input
          className="flex-1 bg-transparent border-none text-white outline-none"
          style={{ fontSize: scr.mobile ? 12 : 14 }}
          placeholder="ابحث بالاسم، هاتف، إيميل أو كود العميل..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div
        className="flex items-center gap-1.5 bg-surface-elevated rounded-xl border border-surface-border mb-3"
        style={{ padding: scr.mobile ? "8px 12px" : "10px 16px" }}
      >
        <span className="text-sm opacity-30">🔥</span>
        <input
          className="flex-1 bg-transparent border-none text-white outline-none"
          style={{ fontSize: scr.mobile ? 12 : 14 }}
          placeholder="بحث HOT: HOT ID / HOT Customer Code / رقم خط"
          value={hotSearch}
          onChange={(e) => setHotSearch(e.target.value)}
          dir="ltr"
        />
      </div>

      {/* Segment tabs */}
      <div className="flex gap-1 mb-2 overflow-x-auto">
        {segTabs.map((t) => (
          <button
            key={t.k}
            onClick={() => setSegment(t.k)}
            className={`chip whitespace-nowrap ${segment === t.k ? "chip-active" : ""}`}
          >
            {t.l}{" "}
            {t.c > 0 && <span className="text-[8px] opacity-60 mr-0.5">({t.c})</span>}
          </button>
        ))}
      </div>

      {/* Source filter */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {SOURCES.map((s) => (
          <button
            key={s.k}
            onClick={() => setSource(s.k)}
            className={`chip whitespace-nowrap text-[10px] ${source === s.k ? "chip-active" : ""}`}
          >
            {s.l}
          </button>
        ))}
      </div>

      {/* Error */}
      {error && (
        <div className="text-center py-4 text-red-400 text-sm mb-2">⚠️ {error}</div>
      )}

      {/* List */}
      {loading ? (
        <div className="text-center py-12 text-muted">⏳</div>
      ) : customers.length === 0 ? (
        <div className="text-center py-12 text-dim">
          <div className="text-3xl mb-2">👥</div>
          <div className="text-sm">لا يوجد زبائن</div>
        </div>
      ) : (
        <div className="space-y-1.5">
          {customers.map((c) => {
            const seg =
              CUSTOMER_SEGMENT[c.segment as keyof typeof CUSTOMER_SEGMENT];
            return (
              <div
                key={c.id}
                className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
                style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
                onClick={() => router.push(`/crm/customers/${c.id}`)}
              >
                <div className="text-left flex-shrink-0">
                  <div
                    className="font-black text-brand"
                    style={{ fontSize: scr.mobile ? 14 : 18 }}
                  >
                    {formatCurrency(c.total_spent)}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: scr.mobile ? 8 : 10 }}
                  >
                    {c.total_orders} طلب
                  </div>
                </div>
                <div className="flex-1 text-right mr-2">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span
                      className="font-bold"
                      style={{ fontSize: scr.mobile ? 12 : 14 }}
                    >
                      {c.name}
                    </span>
                    {seg && (
                      <span
                        className="badge"
                        style={{
                          background: `${seg.color}15`,
                          color: seg.color,
                        }}
                      >
                        {seg.icon} {seg.label}
                      </span>
                    )}
                  </div>
                  <div
                    className="text-muted"
                    style={{ fontSize: scr.mobile ? 9 : 11 }}
                  >
                    {c.phone} {c.city && `• ${c.city}`}
                    {c.customer_code && (
                      <span className="font-mono text-brand/70"> • {c.customer_code}</span>
                    )}
                    {c.last_order_at && ` • آخر طلب: ${timeAgo(c.last_order_at)}`}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Customer Modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="➕ عميل جديد"
      >
        <div className="space-y-3">
          <div>
            <label className="text-xs text-muted block mb-1 text-right">
              الاسم *
            </label>
            <input
              className="input w-full"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="اسم العميل"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 text-right">
              الهاتف *
            </label>
            <input
              className="input w-full"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="05XXXXXXXX"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 text-right">
              إيميل
            </label>
            <input
              className="input w-full"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="email@example.com"
              dir="ltr"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 text-right">
              المدينة
            </label>
            <input
              className="input w-full"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              placeholder="المدينة"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 text-right">
              التصنيف
            </label>
            <select
              className="input w-full"
              value={form.segment}
              onChange={(e) => setForm({ ...form, segment: e.target.value })}
            >
              {Object.entries(CUSTOMER_SEGMENT).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.icon} {v.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted block mb-1 text-right">
              ملاحظات
            </label>
            <textarea
              className="input w-full"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="ملاحظات..."
            />
          </div>
          <button
            onClick={handleCreate}
            disabled={creating || !form.name.trim() || !form.phone.trim()}
            className="btn-brand w-full"
          >
            {creating ? "⏳ جاري الحفظ..." : "💾 حفظ العميل"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
