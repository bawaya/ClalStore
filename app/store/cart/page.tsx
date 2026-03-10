"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { StepBar } from "@/components/store/cart/StepBar";
import { CartStep } from "@/components/store/cart/CartStep";
import { ConfirmStep } from "@/components/store/cart/ConfirmStep";
import {
  validatePhone, validateIsraeliID, validateEmail,
  validateBranch, validateAccount,
} from "@/lib/validators";
import { BANKS } from "@/lib/constants";
import { searchCities, type City } from "@/lib/cities";

interface CustomerInfo {
  name: string; phone: string; email: string;
  city: string; address: string; idNumber: string; notes: string;
}

interface PaymentInfo {
  method: "bank" | "credit";
  bank: string; branch: string; account: string;
  installments: number;
}

interface OrderResult {
  id: string; total: number; items: { name: string; name_he?: string; price: number }[];
  city: string; address: string; customer: string; phone: string;
  notes: string; hasDevice: boolean; date: string;
  installments: number; monthlyAmount: number; bankName: string;
}

const lbl = "block text-muted text-[10px] desktop:text-xs font-semibold mb-1";
const errS = "text-[9px] text-state-error mt-0.5";

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="mb-2.5">
      <label className={lbl}>{label}</label>
      {children}
      {error && <div className={errS}>⚠️ {error}</div>}
    </div>
  );
}

