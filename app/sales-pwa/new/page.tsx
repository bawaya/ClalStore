"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

export default function NewSalesDocPage() {
  const router = useRouter();
  const [saleType, setSaleType] = useState<"line" | "device" | "mixed">("line");
  const [saleDate, setSaleDate] = useState<string>("");
  const [orderId, setOrderId] = useState("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Customer identity
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerInfo, setCustomerInfo] = useState<{
    id: string;
    name: string;
    customer_code?: string;
  } | null>(null);
  const [lookingUp, setLookingUp] = useState(false);

  async function lookupCustomer(phone: string) {
    if (!phone || phone.length < 9) {
      setCustomerInfo(null);
      return;
    }
    setLookingUp(true);
    try {
      const res = await fetch(`/api/pwa/customer-lookup?phone=${encodeURIComponent(phone)}`, {
        headers: csrfHeaders(),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.data) {
        setCustomerInfo(json.data);
      } else {
        setCustomerInfo(null);
      }
    } catch {
      setCustomerInfo(null);
    } finally {
      setLookingUp(false);
    }
  }

  async function onCreate() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/pwa/sales", {
        method: "POST",
        headers: { ...csrfHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({
          sale_type: saleType,
          sale_date: saleDate || null,
          order_id: orderId || null,
          customer_id: customerInfo?.id || null,
          customer_phone: customerPhone || null,
          total_amount: Number(totalAmount || 0),
          notes: notes || null,
          idempotency_key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || json?.success === false) throw new Error(json?.error || "فشل في إنشاء العملية");
      const created = json.data || json;
      router.push(`/sales-pwa/docs/${created.id}`);
    } catch (e: any) {
      setError(e?.message || "خطأ في الإنشاء");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="text-sm text-slate-400">إنشاء عملية</div>
        <div className="text-2xl font-black">عملية توثيق جديدة</div>
        <div className="mt-1 text-sm text-slate-400">ابدأ بالأساسيات، ثم أضف المرفقات وأرسل العملية.</div>
      </div>

      {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

      <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1">
            <div className="text-sm text-slate-300">نوع البيع</div>
            <select
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              value={saleType}
              onChange={(e) => setSaleType(e.target.value as any)}
            >
              <option value="line">خط</option>
              <option value="device">جهاز</option>
              <option value="mixed">مختلط</option>
            </select>
          </label>

          <label className="space-y-1">
            <div className="text-sm text-slate-300">تاريخ البيع</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              type="date"
              value={saleDate}
              onChange={(e) => setSaleDate(e.target.value)}
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm text-slate-300">رقم الطلب (اختياري)</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              placeholder="مثال: CLM-12345"
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm text-slate-300">هاتف العميل</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              placeholder="05XXXXXXXX"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              onBlur={() => lookupCustomer(customerPhone)}
              dir="ltr"
            />
            {lookingUp && <div className="mt-1 text-xs text-slate-400">جاري البحث…</div>}
            {customerInfo && (
              <div className="mt-2 flex items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 px-3 py-2">
                <span className="text-sm font-bold text-emerald-200">{customerInfo.name}</span>
                {customerInfo.customer_code && (
                  <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-mono text-emerald-300">
                    {customerInfo.customer_code}
                  </span>
                )}
              </div>
            )}
            {customerPhone.length >= 9 && !lookingUp && !customerInfo && (
              <div className="mt-1 text-xs text-amber-400">لم يتم العثور على عميل بهذا الرقم — سيتم إنشاء الوثيقة بدون ربط</div>
            )}
          </label>

          <label className="space-y-1">
            <div className="text-sm text-slate-300">قيمة البيع</div>
            <input
              className="w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              type="number"
              min={0}
              value={totalAmount}
              onChange={(e) => setTotalAmount(Number(e.target.value))}
            />
          </label>

          <label className="space-y-1 sm:col-span-2">
            <div className="text-sm text-slate-300">ملاحظات</div>
            <textarea
              className="min-h-24 w-full resize-y rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm"
              placeholder="أي تفاصيل مهمة…"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push("/sales-pwa")}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
            disabled={loading}
          >
            رجوع
          </button>
          <button
            onClick={onCreate}
            className="rounded-xl bg-emerald-500 px-5 py-2 text-sm font-black text-emerald-950 hover:bg-emerald-400 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? "جاري الإنشاء…" : "إنشاء"}
          </button>
        </div>
      </div>
    </div>
  );
}

