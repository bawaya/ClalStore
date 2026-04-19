"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  User,
  CreditCard,
  Smartphone,
  Phone,
  MapPin,
  Plus,
  Trash2,
  Save,
  Send,
  ArrowRight,
  Search,
  Info,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import {
  isValidIsraeliId,
  isValidIsraeliMobile,
  isValidBankBranch,
  isValidBankAccount,
} from "@/lib/validators/israeli";
import type { IsraeliBank } from "@/lib/data/israeli-banks";
import type { IsraeliLocality } from "@/lib/data/israeli-localities";

// ─── Form state types ────────────────────────────────────────────────
interface DeviceForm {
  device_name: string;
  total_price: string;
  installments_count: string;
}
interface PackageForm {
  package_name: string;
  monthly_price: string;
  lines_count: string;
}

const EMPTY_DEVICE: DeviceForm = { device_name: "", total_price: "", installments_count: "12" };
const EMPTY_PACKAGE: PackageForm = { package_name: "", monthly_price: "", lines_count: "1" };

// ─── Small hook: debounced value ─────────────────────────────────────
function useDebounced<T>(value: T, delay = 200): T {
  const [d, setD] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setD(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return d;
}

export default function NewSalesRequestPage() {
  const router = useRouter();

  // ─── Customer ──────────────────────────────────────────────────────
  const [customerName, setCustomerName] = useState("");
  const [customerIdNumber, setCustomerIdNumber] = useState("");
  const [contactNumber, setContactNumber] = useState("");

  // ─── Delivery address + locality search ────────────────────────────
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [localityName, setLocalityName] = useState<string | null>(null);
  const [localityQuery, setLocalityQuery] = useState("");
  const [localityOptions, setLocalityOptions] = useState<IsraeliLocality[]>([]);
  const [localityFocused, setLocalityFocused] = useState(false);
  const debouncedLocality = useDebounced(localityQuery, 200);

  useEffect(() => {
    if (!debouncedLocality.trim()) {
      setLocalityOptions([]);
      return;
    }
    let cancel = false;
    (async () => {
      const url = `/api/employee/sales-requests/reference?localities=${encodeURIComponent(debouncedLocality)}`;
      const res = await fetch(url, { credentials: "same-origin" });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      if (cancel) return;
      const list = ((json.data ?? json) as { localities?: IsraeliLocality[] }).localities || [];
      setLocalityOptions(list);
    })();
    return () => {
      cancel = true;
    };
  }, [debouncedLocality]);

  // ─── Bank ──────────────────────────────────────────────────────────
  const [bankName, setBankName] = useState("");
  const [bankCode, setBankCode] = useState<string | null>(null);
  const [bankQuery, setBankQuery] = useState("");
  const [bankOptions, setBankOptions] = useState<IsraeliBank[]>([]);
  const [bankFocused, setBankFocused] = useState(false);
  const [bankBranch, setBankBranch] = useState("");
  const [bankAccount, setBankAccount] = useState("");

  // Load full bank list on mount
  useEffect(() => {
    (async () => {
      const res = await fetch("/api/employee/sales-requests/reference", { credentials: "same-origin" });
      if (!res.ok) return;
      const json = await res.json().catch(() => ({}));
      const banks = ((json.data ?? json) as { banks?: IsraeliBank[] }).banks || [];
      setBankOptions(banks);
    })();
  }, []);

  const visibleBanks = useMemo(() => {
    const q = bankQuery.trim().toLowerCase();
    if (!q) return bankOptions;
    return bankOptions.filter(
      (b) =>
        b.name_he.toLowerCase().includes(q) ||
        b.name_ar.toLowerCase().includes(q) ||
        b.code.includes(q),
    );
  }, [bankQuery, bankOptions]);

  // ─── Devices + packages ────────────────────────────────────────────
  const [devices, setDevices] = useState<DeviceForm[]>([{ ...EMPTY_DEVICE }]);
  const [packages, setPackages] = useState<PackageForm[]>([]);

  // ─── UI state ──────────────────────────────────────────────────────
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showReview, setShowReview] = useState(false);

  // ─── Field-level validations (for inline hints) ────────────────────
  const idValid = isValidIsraeliId(customerIdNumber);
  const phoneValid = isValidIsraeliMobile(contactNumber);
  const branchValid = isValidBankBranch(bankBranch);
  const accountValid = isValidBankAccount(bankAccount);

  const devicesTotal = useMemo(
    () => devices.reduce((s, d) => s + (Number(d.total_price) || 0), 0),
    [devices],
  );
  const packagesMonthlyTotal = useMemo(
    () => packages.reduce((s, p) => s + (Number(p.monthly_price) || 0) * (Number(p.lines_count) || 1), 0),
    [packages],
  );
  const totalLinesCount = useMemo(
    () => packages.reduce((s, p) => s + (Number(p.lines_count) || 1), 0),
    [packages],
  );

  // Expected commission preview (contract rates — admin may see slightly
  // different numbers if employee has a custom profile)
  const expectedCommission = useMemo(() => {
    const DEVICE_RATE = 0.05;
    const DEVICE_MILESTONE = 50000;
    const DEVICE_MILESTONE_BONUS = 2500;
    const LINE_MULTIPLIER = 4;
    const deviceBase = devicesTotal * DEVICE_RATE;
    const deviceMilestones = Math.floor(devicesTotal / DEVICE_MILESTONE) * DEVICE_MILESTONE_BONUS;
    const lineCom = packages.reduce((s, p) => {
      const price = Number(p.monthly_price) || 0;
      const count = Number(p.lines_count) || 1;
      if (price < 19.9) return s;
      return s + price * LINE_MULTIPLIER * count;
    }, 0);
    return Math.round(deviceBase + deviceMilestones + lineCom);
  }, [devicesTotal, packages]);

  // ─── Field update helpers ──────────────────────────────────────────
  const updateDevice = (i: number, patch: Partial<DeviceForm>) => {
    setDevices((arr) => arr.map((d, idx) => (idx === i ? { ...d, ...patch } : d)));
  };
  const updatePackage = (i: number, patch: Partial<PackageForm>) => {
    setPackages((arr) => arr.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  };

  // ─── Submit (draft or submit) ──────────────────────────────────────
  const submit = useCallback(
    async (asSubmit: boolean) => {
      setError("");
      setBusy(true);
      setSuccess("");
      try {
        if (asSubmit) {
          if (!customerName) throw new Error("اسم الزبون مطلوب");
          if (!idValid) throw new Error("رقم الهوية غير صالح");
          if (!phoneValid) throw new Error("رقم التواصل غير صالح");
          if (!deliveryAddress) throw new Error("عنوان التوصيل مطلوب");
          if (!bankName) throw new Error("اسم البنك مطلوب");
          if (!branchValid) throw new Error("رقم الفرع يجب ٣ أرقام");
          if (!accountValid) throw new Error("رقم الحساب بين ٤-٩ أرقام");
          if (devices.length === 0) throw new Error("يجب إضافة جهاز واحد على الأقل");
          for (const d of devices) {
            if (!d.device_name || !(Number(d.total_price) > 0)) {
              throw new Error("بيانات الجهاز غير مكتملة");
            }
            const inst = Number(d.installments_count);
            if (!(inst >= 1 && inst <= 60)) throw new Error("عدد الدفعات بين ١-٦٠");
          }
          for (const p of packages) {
            if (!p.package_name || !(Number(p.monthly_price) > 0)) {
              throw new Error("بيانات الحڤيلا غير مكتملة");
            }
            const lc = Number(p.lines_count);
            if (!(lc >= 1 && lc <= 20)) throw new Error("عدد الخطوط بين ١-٢٠");
          }
        }

        const payload = {
          customer_name: customerName.trim(),
          customer_id_number: customerIdNumber.trim(),
          contact_number: contactNumber.trim(),
          delivery_address: deliveryAddress.trim(),
          locality_name: localityName,
          bank_name: bankName,
          bank_code: bankCode,
          bank_branch: bankBranch.trim(),
          bank_account: bankAccount.trim(),
          devices: devices.map((d) => ({
            device_name: d.device_name.trim(),
            total_price: Number(d.total_price) || 0,
            installments_count: Number(d.installments_count) || 12,
          })),
          packages: packages.map((p) => ({
            package_name: p.package_name.trim(),
            monthly_price: Number(p.monthly_price) || 0,
            lines_count: Number(p.lines_count) || 1,
          })),
          submit: asSubmit,
        };

        const res = await fetch("/api/employee/sales-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify(payload),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || "فشل الحفظ");

        const data = (json.data ?? json) as { id: number; status: string };
        setSuccess(
          asSubmit ? `تم إرسال الطلب #${data.id} — في انتظار اعتماد الإدارة` : `تم حفظ المسوّدة (#${data.id})`,
        );
        // Go to the detail page of the newly created request
        setTimeout(() => router.push(`/sales-pwa/requests/${data.id}`), 900);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "خطأ");
      } finally {
        setBusy(false);
      }
    },
    [
      customerName, customerIdNumber, contactNumber, deliveryAddress, localityName,
      bankName, bankCode, bankBranch, bankAccount, devices, packages,
      idValid, phoneValid, branchValid, accountValid, router,
    ],
  );

  return (
    <div className="space-y-4 pb-20">
      {/* Top bar */}
      <section className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/5 p-4">
        <Link href="/sales-pwa/requests" className="inline-flex items-center gap-1 text-sm text-sky-300 hover:text-sky-200">
          <ArrowRight className="h-4 w-4" aria-hidden />
          عودة
        </Link>
        <h1 className="text-lg font-black">طلب مبيعات جديد</h1>
      </section>

      {error && (
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm font-bold text-rose-200">
          ⚠️ {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-200">
          ✅ {success}
        </div>
      )}

      {/* ─── Section 1: Customer info ────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
          <User className="h-4 w-4" aria-hidden />
          معلومات الزبون
        </h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="اسم الزبون" required>
            <input
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="pwa-input"
              placeholder="الاسم الكامل"
            />
          </Field>
          <Field label="رقم الهوية (٩ أرقام)" required error={customerIdNumber && !idValid ? "رقم غير صالح" : null}>
            <input
              type="text"
              inputMode="numeric"
              value={customerIdNumber}
              onChange={(e) => setCustomerIdNumber(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className={`pwa-input ${customerIdNumber && !idValid ? "ring-rose-500" : customerIdNumber && idValid ? "ring-emerald-500" : ""}`}
              placeholder="000000000"
              maxLength={9}
            />
          </Field>
          <Field label="رقم التواصل" required error={contactNumber && !phoneValid ? "05X + ٨ أرقام" : null}>
            <input
              type="tel"
              inputMode="tel"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value.replace(/[^\d\s-]/g, ""))}
              className={`pwa-input ${contactNumber && !phoneValid ? "ring-rose-500" : contactNumber && phoneValid ? "ring-emerald-500" : ""}`}
              placeholder="0501234567"
            />
          </Field>
          <LocalityField
            deliveryAddress={deliveryAddress}
            setDeliveryAddress={(v) => { setDeliveryAddress(v); setLocalityQuery(v); }}
            localityOptions={localityOptions}
            focused={localityFocused}
            setFocused={setLocalityFocused}
            onSelect={(loc) => {
              const name = loc.name_ar || loc.name_he;
              setDeliveryAddress(name);
              setLocalityQuery("");
              setLocalityName(loc.name_he);
              setLocalityFocused(false);
            }}
          />
        </div>
      </section>

      {/* ─── Section 2: Bank ─────────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sky-200">
          <CreditCard className="h-4 w-4" aria-hidden />
          بيانات البنك (أمر الدفع)
        </h2>
        <div className="grid gap-3 md:grid-cols-3">
          <Field label="اسم البنك" required>
            <BankCombobox
              banks={visibleBanks}
              query={bankQuery}
              onQueryChange={(q) => { setBankQuery(q); if (!q) { setBankName(""); setBankCode(null); } }}
              bankName={bankName}
              focused={bankFocused}
              setFocused={setBankFocused}
              onSelect={(b) => {
                setBankName(b.name_ar);
                setBankCode(b.code);
                setBankQuery("");
                setBankFocused(false);
              }}
            />
          </Field>
          <Field label="رقم الفرع (٣ أرقام)" required error={bankBranch && !branchValid ? "يجب ٣ أرقام" : null}>
            <input
              type="text"
              inputMode="numeric"
              value={bankBranch}
              onChange={(e) => setBankBranch(e.target.value.replace(/\D/g, "").slice(0, 3))}
              className={`pwa-input ${bankBranch && !branchValid ? "ring-rose-500" : bankBranch && branchValid ? "ring-emerald-500" : ""}`}
              placeholder="000"
              maxLength={3}
            />
          </Field>
          <Field label="رقم الحساب (٤-٩ أرقام)" required error={bankAccount && !accountValid ? "٤-٩ أرقام" : null}>
            <input
              type="text"
              inputMode="numeric"
              value={bankAccount}
              onChange={(e) => setBankAccount(e.target.value.replace(/\D/g, "").slice(0, 9))}
              className={`pwa-input ${bankAccount && !accountValid ? "ring-rose-500" : bankAccount && accountValid ? "ring-emerald-500" : ""}`}
              placeholder="000000"
              maxLength={9}
            />
          </Field>
        </div>
      </section>

      {/* ─── Section 3: Devices ──────────────────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-sky-200">
            <Smartphone className="h-4 w-4" aria-hidden />
            الأجهزة
            <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200">إلزامي</span>
          </h2>
          <button
            type="button"
            onClick={() => setDevices((arr) => [...arr, { ...EMPTY_DEVICE }])}
            className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/30"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> إضافة جهاز
          </button>
        </div>
        <div className="space-y-3">
          {devices.map((d, i) => {
            const price = Number(d.total_price) || 0;
            const inst = Number(d.installments_count) || 1;
            const monthly = price > 0 && inst > 0 ? price / inst : 0;
            return (
              <div key={i} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-300">جهاز #{i + 1}</span>
                  {devices.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setDevices((arr) => arr.filter((_, idx) => idx !== i))}
                      className="text-rose-300 hover:text-rose-200"
                      aria-label="حذف الجهاز"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <Field label="اسم الجهاز" required>
                    <input
                      type="text"
                      value={d.device_name}
                      onChange={(e) => updateDevice(i, { device_name: e.target.value })}
                      className="pwa-input"
                      placeholder="iPhone 15 Pro 256GB"
                    />
                  </Field>
                  <Field label="السعر الكلي (₪)" required>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={d.total_price}
                      onChange={(e) => updateDevice(i, { total_price: e.target.value })}
                      className="pwa-input"
                      placeholder="3500"
                      min={0}
                      step="0.01"
                    />
                  </Field>
                  <Field label="عدد الدفعات (١-٦٠)" required>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={d.installments_count}
                      onChange={(e) => updateDevice(i, { installments_count: e.target.value })}
                      className="pwa-input"
                      placeholder="12"
                      min={1}
                      max={60}
                    />
                  </Field>
                </div>
                {monthly > 0 && (
                  <div className="mt-2 rounded-lg bg-sky-500/10 px-3 py-1.5 text-right text-[11px] text-sky-200">
                    القسط الشهري: <span className="font-black">{formatCurrency(Math.round(monthly * 100) / 100)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* ─── Section 4: Packages (optional) ──────────────────────── */}
      <section className="rounded-2xl border border-white/10 bg-white/5 p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-sm font-bold text-sky-200">
            <Phone className="h-4 w-4" aria-hidden />
            الحڤيلات / الخطوط
            <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-bold text-slate-200">اختياري</span>
          </h2>
          <button
            type="button"
            onClick={() => setPackages((arr) => [...arr, { ...EMPTY_PACKAGE }])}
            className="inline-flex items-center gap-1 rounded-xl bg-sky-500/20 px-3 py-1.5 text-xs font-bold text-sky-200 hover:bg-sky-500/30"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden /> إضافة حڤيلا
          </button>
        </div>
        {packages.length === 0 && (
          <div className="text-center text-[11px] text-slate-400">
            لا يوجد خطوط مضافة. اضغط &ldquo;إضافة حڤيلا&rdquo; لو الزبون يرغب بخط مع الجهاز.
          </div>
        )}
        <div className="space-y-3">
          {packages.map((p, i) => (
            <div key={i} className="rounded-xl border border-white/10 bg-slate-950/40 p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-300">حڤيلا #{i + 1}</span>
                <button
                  type="button"
                  onClick={() => setPackages((arr) => arr.filter((_, idx) => idx !== i))}
                  className="text-rose-300 hover:text-rose-200"
                  aria-label="حذف الحڤيلا"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="اسم الحڤيلا" required>
                  <input
                    type="text"
                    value={p.package_name}
                    onChange={(e) => updatePackage(i, { package_name: e.target.value })}
                    className="pwa-input"
                    placeholder="חבילת 30GB 5G"
                  />
                </Field>
                <Field label="سعر الحڤيلا الشهري (₪)" required>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={p.monthly_price}
                    onChange={(e) => updatePackage(i, { monthly_price: e.target.value })}
                    className="pwa-input"
                    placeholder="39.90"
                    min={0}
                    step="0.01"
                  />
                </Field>
                <Field label="عدد الخطوط (١-٢٠)" required>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={p.lines_count}
                    onChange={(e) => updatePackage(i, { lines_count: e.target.value })}
                    className="pwa-input"
                    placeholder="1"
                    min={1}
                    max={20}
                  />
                </Field>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Summary + actions ────────────────────────────────────── */}
      <section className="rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-sky-500/5 p-5">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-bold">
          <Info className="h-4 w-4 text-emerald-300" aria-hidden />
          ملخّص
        </h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <SummaryCell label="إجمالي الأجهزة" value={formatCurrency(devicesTotal)} color="sky" />
          <SummaryCell label="إجمالي الخطوط شهري" value={formatCurrency(packagesMonthlyTotal)} color="rose" />
          <SummaryCell label="عدد الخطوط" value={String(totalLinesCount)} color="amber" />
          <SummaryCell label="العمولة المتوقّعة" value={formatCurrency(expectedCommission)} color="emerald" />
        </div>
        <p className="mt-3 text-[11px] text-slate-300">
          العمولة أعلاه تقديرية بناءً على نسب العقد الأساسية. القيمة النهائية تُحسب عند اعتماد الإدارة للطلب.
        </p>
      </section>

      {/* ─── Bottom sticky action bar ─────────────────────────────── */}
      <div className="sticky bottom-0 -mx-4 mt-6 border-t border-white/10 bg-slate-950/95 p-4 backdrop-blur">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => submit(false)}
            disabled={busy}
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-bold text-slate-200 hover:bg-white/10 disabled:opacity-50"
          >
            <Save className="h-4 w-4" aria-hidden />
            حفظ كمسوّدة
          </button>
          <button
            type="button"
            onClick={() => setShowReview(true)}
            disabled={busy}
            className="inline-flex flex-[2] items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 py-3 text-sm font-black text-emerald-950 shadow-lg shadow-emerald-500/30 hover:bg-emerald-400 disabled:opacity-50"
          >
            <Send className="h-4 w-4" aria-hidden />
            مراجعة وإرسال
          </button>
        </div>
      </div>

      {/* ─── Review modal ─────────────────────────────────────────── */}
      {showReview && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/80 backdrop-blur md:items-center md:p-4" onClick={() => setShowReview(false)}>
          <div
            className="w-full max-h-[92vh] overflow-y-auto rounded-t-3xl border border-white/10 bg-slate-900 p-6 md:max-w-2xl md:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-3 text-lg font-black">مراجعة قبل الإرسال</h3>
            <div className="space-y-3 text-sm">
              <KV label="اسم الزبون" value={customerName || "—"} />
              <KV label="رقم الهوية" value={customerIdNumber || "—"} />
              <KV label="رقم التواصل" value={contactNumber || "—"} />
              <KV label="عنوان التوصيل" value={deliveryAddress || "—"} />
              <KV label="البنك" value={bankName || "—"} />
              <KV label="الفرع / الحساب" value={bankBranch && bankAccount ? `${bankBranch} / ${bankAccount}` : "—"} />
              <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                <div className="mb-1.5 text-[11px] font-bold text-sky-200">الأجهزة ({devices.length})</div>
                <ul className="space-y-1 text-[12px]">
                  {devices.map((d, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>{d.device_name || "(بدون اسم)"} — {d.installments_count} دفعة</span>
                      <span className="font-bold">{formatCurrency(Number(d.total_price) || 0)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              {packages.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-3">
                  <div className="mb-1.5 text-[11px] font-bold text-rose-200">الحڤيلات ({packages.length})</div>
                  <ul className="space-y-1 text-[12px]">
                    {packages.map((p, i) => (
                      <li key={i} className="flex justify-between gap-2">
                        <span>{p.package_name || "(بدون اسم)"} — {p.lines_count} خط</span>
                        <span className="font-bold">{formatCurrency(Number(p.monthly_price) || 0)}/شهر</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-emerald-500/10 p-3">
                <div>
                  <div className="text-[10px] text-slate-300">إجمالي المبيعات</div>
                  <div className="text-lg font-black text-emerald-300">{formatCurrency(devicesTotal + packagesMonthlyTotal)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-slate-300">العمولة المتوقّعة</div>
                  <div className="text-lg font-black text-emerald-300">{formatCurrency(expectedCommission)}</div>
                </div>
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setShowReview(false)}
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-bold text-slate-200 hover:bg-white/10"
              >
                تعديل
              </button>
              <button
                type="button"
                onClick={() => { setShowReview(false); void submit(true); }}
                disabled={busy}
                className="flex-[2] rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {busy ? "جارٍ الإرسال..." : "إرسال للاعتماد"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Shared input style */}
      <style jsx>{`
        :global(.pwa-input) {
          width: 100%;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 0.75rem;
          padding: 0.65rem 0.85rem;
          font-size: 0.875rem;
          color: #e2e8f0;
          outline: none;
          transition: border-color 120ms, box-shadow 120ms;
        }
        :global(.pwa-input:focus) {
          border-color: rgba(56, 189, 248, 0.6);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.15);
        }
        :global(.pwa-input.ring-rose-500) {
          border-color: rgb(244 63 94);
          box-shadow: 0 0 0 3px rgba(244, 63, 94, 0.15);
        }
        :global(.pwa-input.ring-emerald-500) {
          border-color: rgb(52 211 153);
          box-shadow: 0 0 0 3px rgba(52, 211, 153, 0.12);
        }
      `}</style>
    </div>
  );
}

// ─── Small components ───────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string | null;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-right">
      <span className="mb-1 block text-[11px] font-bold text-slate-300">
        {label}
        {required && <span className="mx-1 text-rose-400">*</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-[10px] text-rose-300">{error}</span>}
    </label>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5 text-[12px]">
      <span className="text-slate-400">{label}</span>
      <span className="font-bold text-slate-100">{value}</span>
    </div>
  );
}

function SummaryCell({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: "sky" | "rose" | "amber" | "emerald";
}) {
  const cls: Record<typeof color, string> = {
    sky: "text-sky-300",
    rose: "text-rose-300",
    amber: "text-amber-300",
    emerald: "text-emerald-300",
  } as const;
  return (
    <div className="rounded-xl border border-white/5 bg-slate-950/40 p-3 text-center">
      <div className="text-[10px] text-slate-400">{label}</div>
      <div className={`mt-1 text-sm font-black ${cls[color]}`}>{value}</div>
    </div>
  );
}

// Bank autocomplete combobox
function BankCombobox({
  banks,
  query,
  onQueryChange,
  bankName,
  focused,
  setFocused,
  onSelect,
}: {
  banks: IsraeliBank[];
  query: string;
  onQueryChange: (q: string) => void;
  bankName: string;
  focused: boolean;
  setFocused: (f: boolean) => void;
  onSelect: (b: IsraeliBank) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  return (
    <div className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute top-2.5 right-3 h-4 w-4 text-slate-500" aria-hidden />
        <input
          ref={inputRef}
          type="text"
          value={bankName && !query ? bankName : query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          className="pwa-input pr-9"
          placeholder="ابحث عن البنك..."
        />
      </div>
      {focused && banks.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-64 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-xl">
          {banks.map((b) => (
            <button
              key={b.code}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => onSelect(b)}
              className="flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-right text-xs hover:bg-white/10"
            >
              <span className="text-[10px] text-slate-500">{b.code}</span>
              <div>
                <div className="font-bold text-slate-100">{b.name_ar}</div>
                <div className="text-[10px] text-slate-400">{b.name_he}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// Locality autocomplete
function LocalityField({
  deliveryAddress,
  setDeliveryAddress,
  localityOptions,
  focused,
  setFocused,
  onSelect,
}: {
  deliveryAddress: string;
  setDeliveryAddress: (v: string) => void;
  localityOptions: IsraeliLocality[];
  focused: boolean;
  setFocused: (f: boolean) => void;
  onSelect: (loc: IsraeliLocality) => void;
}) {
  return (
    <Field label="المدينة / القرية / عنوان التوصيل" required>
      <div className="relative">
        <div className="relative">
          <MapPin className="pointer-events-none absolute top-2.5 right-3 h-4 w-4 text-slate-500" aria-hidden />
          <input
            type="text"
            value={deliveryAddress}
            onChange={(e) => setDeliveryAddress(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
            className="pwa-input pr-9"
            placeholder="ابدأ الكتابة..."
          />
        </div>
        {focused && localityOptions.length > 0 && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-xl border border-white/10 bg-slate-900 shadow-xl">
            {localityOptions.map((loc, i) => (
              <button
                key={`${loc.name_he}-${i}`}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => onSelect(loc)}
                className="flex w-full items-center justify-between gap-2 border-b border-white/5 px-3 py-2 text-right text-xs hover:bg-white/10"
              >
                <div>
                  <div className="font-bold text-slate-100">{loc.name_ar || loc.name_he}</div>
                  {loc.name_ar && <div className="text-[10px] text-slate-400">{loc.name_he}</div>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </Field>
  );
}