function CityCombobox({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<City[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setResults(searchCities(query)), 150);
    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (city: City) => {
    onChange(city.ar);
    setQuery(city.ar);
    setOpen(false);
  };

  return (
    <Field label="🏙️ المدينة *" error={error}>
      <div ref={ref} className="relative">
        <input
          className="input w-full"
          placeholder="اكتب اسم المدينة للبحث..."
          value={query}
          onChange={(e) => { setQuery(e.target.value); onChange(""); setOpen(true); }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          aria-label="البحث عن المدينة"
        />
        {value && (
          <button
            type="button"
            onClick={() => { setQuery(""); onChange(""); setOpen(true); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs cursor-pointer bg-transparent border-0 p-0.5"
            aria-label="مسح المدينة"
          >✕</button>
        )}
        {open && results.length > 0 && (
          <div
            className="absolute z-50 w-full mt-1 max-h-48 overflow-y-auto bg-surface-elevated border border-surface-border rounded-xl shadow-2xl"
            role="listbox"
            style={{ scrollbarWidth: "thin" }}
          >
            {results.slice(0, 50).map((c) => (
              <button
                key={c.ar + c.he}
                type="button"
                role="option"
                aria-selected={value === c.ar}
                onClick={() => select(c)}
                className={`w-full text-right px-3 py-2 text-sm border-0 cursor-pointer transition-colors hover:bg-brand/10 ${
                  value === c.ar ? "bg-brand/15 text-brand font-bold" : "bg-transparent text-white"
                }`}
              >
                {c.ar} <span className="text-dim text-[10px] mr-1">({c.he})</span>
              </button>
            ))}
          </div>
        )}
        {open && query && results.length === 0 && (
          <div className="absolute z-50 w-full mt-1 bg-surface-elevated border border-surface-border rounded-xl shadow-2xl p-3 text-center text-muted text-xs">
            لم يتم العثور على مدينة
          </div>
        )}
      </div>
    </Field>
  );
}

export default function CartPage() {
  const scr = useScreen();
  const router = useRouter();
  const { toasts, show } = useToast();
  const cart = useCart();
  const items = cart.items;
  const total = cart.getTotal();
  const hasDevices = cart.hasDevices();

  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<CustomerInfo>({ name: "", phone: "", email: "", city: "", address: "", idNumber: "", notes: "" });
  const [pay, setPay] = useState<PaymentInfo>({ method: "bank", bank: "", branch: "", account: "", installments: 1 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");

  const handleCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, total: cart.getSubtotal() }),
      });
      const data = await res.json();
      if (data.valid) {
        cart.applyCoupon(couponInput.toUpperCase(), data.discount);
        show(`🎉 ${data.message}`, "success");
      } else {
        show(`❌ ${data.message}`, "error");
      }
    } catch {
      show("❌ خطأ في التحقق", "error");
    }
  };

  const validateInfo = (): boolean => {
    const e: Record<string, string> = {};
    if (!info.name.trim()) e.name = "مطلوب";
    if (!validatePhone(info.phone)) e.phone = "رقم غير صالح (05XXXXXXXX)";
    if (info.email && !validateEmail(info.email)) e.email = "بريد غير صالح";
    if (!info.city) e.city = "اختر مدينة";
    if (!info.address.trim()) e.address = "مطلوب";
    if (hasDevices && !validateIsraeliID(info.idNumber)) e.idNumber = "هوية غير صالحة (9 أرقام)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const validatePay = (): boolean => {
    const e: Record<string, string> = {};
    if (hasDevices) {
      if (!pay.bank) e.bank = "اختر بنك";
      if (!validateBranch(pay.branch)) e.branch = "3 أرقام";
      if (!validateAccount(pay.account)) e.account = "4-9 أرقام";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submitOrder = async () => {
    setLoading(true);
    try {
      const monthlyAmount = pay.installments > 1 ? Math.ceil(total / pay.installments) : total;
      const paymentData = hasDevices
        ? { type: "bank", bank: pay.bank, branch: pay.branch, account: pay.account, installments: pay.installments, monthly_amount: monthlyAmount }
        : { type: "credit" };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: info,
          items: items.map((i) => ({
            productId: i.productId, name: i.name, brand: i.brand,
            type: i.type, price: i.price, quantity: i.quantity,
            color: i.color, storage: i.storage,
          })),
          payment: paymentData,
          couponCode: cart.couponCode || undefined,
          discountAmount: cart.discountAmount,
          source: "store",
        }),
      });

      const data = await res.json();

      if (!data.success) {
        show("❌ " + (data.error || "خطأ في إرسال الطلب"), "error");
        return;
      }

      if (data.needsPayment) {
        show("🔄 جاري تحويلك لصفحة الدفع...", "success");

        const payRes = await fetch("/api/payment", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            orderId: data.orderId, amount: data.total,
            customerName: info.name, customerPhone: info.phone,
            customerEmail: info.email || undefined,
            customerCity: info.city, customerAddress: info.address,
            idNumber: info.idNumber || undefined,
            items: items.map((i) => ({ name: i.name, price: i.price, quantity: i.quantity || 1 })),
            maxInstallments: 12,
          }),
        });

        const payData = await payRes.json();

        if (payData.success && payData.paymentUrl) {
          sessionStorage.setItem("clal_pending_order", data.orderId);
          window.location.href = payData.paymentUrl;
          return;
        } else {
          show("❌ " + (payData.error || "خطأ في بوابة الدفع — حاول مجدداً"), "error");
          return;
        }
      }

      const selectedBank = BANKS.find((b) => b.id === pay.bank);
      setOrder({
        id: data.orderId, total,
        items: items.map((i) => ({ name: i.name, name_he: i.name_he, price: i.price })),
        city: info.city, address: info.address, customer: info.name,
        phone: info.phone, notes: info.notes, hasDevice: hasDevices,
        date: new Date().toLocaleDateString("ar-EG"),
        installments: pay.installments,
        monthlyAmount: pay.installments > 1 ? Math.ceil(total / pay.installments) : total,
        bankName: selectedBank?.name_ar || pay.bank,
      });
      setStep(3);
      cart.clearCart();
    } catch {
      show("❌ خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const InfoStep = () => (
    <div>
      <h2 className="font-black text-right mb-3" style={{ fontSize: scr.mobile ? 16 : 20 }}>📝 معلوماتك</h2>
      <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 10 }}>
          <div className="flex-1"><Field label="الاسم الكامل *" error={errors.name}><input className="input" value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="محمد أحمد" /></Field></div>
          <div className="flex-1"><Field label="رقم الهاتف * (05XXXXXXXX)" error={errors.phone}><input className="input" value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value.replace(/[^\d-]/g, "") })} placeholder="0541234567" dir="ltr" /></Field></div>
        </div>
        <Field label="📧 البريد الإلكتروني" error={errors.email}><input className="input" type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} placeholder="email@example.com" dir="ltr" /></Field>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 10 }}>
          <div className="flex-1"><CityCombobox value={info.city} onChange={(v) => setInfo({ ...info, city: v })} error={errors.city} /></div>
          <div className="flex-1"><Field label="📍 العنوان بالتفصيل *" error={errors.address}><input className="input" value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} placeholder="شارع + رقم بيت" /></Field></div>
        </div>
        {hasDevices && (
          <Field label="🪪 رقم الهوية * (תעודת זהות — 9 أرقام)" error={errors.idNumber}>
            <input className="input" value={info.idNumber} onChange={(e) => setInfo({ ...info, idNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="XXXXXXXXX" maxLength={9} dir="ltr" />
          </Field>
        )}
        <Field label="📝 ملاحظات (اختياري)">
          <textarea className="input min-h-[60px] resize-y" value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} placeholder="ملاحظات خاصة..." />
        </Field>
        <button onClick={() => validateInfo() && setStep(2)} className="btn-primary w-full mt-1">المتابعة للدفع →</button>
      </div>
    </div>
  );

  const PayStep = () => (
    <div>
      <h2 className="font-black text-right mb-3" style={{ fontSize: scr.mobile ? 16 : 20 }}>💳 الدفع</h2>
      <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="bg-surface-elevated rounded-xl p-2.5 mb-4">
          <div className="flex justify-between mb-1">
            <span className="font-black text-state-success" style={{ fontSize: scr.mobile ? 16 : 20 }}>₪{total.toLocaleString()}</span>
            <span className="font-bold" style={{ fontSize: scr.mobile ? 11 : 13 }}>المجموع</span>
          </div>
          <div className="text-muted text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>{items.length} منتج • التوصيل: {info.city}</div>
        </div>

        {hasDevices ? (
          <>
            <div className="rounded-xl p-3 mb-3 text-right" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}>
              <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>📋 طلبات الأجهزة تخضع لفحص ومراجعة الفريق — الدفع عبر تحويل بنكي</div>
            </div>
            <Field label="🏦 البنك *" error={errors.bank}><select className="input" value={pay.bank} onChange={(e) => setPay({ ...pay, bank: e.target.value })}><option value="">اختر البنك...</option>{BANKS.map((b) => <option key={b.id} value={b.id}>{b.name_ar} ({b.name_he})</option>)}</select></Field>
            <div className="flex gap-2.5">
              <div className="flex-1"><Field label="رقم الفرع (3) *" error={errors.branch}><input className="input" value={pay.branch} onChange={(e) => setPay({ ...pay, branch: e.target.value.replace(/\D/g, "").slice(0, 3) })} maxLength={3} dir="ltr" /></Field></div>
              <div className="flex-1"><Field label="رقم الحساب (4-9) *" error={errors.account}><input className="input" value={pay.account} onChange={(e) => setPay({ ...pay, account: e.target.value.replace(/\D/g, "").slice(0, 9) })} maxLength={9} dir="ltr" /></Field></div>
            </div>
            <Field label="📅 عدد الدفعات">
              <select className="input" value={pay.installments} onChange={(e) => setPay({ ...pay, installments: Number(e.target.value) })}>
                {[1, 2, 3, 6, 9, 12, 15, 18].map((n) => (
                  <option key={n} value={n}>{n === 1 ? "دفعة واحدة (تحويل بنكي)" : `${n} دفعات`}</option>
                ))}
              </select>
            </Field>
            {pay.installments > 1 && (
              <div className="rounded-xl p-3 mb-2 text-right" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <div className="text-state-success font-bold mb-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>💰 تقسيط بدون فوائد حتى 18 دفعة!</div>
                <div className="text-white font-black" style={{ fontSize: scr.mobile ? 16 : 20 }}>₪{Math.ceil(total / pay.installments).toLocaleString()} × {pay.installments} شهر</div>
                <div className="text-muted mt-1" style={{ fontSize: scr.mobile ? 10 : 12 }}>المبلغ الإجمالي: ₪{total.toLocaleString()} — بدون فوائد</div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-xl p-4 text-right" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(6,182,212,0.06))", border: "1px solid rgba(34,197,94,0.15)" }}>
            <div className="text-lg mb-2">⚡</div>
            <div className="font-bold mb-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>دفع مباشر — بوابة آمنة</div>
            <div className="text-muted mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>سيتم تحويلك لصفحة الدفع الآمنة عبر Rivhit لإتمام الشراء</div>
            <div className="flex items-center gap-2 text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              <span>💳 Visa</span><span>💳 Mastercard</span><span>💳 Isracard</span><span>📱 Bit</span>
            </div>
            <div className="text-state-cyan mt-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>✓ تقسيط حتى 12 دفعة • ✓ PCI-DSS آمن • ✓ חשבונית מס تلقائية</div>
          </div>
        )}

        <button
          onClick={() => validatePay() && submitOrder()}
          disabled={loading}
          className="btn-primary w-full mt-2 disabled:opacity-50"
          style={{ fontSize: scr.mobile ? 14 : 16, padding: "14px 20px" }}
        >
          {loading ? "⏳ جاري المعالجة..." : hasDevices
            ? `📋 تأكيد الطلب — ₪${total.toLocaleString()}`
            : `🔒 متابعة للدفع الآمن — ₪${total.toLocaleString()}`}
        </button>
      </div>
    </div>
  );

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <div className="mx-auto" style={{ maxWidth: scr.mobile ? "100%" : 700, padding: scr.mobile ? "12px 14px 30px" : "20px 28px 40px" }}>
        <StepBar current={step} />
        {step === 0 && (
          <CartStep
            couponInput={couponInput}
            setCouponInput={setCouponInput}
            onApplyCoupon={handleCoupon}
            onNext={() => setStep(1)}
          />
        )}
        {step === 1 && <InfoStep />}
        {step === 2 && <PayStep />}
        {step === 3 && <ConfirmStep order={order} />}
      </div>
      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
      <Footer />
    </div>
  );
}
