"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Calculator, Smartphone, Phone, PlusCircle } from "lucide-react";
import { csrfHeaders } from "@/lib/csrf-client";
import { formatCurrency } from "@/lib/utils";

type SaleType = "line" | "device";

type CalcResult = {
  contractCommission: number;
  employeeCommission: number;
  ownerProfit: number;
  calculation: string;
  rateSnapshot?: Record<string, unknown>;
};

// Default contract values — mirrors lib/commissions/calculator.COMMISSION so the
// UI can compute offline and still show a sensible preview without an API round-trip.
const CONTRACT = {
  LINE_MULTIPLIER: 4,
  MIN_PACKAGE_PRICE: 19.9,
  DEVICE_RATE: 0.05,
};

function localCalc(saleType: SaleType, amount: number): CalcResult {
  if (!Number.isFinite(amount) || amount <= 0) {
    return {
      contractCommission: 0,
      employeeCommission: 0,
      ownerProfit: 0,
      calculation: "",
    };
  }
  if (saleType === "line") {
    const eff = amount >= CONTRACT.MIN_PACKAGE_PRICE ? amount : 0;
    const contract = eff * CONTRACT.LINE_MULTIPLIER;
    return {
      contractCommission: contract,
      employeeCommission: contract,
      ownerProfit: 0,
      calculation: `${amount} × ${CONTRACT.LINE_MULTIPLIER} = ${contract.toFixed(2)} (preview)`,
    };
  }
  const contract = amount * CONTRACT.DEVICE_RATE;
  return {
    contractCommission: contract,
    employeeCommission: contract,
    ownerProfit: 0,
    calculation: `${amount} × ${(CONTRACT.DEVICE_RATE * 100).toFixed(1)}% = ${contract.toFixed(2)} (preview)`,
  };
}

export default function CalculatorPage() {
  const router = useRouter();
  const [saleType, setSaleType] = useState<SaleType>("line");
  const [amount, setAmount] = useState<string>("");
  const [result, setResult] = useState<CalcResult>({
    contractCommission: 0,
    employeeCommission: 0,
    ownerProfit: 0,
    calculation: "",
  });
  const [loading, setLoading] = useState(false);
  const [source, setSource] = useState<"local" | "api">("local");

  useEffect(() => {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      setResult({ contractCommission: 0, employeeCommission: 0, ownerProfit: 0, calculation: "" });
      setSource("local");
      return;
    }
    // Optimistic local calc for instant feedback
    setResult(localCalc(saleType, num));
    setSource("local");

    const ctl = new AbortController();
    const t = window.setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/employee/commissions/calculate", {
          method: "POST",
          headers: { ...csrfHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ saleType, amount: num }),
          signal: ctl.signal,
          credentials: "same-origin",
        });
        const json: unknown = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (json && typeof json === "object") {
          const data = json as Partial<CalcResult> & { error?: string };
          if (typeof data.contractCommission === "number" && typeof data.employeeCommission === "number") {
            setResult({
              contractCommission: data.contractCommission,
              employeeCommission: data.employeeCommission,
              ownerProfit: Number(data.ownerProfit ?? 0),
              calculation: String(data.calculation ?? ""),
              rateSnapshot: data.rateSnapshot as Record<string, unknown> | undefined,
            });
            setSource("api");
          }
        }
      } catch {
        /* abort or offline — keep local preview */
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => {
      ctl.abort();
      window.clearTimeout(t);
    };
  }, [saleType, amount]);

  function register() {
    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) return;
    const type = saleType === "line" ? "line" : "device";
    router.push(`/sales-pwa/new?type=${encodeURIComponent(type)}&amount=${encodeURIComponent(String(num))}`);
  }

  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-4 flex items-center gap-2">
          <Calculator className="h-5 w-5 text-sky-300" aria-hidden />
          <div className="text-lg font-black">حاسبة العمولة · מחשבון</div>
        </div>

        {/* Type toggle */}
        <fieldset className="mb-4 grid grid-cols-2 gap-2" aria-label="نوع البيع">
          <legend className="sr-only">نوع البيع</legend>
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-bold ${
              saleType === "line"
                ? "border-sky-400 bg-sky-500/20 text-sky-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              name="saleType"
              value="line"
              checked={saleType === "line"}
              onChange={() => setSaleType("line")}
              className="sr-only"
            />
            <Phone className="h-4 w-4" aria-hidden />
            خط · קו
          </label>
          <label
            className={`flex cursor-pointer items-center justify-center gap-2 rounded-2xl border p-4 text-sm font-bold ${
              saleType === "device"
                ? "border-rose-400 bg-rose-500/20 text-rose-100"
                : "border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
            }`}
          >
            <input
              type="radio"
              name="saleType"
              value="device"
              checked={saleType === "device"}
              onChange={() => setSaleType("device")}
              className="sr-only"
            />
            <Smartphone className="h-4 w-4" aria-hidden />
            جهاز · מכשיר
          </label>
        </fieldset>

        {/* Amount input */}
        <label className="block space-y-2">
          <span className="text-sm text-slate-300">
            {saleType === "line" ? "سعر الباقة (₪)" : "سعر الجهاز (₪)"}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={saleType === "line" ? "مثال: 49.90" : "مثال: 2500"}
            className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-2xl font-black tracking-wider"
            dir="ltr"
          />
        </label>
      </section>

      {/* Results */}
      <section className="rounded-2xl border border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-5">
        <div className="mb-1 text-[11px] text-slate-400">
          {source === "api" ? "محسوبة من ملفك الشخصي" : loading ? "جاري المزامنة…" : "معاينة تقريبية"}
        </div>
        <div className="text-xs text-slate-300">عمولتك · העמלה שלך</div>
        <div className="text-4xl font-black text-emerald-300 md:text-5xl">
          {formatCurrency(result.employeeCommission)}
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-slate-400">عمولة العقد</div>
            <div className="font-bold">{formatCurrency(result.contractCommission)}</div>
          </div>
          <div className="rounded-xl bg-white/5 p-3">
            <div className="text-[10px] text-slate-400">ربح المالك</div>
            <div className="font-bold">{formatCurrency(result.ownerProfit)}</div>
          </div>
        </div>
        {result.calculation && (
          <div className="mt-4">
            <div className="text-[10px] text-slate-400">تفصيل الحساب</div>
            <div
              className="mt-1 rounded-xl bg-slate-950 p-3 font-mono text-[11px] text-slate-300"
              dir="ltr"
            >
              {result.calculation}
            </div>
          </div>
        )}
      </section>

      <button
        type="button"
        onClick={register}
        disabled={!Number(amount)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-5 py-4 text-base font-black text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <PlusCircle className="h-5 w-5" aria-hidden />
        سجّل هذه البيعة · רשום מכירה
      </button>
    </div>
  );
}
