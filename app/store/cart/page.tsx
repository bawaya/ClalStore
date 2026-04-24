"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import {
  validatePhone, validateIsraeliID, validateEmail,
  validateBranch, validateAccount,
} from "@/lib/validators";
import { BANKS } from "@/lib/constants";
import { CITY_SEARCH_MIN_LENGTH, searchCities, type City } from "@/lib/cities";
import { csrfHeaders } from "@/lib/csrf-client";

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
  customerCode?: string;
  isNewCustomer?: boolean;
}

const lbl = "block text-muted text-[10px] desktop:text-xs font-semibold mb-1";
const errS = "text-[9px] text-state-error mt-0.5";

interface ChoiceOption {
  value: string;
  label: string;
  subtitle?: string;
  searchText?: string;
}

function Field({ label, error, children, htmlFor }: { label: string; error?: string; children: React.ReactNode; htmlFor?: string }) {
  return (
    <div className="mb-2.5">
      <label className={lbl} htmlFor={htmlFor}>{label}</label>
      {children}
      {error && <div className={errS}>⚠️ {error}</div>}
    </div>
  );
}

function ChoiceCombobox({
  label,
  value,
  onChange,
  error,
  placeholder,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  placeholder: string;
  options: ChoiceOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <Field label={label} error={error}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          className="input w-full text-right flex items-center justify-between gap-3"
        >
          <span className={`truncate ${selected ? "text-white" : "text-muted"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <span className={`text-xs text-muted transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
        </button>

        {open && (
          <div className="absolute z-50 w-full mt-1 overflow-hidden rounded-xl border border-surface-border bg-surface-elevated shadow-2xl">
            <div className="max-h-60 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full border-0 bg-transparent px-3 py-2 text-right transition-colors hover:bg-brand/10 ${
                    option.value === value ? "bg-brand/15 text-brand" : "text-white"
                  }`}
                >
                  <div className="font-arabic text-sm font-medium leading-tight">{option.label}</div>
                  {option.subtitle && (
                    <div className="mt-0.5 text-[11px] text-dim">{option.subtitle}</div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/** Searchable City Combobox — RTL */
function CityCombobox({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();
  const results = searchCities(trimmedQuery);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  // close on outside click
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
          className="input w-full font-arabic"
          placeholder={`اكتب ${CITY_SEARCH_MIN_LENGTH} أحرف على الأقل...`}
          value={query}
          onChange={(e) => {
            const nextValue = e.target.value;
            setQuery(nextValue);
            onChange("");
            setOpen(nextValue.trim().length >= CITY_SEARCH_MIN_LENGTH);
          }}
          onFocus={() => setOpen(trimmedQuery.length >= CITY_SEARCH_MIN_LENGTH)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && results.length === 1) {
              e.preventDefault();
              select(results[0]);
            }
          }}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => { setQuery(""); onChange(""); setOpen(false); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-muted text-xs cursor-pointer bg-transparent border-0 p-0.5"
            aria-label="مسح البحث"
          >✕</button>
        )}
        {trimmedQuery.length > 0 && trimmedQuery.length < CITY_SEARCH_MIN_LENGTH && (
          <div className="absolute z-50 w-full mt-1 rounded-xl border border-surface-border bg-surface-elevated p-3 text-center text-xs text-muted shadow-2xl">
            اكتب {CITY_SEARCH_MIN_LENGTH} أحرف على الأقل ليظهر البحث الذكي
          </div>
        )}
        {open && results.length > 0 && (
          <div className="absolute z-50 w-full mt-1 max-h-56 overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated shadow-2xl"
            style={{ scrollbarWidth: "thin" }}>
            {results.map((c) => (
              <button
                key={c.ar + c.he}
                type="button"
                onClick={() => select(c)}
                className={`w-full border-0 px-3 py-2 text-right transition-colors hover:bg-brand/10 ${
                  value === c.ar ? "bg-brand/15 text-brand" : "bg-transparent text-white"
                }`}
              >
                <div className="font-arabic text-sm font-medium leading-tight">{c.ar}</div>
                <div className="mt-0.5 text-[11px] text-dim">{c.he}</div>
              </button>
            ))}
          </div>
        )}
        {trimmedQuery.length >= CITY_SEARCH_MIN_LENGTH && open && results.length === 0 && (
          <div className="absolute z-50 w-full mt-1 overflow-hidden rounded-xl border border-surface-border bg-surface-elevated shadow-2xl">
            <button
              type="button"
              onClick={() => {
                onChange(trimmedQuery);
                setQuery(trimmedQuery);
                setOpen(false);
              }}
              className="w-full border-0 bg-transparent px-3 py-2 text-right text-white transition-colors hover:bg-brand/10"
            >
              <div className="font-arabic text-sm font-medium">استخدم النص كما أدخلته</div>
              <div className="mt-0.5 text-[11px] text-dim">{trimmedQuery}</div>
            </button>
          </div>
        )}
      </div>
    </Field>
  );
}

export default function CartPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const router = useRouter();
  const { toasts, show } = useToast();
  const cart = useCart();
  const items = cart.items;
  const subtotal = cart.getSubtotal();
  const total = cart.getTotal();
  // hasInstallmentItems: any device OR appliance → bank transfer + installments flow
  // (mobile devices and smart appliances share the exact same payment experience)
  const hasInstallmentItems = cart.hasInstallmentItems();
  const onlyAccessories = cart.hasOnlyAccessories();

  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<CustomerInfo>({ name: "", phone: "", email: "", city: "", address: "", idNumber: "", notes: "" });
  const [pay, setPay] = useState<PaymentInfo>({ method: "bank", bank: "", branch: "", account: "", installments: 1 });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [order, setOrder] = useState<OrderResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [couponInput, setCouponInput] = useState("");
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [accountCustomerCode, setAccountCustomerCode] = useState("");
  const bankOptions: ChoiceOption[] = BANKS.map((bank) => ({
    value: bank.id,
    label: bank.name_ar,
    subtitle: `${bank.name_he} • ${bank.code}`,
    searchText: `${bank.name_ar} ${bank.name_he} ${bank.code}`,
  }));
  const installmentOptions: ChoiceOption[] = [1, 2, 3, 6, 9, 12, 15, 18].map((n) => ({
    value: String(n),
    label: n === 1 ? "دفعة واحدة (تحويل بنكي)" : `${n} دفعات`,
    subtitle: n === 1 ? "بدون تقسيط" : `تقسيط على ${n} أشهر`,
  }));

  // Styles
  const inp = "input";

  const prefillFromSavedAccount = useCallback(async (showToast = true) => {
    const token = localStorage.getItem("clal_customer_token");
    if (!token) {
      sessionStorage.setItem("clal_prefill_cart_after_auth", "1");
      router.push("/store/auth?return=/store/cart");
      return;
    }

    const hasManualInput = Boolean(
      info.name.trim() ||
      info.phone.trim() ||
      info.email.trim() ||
      info.city.trim() ||
      info.address.trim() ||
      info.idNumber.trim()
    );

    if (hasManualInput && showToast) {
      const confirmed = window.confirm("سيتم استبدال البيانات الحالية ببيانات حسابك المحفوظة. هل تريد المتابعة؟");
      if (!confirmed) return;
    }

    setPrefillLoading(true);
    try {
      const res = await fetch("/api/customer/profile", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const json = await res.json();
      const data = json.data ?? json;

      if (!json.success || !data.customer) {
        throw new Error(json.error || data.error || "تعذر جلب بيانات الحساب");
      }

      const customer = data.customer;
      localStorage.setItem("clal_customer", JSON.stringify(customer));
      setAccountCustomerCode(customer.customer_code || "");
      setInfo((prev) => ({
        ...prev,
        name: customer.name || "",
        phone: customer.phone || prev.phone,
        email: customer.email || "",
        city: customer.city || "",
        address: customer.address || "",
      }));

      if (showToast) {
        show(`✅ تم استرجاع بياناتك${customer.customer_code ? ` — الكود: ${customer.customer_code}` : ""}`, "success");
      }
    } catch (err) {
      show(`❌ ${err instanceof Error ? err.message : "تعذر استرجاع البيانات"}`, "error");
    } finally {
      setPrefillLoading(false);
    }
  }, [info.address, info.city, info.email, info.idNumber, info.name, info.phone, router, show]);

  useEffect(() => {
    const shouldPrefill = sessionStorage.getItem("clal_prefill_cart_after_auth") === "1";
    if (!shouldPrefill) return;

    sessionStorage.removeItem("clal_prefill_cart_after_auth");
    void prefillFromSavedAccount(false);
  }, [prefillFromSavedAccount]);

  // === Coupon ===
  const handleCoupon = async () => {
    if (!couponInput.trim()) return;
    try {
      const res = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, total: subtotal }),
      });
      const cJson = await res.json();
      const data = cJson.data ?? cJson;
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

  // === Validate Info ===
  const validateInfo = (): boolean => {
    const e: Record<string, string> = {};
    if (!info.name.trim()) e.name = "مطلوب";
    if (!validatePhone(info.phone)) e.phone = "رقم غير صالح (05XXXXXXXX)";
    if (info.email && !validateEmail(info.email)) e.email = "بريد غير صالح";
    if (!info.city) e.city = "اختر مدينة";
    if (!info.address.trim()) e.address = "مطلوب";
    if (hasInstallmentItems && !validateIsraeliID(info.idNumber)) e.idNumber = "هوية غير صالحة (9 أرقام)";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // === Validate Payment ===
  const validatePay = (): boolean => {
    const e: Record<string, string> = {};
    // Devices + appliances → bank transfer only, need bank details
    if (hasInstallmentItems) {
      if (!pay.bank) e.bank = "اختر بنك";
      if (!validateBranch(pay.branch)) e.branch = "3 أرقام";
      if (!validateAccount(pay.account)) e.account = "4-9 أرقام";
    }
    // Accessories → Rivhit handles card input, no client validation
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  // === Submit Order ===
  const submitOrder = async () => {
    setLoading(true);
    try {
      // 1. Create the order
      // Devices + appliances → bank transfer only | Accessories → credit (Rivhit redirect)
      const monthlyAmount = pay.installments > 1 ? Math.ceil(total / pay.installments) : total;
      const paymentData = hasInstallmentItems
        ? { type: "bank", bank: pay.bank, branch: pay.branch, account: pay.account, installments: pay.installments, monthly_amount: monthlyAmount }
        : { type: "credit" };

      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: info,
          items: items.map((i) => ({
            productId: i.productId,
            name: i.name,
            brand: i.brand,
            type: i.type,
            price: i.price,
            quantity: i.quantity,
            color: i.color,
            storage: i.storage,
          })),
          payment: paymentData,
          couponCode: cart.couponCode || undefined,
          discountAmount: cart.discountAmount,
          source: "store",
        }),
      });

      const oJson = await res.json();
      const data = oJson.data ?? oJson;

      if (!oJson.success) {
        show("❌ " + (oJson.error || data.error || "خطأ في إرسال الطلب"), "error");
        return;
      }

      // 2. If needs payment → redirect to Rivhit hosted page
      if (data.needsPayment) {
        show("🔄 جاري تحويلك لصفحة الدفع...", "success");

        const payRes = await fetch("/api/payment", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            orderId: data.orderId,
            amount: data.total,
            customerName: info.name,
            customerPhone: info.phone,
            customerEmail: info.email || undefined,
            customerCity: info.city,
            customerAddress: info.address,
            idNumber: info.idNumber || undefined,
            items: items.map((i) => ({
              name: i.name,
              price: i.price,
              quantity: i.quantity || 1,
            })),
            maxInstallments: 12,
          }),
        });

        const payJson = await payRes.json();
        const payData = payJson.data ?? payJson;

        if (payJson.success && payData.paymentUrl) {
          try {
            sessionStorage.setItem("clal_pending_order", String(data.orderId));
          } catch {
            /* ignore */
          }
          // Redirect to hosted payment — cart is cleared on /store/checkout/success only
          window.location.href = payData.paymentUrl;
          return;
        } else {
          show("❌ " + (payJson.error || payData.error || "خطأ في بوابة الدفع — حاول مجدداً"), "error");
          return;
        }
      }

      // 3. Bank transfer — show confirmation directly
      const selectedBank = BANKS.find((b) => b.id === pay.bank);
      setOrder({
        id: data.orderId,
        total,
        items: items.map((i) => ({ name: i.name, name_he: i.name_he, price: i.price })),
        city: info.city,
        address: info.address,
        customer: info.name,
        phone: info.phone,
        notes: info.notes,
        hasDevice: hasInstallmentItems,
        date: new Date().toLocaleDateString("ar-EG"),
        installments: pay.installments,
        monthlyAmount: pay.installments > 1 ? Math.ceil(total / pay.installments) : total,
        bankName: selectedBank?.name_ar || pay.bank,
        customerCode: data.customerCode,
        isNewCustomer: !!data.isNewCustomer,
      });
      setStep(3);
      cart.clearCart();
    } catch {
      show("❌ خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  // === Step Bar ===
  const StepBar = () => {
    const steps = ["🛒 السلة", "📝 المعلومات", "💳 الدفع", "✅ تأكيد"];
    return (
      <div className="flex gap-0.5 mb-4 desktop:mb-6">
        {steps.map((s, i) => (
          <div key={i} className="flex-1 text-center">
            <div className="h-1 rounded-sm mb-1 transition-all"
              style={{ background: i <= step ? "#c41040" : "#3f3f46" }} />
            <span style={{ fontSize: scr.mobile ? 8 : 10, color: i <= step ? "#c41040" : "#3f3f46", fontWeight: i === step ? 700 : 400 }}>
              {s}
            </span>
          </div>
        ))}
      </div>
    );
  };

  // === Step 0: Cart ===
  const CartStep = () => (
    <div>
      <h2 className="font-black text-right mb-3" style={{ fontSize: scr.mobile ? 16 : 22 }}>
        🛒 السلة ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="text-center py-10 text-dim">
          <div className="text-4xl mb-2">🛒</div>
          <div className="text-sm mb-3">السلة فاضية</div>
          <button onClick={() => router.push("/store")} className="btn-outline">تصفّح المنتجات</button>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div key={item.cartId} className="card flex justify-between items-center mb-2"
              style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}>
              <button onClick={() => cart.removeItem(item.cartId)}
                className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center">✕</button>
              <div className="flex-1 text-right mr-2">
                <div className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{lang === "he" ? (item.name_he || item.name) : item.name}</div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {item.brand} • {item.type === "device" ? "📱 جهاز" : "🔌 إكسسوار"}
                  {item.color && ` • ${lang === "he" ? (item.color_he || item.color) : item.color}`}
                  {item.storage && ` • ${item.storage}`}
                </div>
              </div>
              <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 16 }}>₪{item.price.toLocaleString()}</span>
            </div>
          ))}

          {/* Coupon */}
          <div className="flex gap-1.5 mt-3 mb-2">
            <button onClick={handleCoupon} className="px-4 py-2.5 rounded-xl border-none bg-state-purple text-white text-xs font-bold cursor-pointer flex-shrink-0">تطبيق</button>
            <input className={inp} placeholder="🏷️ كوبون خصم..." value={couponInput} onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCoupon()} />
          </div>
          {cart.discountAmount > 0 && (
            <div className="bg-state-success/10 rounded-[10px] p-2 mb-2 text-state-success text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              🎉 خصم: -₪{cart.discountAmount}
            </div>
          )}
          {hasInstallmentItems && (
            <div className="bg-state-info/10 rounded-xl p-2.5 mb-2 text-state-info text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              📋 سلتك تحتوي جهاز — يخضع لفحص الفريق + ستحتاج هوية وبيانات بنك
            </div>
          )}
          {onlyAccessories && (
            <div className="bg-state-success/10 rounded-xl p-2.5 mb-2 text-state-success text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              ⚡ إكسسوارات فقط — دفع مباشر بالبطاقة
            </div>
          )}

          {/* Total */}
          <div className="card mt-2" style={{ padding: scr.mobile ? 14 : 20 }}>
            <div className="flex justify-between mb-1"><span className="text-muted text-xs">₪{subtotal.toLocaleString()}</span><span className="text-muted text-xs">المنتجات</span></div>
            {cart.discountAmount > 0 && <div className="flex justify-between mb-1"><span className="text-state-success text-xs">-₪{cart.discountAmount}</span><span className="text-state-success text-xs">خصم</span></div>}
            <div className="flex justify-between mb-1"><span className="text-muted text-xs">مجاناً</span><span className="text-muted text-xs">التوصيل</span></div>
            <div className="border-t border-surface-border pt-2 flex justify-between">
              <span className="font-black text-state-success" style={{ fontSize: scr.mobile ? 20 : 26 }}>₪{total.toLocaleString()}</span>
              <span className="font-bold" style={{ fontSize: scr.mobile ? 14 : 16 }}>المجموع</span>
            </div>
            <button onClick={() => setStep(1)} className="btn-primary w-full mt-3">المتابعة للشراء →</button>
          </div>
        </>
      )}
    </div>
  );

  // === Step 1: Info ===
  const InfoStep = () => (
    <div>
      <h2 className="font-black text-right mb-3" style={{ fontSize: scr.mobile ? 16 : 20 }}>📝 معلوماتك</h2>
      <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="rounded-xl border border-brand/20 bg-brand/5 p-3 mb-3 text-right">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => void prefillFromSavedAccount()}
              disabled={prefillLoading}
              className="btn-outline flex-shrink-0 disabled:opacity-50"
              style={{ fontSize: scr.mobile ? 10 : 12, padding: scr.mobile ? "8px 12px" : "10px 14px" }}
            >
              {prefillLoading ? "⏳ جاري الاسترجاع..." : "🔐 أنا زبون سابق"}
            </button>
            <div>
              <div className="font-bold text-white text-xs desktop:text-sm">استرجاع بياناتك بعد OTP</div>
              <div className="text-muted mt-0.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                لن نعرض أي بيانات إلا بعد التحقق الأمني برسالة OTP.
              </div>
              {accountCustomerCode && (
                <div className="text-brand mt-1 font-bold" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  كودك: {accountCustomerCode}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 10 }}>
          <div className="flex-1"><Field label="الاسم الكامل *" error={errors.name} htmlFor="checkout-name"><input id="checkout-name" className={inp} value={info.name} onChange={(e) => setInfo({ ...info, name: e.target.value })} placeholder="محمد أحمد" /></Field></div>
          <div className="flex-1"><Field label="رقم الهاتف * (05XXXXXXXX)" error={errors.phone} htmlFor="checkout-phone"><input id="checkout-phone" className={inp} value={info.phone} onChange={(e) => setInfo({ ...info, phone: e.target.value.replace(/[^\d-]/g, "") })} placeholder="0541234567" dir="ltr" /></Field></div>
        </div>
        <Field label="📧 البريد الإلكتروني" error={errors.email} htmlFor="checkout-email"><input id="checkout-email" className={inp} type="email" value={info.email} onChange={(e) => setInfo({ ...info, email: e.target.value })} placeholder="email@example.com" dir="ltr" /></Field>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 10 }}>
          <div className="flex-1"><CityCombobox value={info.city} onChange={(v) => setInfo({ ...info, city: v })} error={errors.city} /></div>
          <div className="flex-1"><Field label="📍 العنوان بالتفصيل *" error={errors.address} htmlFor="checkout-address"><input id="checkout-address" className={inp} value={info.address} onChange={(e) => setInfo({ ...info, address: e.target.value })} placeholder="شارع + رقم بيت" /></Field></div>
        </div>
        {hasInstallmentItems && (
          <Field label="🪪 رقم الهوية * (תעודת זהות — 9 أرقام)" error={errors.idNumber} htmlFor="checkout-id">
            <input id="checkout-id" className={inp} value={info.idNumber} onChange={(e) => setInfo({ ...info, idNumber: e.target.value.replace(/\D/g, "").slice(0, 9) })} placeholder="XXXXXXXXX" maxLength={9} dir="ltr" />
          </Field>
        )}
        <Field label="📝 ملاحظات (اختياري)" htmlFor="checkout-notes">
          <textarea id="checkout-notes" className={`${inp} min-h-[60px] resize-y`} value={info.notes} onChange={(e) => setInfo({ ...info, notes: e.target.value })} placeholder="ملاحظات خاصة..." />
        </Field>
        <button onClick={() => validateInfo() && setStep(2)} className="btn-primary w-full mt-1">المتابعة للدفع →</button>
      </div>
    </div>
  );

  // === Step 2: Payment ===
  const PayStep = () => (
    <div>
      <h2 className="font-black text-right mb-3" style={{ fontSize: scr.mobile ? 16 : 20 }}>💳 الدفع</h2>
      <div className="card" style={{ padding: scr.mobile ? 14 : 20 }}>
        {/* Summary */}
        <div className="bg-surface-elevated rounded-xl p-2.5 mb-4">
          <div className="flex justify-between mb-1">
            <span className="font-black text-state-success" style={{ fontSize: scr.mobile ? 16 : 20 }}>₪{total.toLocaleString()}</span>
            <span className="font-bold" style={{ fontSize: scr.mobile ? 11 : 13 }}>المجموع</span>
          </div>
          <div className="text-muted text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>{items.length} منتج • التوصيل: {info.city}</div>
        </div>

        {hasInstallmentItems ? (
          <>
            {/* Devices + appliances → bank transfer only */}
            <div className="rounded-xl p-3 mb-3 text-right" style={{ background: "rgba(99,102,241,0.06)", border: "1px solid rgba(99,102,241,0.12)" }}>
              <div className="text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>📋 طلبات الأجهزة تخضع لفحص ومراجعة الفريق — الدفع عبر تحويل بنكي</div>
            </div>
            <ChoiceCombobox
              label="🏦 البنك *"
              error={errors.bank}
              value={pay.bank}
              onChange={(nextBank) => setPay({ ...pay, bank: nextBank })}
              placeholder="اختر البنك..."
              options={bankOptions}
            />
            <div className="flex gap-2.5">
              <div className="flex-1"><Field label="رقم الفرع (3) *" error={errors.branch} htmlFor="checkout-branch"><input id="checkout-branch" className={inp} value={pay.branch} onChange={(e) => setPay({ ...pay, branch: e.target.value.replace(/\D/g, "").slice(0, 3) })} maxLength={3} dir="ltr" /></Field></div>
              <div className="flex-1"><Field label="رقم الحساب (4-9) *" error={errors.account} htmlFor="checkout-account"><input id="checkout-account" className={inp} value={pay.account} onChange={(e) => setPay({ ...pay, account: e.target.value.replace(/\D/g, "").slice(0, 9) })} maxLength={9} dir="ltr" /></Field></div>
            </div>
            {/* Installments */}
            <ChoiceCombobox
              label="📅 عدد الدفعات"
              value={String(pay.installments)}
              onChange={(nextInstallments) => setPay({ ...pay, installments: Number(nextInstallments) })}
              placeholder="اختر عدد الدفعات"
              options={installmentOptions}
            />
            {pay.installments > 1 && (
              <div className="rounded-xl p-3 mb-2 text-right" style={{ background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.15)" }}>
                <div className="text-state-success font-bold mb-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                  💰 تقسيط بدون فوائد حتى 18 دفعة!
                </div>
                <div className="text-white font-black" style={{ fontSize: scr.mobile ? 16 : 20 }}>
                  ₪{Math.ceil(total / pay.installments).toLocaleString()} × {pay.installments} شهر
                </div>
                <div className="text-muted mt-1" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                  المبلغ الإجمالي: ₪{total.toLocaleString()} — بدون فوائد
                </div>
              </div>
            )}
          </>
        ) : (
          /* Accessories → Rivhit hosted payment page */
          <div className="rounded-xl p-4 text-right" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(6,182,212,0.06))", border: "1px solid rgba(34,197,94,0.15)" }}>
            <div className="text-lg mb-2">⚡</div>
            <div className="font-bold mb-1" style={{ fontSize: scr.mobile ? 12 : 14 }}>دفع مباشر — بوابة آمنة</div>
            <div className="text-muted mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              سيتم تحويلك لصفحة الدفع الآمنة عبر Rivhit لإتمام الشراء
            </div>
            <div className="flex items-center gap-2 text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              <span>💳 Visa</span>
              <span>💳 Mastercard</span>
              <span>💳 Isracard</span>
              <span>📱 Bit</span>
            </div>
            <div className="text-state-cyan mt-2" style={{ fontSize: scr.mobile ? 9 : 11 }}>
              ✓ تقسيط حتى 12 دفعة • ✓ PCI-DSS آمن • ✓ חשבונית מס تلقائية
            </div>
          </div>
        )}

        <button
          onClick={() => validatePay() && submitOrder()}
          disabled={loading}
          className={`btn-primary w-full mt-2 disabled:opacity-50 ${loading ? "animate-pulse cursor-not-allowed" : ""}`}
          style={{ fontSize: scr.mobile ? 14 : 16, padding: "14px 20px" }}
        >
          {loading ? "⏳ جاري المعالجة..." : hasInstallmentItems
            ? `📋 تأكيد الطلب — ₪${total.toLocaleString()}`
            : `🔒 متابعة للدفع الآمن — ₪${total.toLocaleString()}`}
        </button>
      </div>
    </div>
  );

  // === Step 3: Confirmation ===
  const ConfirmStep = () => (
    <div className="text-center">
      <div className="rounded-2xl p-6 desktop:p-10 mb-4" style={{ background: "linear-gradient(135deg, rgba(34,197,94,0.1), rgba(6,182,212,0.06))", border: "1px solid rgba(34,197,94,0.15)" }}>
        <div className="text-5xl mb-2">✅</div>
        <div className="font-black text-state-success mb-1" style={{ fontSize: scr.mobile ? 20 : 28 }}>تم إرسال الطلب!</div>
        <div className="font-black text-brand mb-2" style={{ fontSize: scr.mobile ? 28 : 40 }}>{order?.id}</div>
        {order?.customerCode && (
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-4 py-2 text-brand font-bold" style={{ fontSize: scr.mobile ? 11 : 13 }}>
            <span>🎖️</span>
            <span>{order.customerCode}</span>
            {order.isNewCustomer && <span className="text-white/70">كودك الجديد</span>}
          </div>
        )}
        <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 14 }}>
          {order?.hasDevice
            ? "📋 طلبك قيد المراجعة — الفريق سيتواصل معك خلال يوم عمل"
            : "✅ تم تأكيد الطلب — قيد التجهيز للشحن"}
        </div>
      </div>

      <div className="card text-right mb-3" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="font-bold mb-2" style={{ fontSize: scr.mobile ? 12 : 14 }}>📦 تفاصيل الطلب</div>
        {order?.items.map((it, idx) => (
          <div key={`item-${idx}`} className="flex justify-between py-1.5 border-b border-surface-border">
            <span className="text-brand" style={{ fontSize: scr.mobile ? 11 : 13 }}>₪{it.price}</span>
            <span style={{ fontSize: scr.mobile ? 11 : 13 }}>{lang === "he" ? (it.name_he || it.name) : it.name}</span>
          </div>
        ))}
        <div className="flex justify-between pt-2 mt-1">
          <span className="font-black text-state-success" style={{ fontSize: scr.mobile ? 16 : 20 }}>₪{order?.total.toLocaleString()}</span>
          <span className="font-bold">المجموع</span>
        </div>
        {order?.hasDevice && (
          <div className="border-t border-surface-border pt-2 mt-2">
            <div className="flex justify-between text-muted text-xs">
              <span>{order.bankName}</span>
              <span>🏦 طريقة الدفع: حوالة بنكية</span>
            </div>
            {order.installments > 1 && (
              <div className="flex justify-between mt-1">
                <span className="text-state-success font-bold" style={{ fontSize: scr.mobile ? 13 : 15 }}>
                  ₪{order.monthlyAmount.toLocaleString()} × {order.installments} شهر
                </span>
                <span className="text-muted text-xs">📅 تقسيط</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="card text-right mb-3" style={{ padding: scr.mobile ? 14 : 20 }}>
        <div className="font-bold mb-1.5" style={{ fontSize: scr.mobile ? 12 : 14 }}>📍 التوصيل</div>
        <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>{order?.customer} • {order?.phone}</div>
        <div className="text-muted" style={{ fontSize: scr.mobile ? 11 : 13 }}>{order?.city} — {order?.address}</div>
        <div className="text-dim mt-1" style={{ fontSize: scr.mobile ? 10 : 12 }}>🚚 التوصيل: الأحد - الخميس (1-2 يوم عمل)</div>
      </div>

      {order?.notes && (
        <div className="card text-right mb-3 p-2.5 text-muted" style={{ fontSize: scr.mobile ? 10 : 12 }}>
          📝 ملاحظاتك: {order.notes}
        </div>
      )}

      <button onClick={() => router.push("/store")} className="btn-primary w-full">🛒 متابعة التسوّق</button>
    </div>
  );

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <div className="mx-auto" style={{ maxWidth: scr.mobile ? "100%" : 700, padding: scr.mobile ? "12px 14px 30px" : "20px 28px 40px" }}>
        {StepBar()}
        {step === 0 && CartStep()}
        {step === 1 && InfoStep()}
        {step === 2 && PayStep()}
        {step === 3 && ConfirmStep()}
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
