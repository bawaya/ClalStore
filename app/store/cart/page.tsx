"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreHeader } from "@/components/store/StoreHeader";
import { Footer } from "@/components/website/sections";
import { BANKS } from "@/lib/constants";
import { csrfHeaders } from "@/lib/csrf-client";
import { useScreen, useToast } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { CITY_SEARCH_MIN_LENGTH, searchCities, type City } from "@/lib/cities";
import {
  validateAccount,
  validateBranch,
  validateEmail,
  validateIsraeliID,
  validatePhone,
} from "@/lib/validators";

interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  idNumber: string;
  notes: string;
}

interface PaymentInfo {
  method: "bank" | "credit";
  bank: string;
  branch: string;
  account: string;
  installments: number;
}

interface OrderResult {
  id: string;
  total: number;
  items: { name: string; name_he?: string; price: number }[];
  city: string;
  address: string;
  customer: string;
  phone: string;
  notes: string;
  hasDevice: boolean;
  date: string;
  installments: number;
  monthlyAmount: number;
  bankName: string;
  customerCode?: string;
  isNewCustomer?: boolean;
}

interface ChoiceOption {
  value: string;
  label: string;
  subtitle?: string;
}

const lbl = "mb-1.5 block text-[11px] font-semibold text-[#9d9daa] desktop:text-xs";
const errS = "mt-1 text-[11px] text-[#ff6d86]";
const controlS =
  "input w-full rounded-2xl border border-[#4a4a54] bg-white/[0.03] px-4 py-3 text-sm text-white placeholder:text-[#8f8f99]";
const checkoutPanelS =
  "rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.24)]";
const checkoutSoftPanelS =
  "rounded-[24px] border border-[#2c2c35] bg-white/[0.03]";

function Field({
  label,
  error,
  children,
  htmlFor,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
  htmlFor?: string;
}) {
  return (
    <div className="mb-3">
      <label className={lbl} htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error && <div className={errS}>{error}</div>}
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
  onChange: (value: string) => void;
  error?: string;
  placeholder: string;
  options: ChoiceOption[];
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((option) => option.value === value);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <Field label={label} error={error}>
      <div ref={ref} className="relative">
        <button
          type="button"
          onClick={() => setOpen((current) => !current)}
          className={`${controlS} flex items-center justify-between gap-3 text-right`}
        >
          <span className={`truncate ${selected ? "text-white" : "text-[#8f8f99]"}`}>
            {selected ? selected.label : placeholder}
          </span>
          <span
            className={`text-xs text-[#8f8f99] transition-transform ${
              open ? "rotate-180" : ""
            }`}
          >
            ⌄
          </span>
        </button>

        {open && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[22px] border border-[#31313a] bg-[#17171b] shadow-[0_24px_50px_rgba(0,0,0,0.36)]">
            <div className="max-h-60 overflow-y-auto py-1" style={{ scrollbarWidth: "thin" }}>
              {options.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full border-0 px-4 py-3 text-right transition-colors hover:bg-[#ff3351]/10 ${
                    option.value === value
                      ? "bg-[#ff3351]/12 text-[#ff8da0]"
                      : "bg-transparent text-white"
                  }`}
                >
                  <div className="text-sm font-medium leading-tight">{option.label}</div>
                  {option.subtitle && (
                    <div className="mt-1 text-[11px] text-[#8f8f99]">
                      {option.subtitle}
                    </div>
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

function CityCombobox({
  value,
  onChange,
  error,
}: {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const trimmedQuery = query.trim();
  const results = searchCities(trimmedQuery);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const selectCity = (city: City) => {
    onChange(city.ar);
    setQuery(city.ar);
    setOpen(false);
  };

  return (
    <Field label="المدينة *" error={error}>
      <div ref={ref} className="relative">
        <input
          className={`${controlS} font-arabic`}
          placeholder={`اكتب ${CITY_SEARCH_MIN_LENGTH} أحرف على الأقل...`}
          value={query}
          onChange={(event) => {
            const nextValue = event.target.value;
            setQuery(nextValue);
            onChange("");
            setOpen(nextValue.trim().length >= CITY_SEARCH_MIN_LENGTH);
          }}
          onFocus={() => setOpen(trimmedQuery.length >= CITY_SEARCH_MIN_LENGTH)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && results.length === 1) {
              event.preventDefault();
              selectCity(results[0]);
            }
          }}
          autoComplete="off"
        />

        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              onChange("");
              setOpen(false);
            }}
            className="absolute left-3 top-1/2 -translate-y-1/2 border-0 bg-transparent p-0 text-xs text-[#8f8f99]"
            aria-label="مسح البحث"
          >
            ×
          </button>
        )}

        {trimmedQuery.length > 0 && trimmedQuery.length < CITY_SEARCH_MIN_LENGTH && (
          <div className="absolute z-50 mt-2 w-full rounded-[22px] border border-[#31313a] bg-[#17171b] p-3 text-center text-xs text-[#b8b8c2] shadow-[0_24px_50px_rgba(0,0,0,0.36)]">
            اكتب {CITY_SEARCH_MIN_LENGTH} أحرف على الأقل ليظهر البحث الذكي
          </div>
        )}

        {open && results.length > 0 && (
          <div
            className="absolute z-50 mt-2 max-h-56 w-full overflow-y-auto rounded-[22px] border border-[#31313a] bg-[#17171b] shadow-[0_24px_50px_rgba(0,0,0,0.36)]"
            style={{ scrollbarWidth: "thin" }}
          >
            {results.map((city) => (
              <button
                key={`${city.ar}-${city.he}`}
                type="button"
                onClick={() => selectCity(city)}
                className={`w-full border-0 px-4 py-3 text-right transition-colors hover:bg-[#ff3351]/10 ${
                  value === city.ar
                    ? "bg-[#ff3351]/12 text-[#ff8da0]"
                    : "bg-transparent text-white"
                }`}
              >
                <div className="text-sm font-medium leading-tight">{city.ar}</div>
                <div className="mt-1 text-[11px] text-[#8f8f99]">{city.he}</div>
              </button>
            ))}
          </div>
        )}

        {trimmedQuery.length >= CITY_SEARCH_MIN_LENGTH && open && results.length === 0 && (
          <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-[22px] border border-[#31313a] bg-[#17171b] shadow-[0_24px_50px_rgba(0,0,0,0.36)]">
            <button
              type="button"
              onClick={() => {
                onChange(trimmedQuery);
                setQuery(trimmedQuery);
                setOpen(false);
              }}
              className="w-full border-0 bg-transparent px-4 py-3 text-right text-white transition-colors hover:bg-[#ff3351]/10"
            >
              <div className="text-sm font-medium">استخدم النص كما أدخلته</div>
              <div className="mt-1 text-[11px] text-[#8f8f99]">{trimmedQuery}</div>
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
  const hasInstallmentItems = cart.hasInstallmentItems();
  const onlyAccessories = cart.hasOnlyAccessories();

  const [step, setStep] = useState(0);
  const [info, setInfo] = useState<CustomerInfo>({
    name: "",
    phone: "",
    email: "",
    city: "",
    address: "",
    idNumber: "",
    notes: "",
  });
  const [pay, setPay] = useState<PaymentInfo>({
    method: "bank",
    bank: "",
    branch: "",
    account: "",
    installments: 1,
  });
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
  }));

  const installmentOptions: ChoiceOption[] = [1, 2, 3, 6, 9, 12, 15, 18].map((value) => ({
    value: String(value),
    label: value === 1 ? "دفعة واحدة (تحويل بنكي)" : `${value} دفعات`,
    subtitle: value === 1 ? "بدون تقسيط" : `تقسيط على ${value} أشهر`,
  }));

  const checkoutSteps = [
    { label: "السلة", caption: "مراجعة المنتجات" },
    { label: "البيانات", caption: "تفاصيل العميل" },
    { label: "الدفع", caption: "طريقة السداد" },
    { label: "التأكيد", caption: "إرسال الطلب" },
  ];
  const currentStep = checkoutSteps[step] ?? checkoutSteps[0];

  const prefillFromSavedAccount = useCallback(
    async (showToast = true) => {
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
        const confirmed = window.confirm(
          "سيتم استبدال البيانات الحالية ببيانات حسابك المحفوظة. هل تريد المتابعة؟"
        );
        if (!confirmed) return;
      }

      setPrefillLoading(true);
      try {
        const response = await fetch("/api/customer/profile", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const json = await response.json();
        const data = json.data ?? json;

        if (!json.success || !data.customer) {
          throw new Error(json.error || data.error || "تعذر جلب بيانات الحساب");
        }

        const customer = data.customer;
        localStorage.setItem("clal_customer", JSON.stringify(customer));
        setAccountCustomerCode(customer.customer_code || "");
        setInfo((current) => ({
          ...current,
          name: customer.name || "",
          phone: customer.phone || current.phone,
          email: customer.email || "",
          city: customer.city || "",
          address: customer.address || "",
        }));

        if (showToast) {
          show(
            `تم استرجاع بياناتك${customer.customer_code ? ` — الكود: ${customer.customer_code}` : ""}`,
            "success"
          );
        }
      } catch (error) {
        show(error instanceof Error ? error.message : "تعذر استرجاع البيانات", "error");
      } finally {
        setPrefillLoading(false);
      }
    },
    [info.address, info.city, info.email, info.idNumber, info.name, info.phone, router, show]
  );

  useEffect(() => {
    const shouldPrefill = sessionStorage.getItem("clal_prefill_cart_after_auth") === "1";
    if (!shouldPrefill) return;

    sessionStorage.removeItem("clal_prefill_cart_after_auth");
    void prefillFromSavedAccount(false);
  }, [prefillFromSavedAccount]);

  const handleCoupon = async () => {
    if (!couponInput.trim()) return;

    try {
      const response = await fetch("/api/coupons/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponInput, total: subtotal }),
      });
      const json = await response.json();
      const data = json.data ?? json;

      if (data.valid) {
        cart.applyCoupon(couponInput.toUpperCase(), data.discount);
        show(data.message, "success");
      } else {
        show(data.message, "error");
      }
    } catch {
      show("خطأ في التحقق من الكوبون", "error");
    }
  };

  const validateInfo = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (!info.name.trim()) nextErrors.name = "الاسم مطلوب";
    if (!validatePhone(info.phone)) nextErrors.phone = "رقم غير صالح";
    if (info.email && !validateEmail(info.email)) nextErrors.email = "بريد غير صالح";
    if (!info.city) nextErrors.city = "اختر مدينة";
    if (!info.address.trim()) nextErrors.address = "العنوان مطلوب";
    if (hasInstallmentItems && !validateIsraeliID(info.idNumber)) {
      nextErrors.idNumber = "هوية غير صالحة";
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validatePay = (): boolean => {
    const nextErrors: Record<string, string> = {};

    if (hasInstallmentItems) {
      if (!pay.bank) nextErrors.bank = "اختر بنكًا";
      if (!validateBranch(pay.branch)) nextErrors.branch = "الفرع يجب أن يكون 3 أرقام";
      if (!validateAccount(pay.account)) {
        nextErrors.account = "رقم الحساب يجب أن يكون بين 4 و9 أرقام";
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const submitOrder = async () => {
    setLoading(true);

    try {
      const monthlyAmount =
        pay.installments > 1 ? Math.ceil(total / pay.installments) : total;
      const paymentData = hasInstallmentItems
        ? {
            type: "bank",
            bank: pay.bank,
            branch: pay.branch,
            account: pay.account,
            installments: pay.installments,
            monthly_amount: monthlyAmount,
          }
        : { type: "credit" };

      const orderResponse = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer: info,
          items: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            brand: item.brand,
            type: item.type,
            price: item.price,
            quantity: item.quantity,
            color: item.color,
            storage: item.storage,
          })),
          payment: paymentData,
          couponCode: cart.couponCode || undefined,
          discountAmount: cart.discountAmount,
          source: "store",
        }),
      });

      const orderJson = await orderResponse.json();
      const orderData = orderJson.data ?? orderJson;

      if (!orderJson.success) {
        show(orderJson.error || orderData.error || "خطأ في إرسال الطلب", "error");
        return;
      }

      if (orderData.needsPayment) {
        show("جارٍ تحويلك إلى صفحة الدفع الآمنة...", "success");

        const paymentResponse = await fetch("/api/payment", {
          method: "POST",
          headers: csrfHeaders(),
          body: JSON.stringify({
            orderId: orderData.orderId,
            amount: orderData.total,
            customerName: info.name,
            customerPhone: info.phone,
            customerEmail: info.email || undefined,
            customerCity: info.city,
            customerAddress: info.address,
            idNumber: info.idNumber || undefined,
            items: items.map((item) => ({
              name: item.name,
              price: item.price,
              quantity: item.quantity || 1,
            })),
            maxInstallments: 12,
          }),
        });

        const paymentJson = await paymentResponse.json();
        const paymentDataResult = paymentJson.data ?? paymentJson;

        if (paymentJson.success && paymentDataResult.paymentUrl) {
          try {
            sessionStorage.setItem("clal_pending_order", String(orderData.orderId));
          } catch {}
          window.location.href = paymentDataResult.paymentUrl;
          return;
        }

        show(
          paymentJson.error || paymentDataResult.error || "خطأ في بوابة الدفع",
          "error"
        );
        return;
      }

      const selectedBank = BANKS.find((bank) => bank.id === pay.bank);
      setOrder({
        id: orderData.orderId,
        total,
        items: items.map((item) => ({
          name: item.name,
          name_he: item.name_he,
          price: item.price,
        })),
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
        customerCode: orderData.customerCode,
        isNewCustomer: !!orderData.isNewCustomer,
      });
      setStep(3);
      cart.clearCart();
    } catch {
      show("خطأ في الاتصال", "error");
    } finally {
      setLoading(false);
    }
  };

  const StepBar = () => (
    <div className={`${checkoutPanelS} mb-4 overflow-hidden`}>
      <div className="grid gap-4 border-b border-[#24242d] px-5 py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:px-6">
        <div className="text-right">
          <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
            إتمام الطلب
          </span>
          <h1 className="mt-3 text-2xl font-black text-white md:text-[2rem]">
            {currentStep.label}
          </h1>
          <p className="mt-2 text-sm leading-7 text-[#b8b8c2]">{currentStep.caption}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3 md:min-w-[320px]">
          <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
            <strong className="block text-xl font-black text-white">{items.length}</strong>
            <span className="text-sm text-[#b8b8c2]">منتجات في السلة</span>
          </div>
          <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
            <strong className="block text-xl font-black text-white">
              ₪{total.toLocaleString()}
            </strong>
            <span className="text-sm text-[#b8b8c2]">إجمالي الطلب</span>
          </div>
          <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
            <strong className="block text-xl font-black text-white">{step + 1}/4</strong>
            <span className="text-sm text-[#b8b8c2]">المرحلة الحالية</span>
          </div>
        </div>
      </div>

      <div className="grid gap-3 px-5 py-4 md:grid-cols-4 md:px-6">
        {checkoutSteps.map((item, index) => (
          <div
            key={item.label}
            className={`rounded-[22px] border px-4 py-4 text-right transition-colors ${
              index === step
                ? "border-[#ff3351]/45 bg-[#ff3351]/10"
                : index < step
                  ? "border-[#1f6d47] bg-[#0d2419]"
                  : "border-[#2f2f38] bg-white/[0.02]"
            }`}
          >
            <div
              className={`text-xs font-semibold ${
                index === step
                  ? "text-[#ff8da0]"
                  : index < step
                    ? "text-[#8ce2ae]"
                    : "text-[#8f8f99]"
              }`}
            >
              {`0${index + 1}`.slice(-2)}
            </div>
            <div className="mt-2 text-sm font-black text-white">{item.label}</div>
            <div className="mt-1 text-xs leading-6 text-[#b8b8c2]">{item.caption}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const CartStep = () => (
    <div className="space-y-4">
      <div className={`${checkoutPanelS} px-5 py-5 text-right md:px-6 md:py-6`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-black text-white md:text-2xl">
              السلة ({items.length})
            </h2>
            <p className="mt-2 text-sm leading-7 text-[#b8b8c2]">
              راجع المنتجات قبل الانتقال إلى معلومات العميل والدفع.
            </p>
          </div>
          <div className="rounded-full border border-[#30303a] bg-white/[0.03] px-4 py-2 text-sm font-semibold text-[#d6d6dd]">
            تجهيز احترافي وواضح
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={`${checkoutPanelS} px-5 py-12 text-center md:px-6`}>
          <div className="text-4xl">🛒</div>
          <div className="mt-4 text-lg font-bold text-white">السلة فارغة</div>
          <div className="mt-2 text-sm text-[#b8b8c2]">
            أضف منتجات أولًا حتى نبدأ مسار الطلب.
          </div>
          <button
            type="button"
            onClick={() => router.push("/store")}
            className="mt-5 inline-flex min-h-[50px] items-center justify-center rounded-full border border-[#ff0e34] px-6 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
          >
            العودة إلى المتجر
          </button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {items.map((item) => (
              <div
                key={item.cartId}
                className={`${checkoutPanelS} flex items-center justify-between gap-3 px-4 py-4 md:px-5`}
              >
                <button
                  type="button"
                  onClick={() => cart.removeItem(item.cartId)}
                  className="flex h-10 w-10 items-center justify-center rounded-2xl border border-[#6a2232] bg-[#2a1016] text-sm font-bold text-[#ff6d86]"
                >
                  ×
                </button>

                <div className="flex-1 text-right">
                  <div className="text-sm font-black text-white md:text-base">
                    {lang === "he" ? item.name_he || item.name : item.name}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-[#9d9daa] md:text-sm">
                    {item.brand}
                    {item.type === "device" ? " • جهاز" : " • إكسسوار"}
                    {item.color &&
                      ` • ${lang === "he" ? item.color_he || item.color : item.color}`}
                    {item.storage && ` • ${item.storage}`}
                  </div>
                </div>

                <span className="text-lg font-black text-[#ff3351] md:text-xl">
                  ₪{item.price.toLocaleString()}
                </span>
              </div>
            ))}
          </div>

          <div className={`${checkoutPanelS} px-5 py-5 md:px-6`}>
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_150px]">
              <input
                className={controlS}
                placeholder="كوبون خصم..."
                value={couponInput}
                onChange={(event) => setCouponInput(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && void handleCoupon()}
              />
              <button
                type="button"
                onClick={() => void handleCoupon()}
                className="min-h-[52px] rounded-full border border-[#ff0e34] px-5 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
              >
                تطبيق الكوبون
              </button>
            </div>

            {cart.discountAmount > 0 && (
              <div className="mt-3 rounded-[22px] border border-[#1f6d47] bg-[#0d2419] px-4 py-3 text-right text-sm font-semibold text-[#8ce2ae]">
                تم تطبيق خصم بقيمة ₪{cart.discountAmount.toLocaleString()}
              </div>
            )}

            {hasInstallmentItems && (
              <div className="mt-3 rounded-[22px] border border-[#274163] bg-[#101b2a] px-4 py-3 text-right text-sm leading-7 text-[#8fc7ff]">
                السلة تحتوي أجهزة تحتاج مراجعة من الفريق، لذلك سنطلب الهوية وبيانات
                الحساب البنكي قبل تأكيد الطلب.
              </div>
            )}

            {onlyAccessories && (
              <div className="mt-3 rounded-[22px] border border-[#1f6d47] bg-[#0d2419] px-4 py-3 text-right text-sm leading-7 text-[#8ce2ae]">
                السلة تحتوي إكسسوارات فقط، وسيتم تحويلك مباشرة إلى الدفع الآمن
                بالبطاقة.
              </div>
            )}
          </div>

          <div className={`${checkoutPanelS} px-5 py-5 md:px-6`}>
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm text-[#b8b8c2]">
                <span>₪{subtotal.toLocaleString()}</span>
                <span>قيمة المنتجات</span>
              </div>

              {cart.discountAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-[#8ce2ae]">
                  <span>-₪{cart.discountAmount.toLocaleString()}</span>
                  <span>الخصم</span>
                </div>
              )}

              <div className="flex items-center justify-between text-sm text-[#b8b8c2]">
                <span>مجاني</span>
                <span>التوصيل</span>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-[#2d2d35] pt-4">
              <span className="text-2xl font-black text-white md:text-[2rem]">
                ₪{total.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-[#d9d9df] md:text-base">المجموع</span>
            </div>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-5 inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#e20d30]"
            >
              متابعة معلومات العميل
            </button>
          </div>
        </>
      )}
    </div>
  );

  const InfoStep = () => (
    <div className="space-y-4">
      <div className={`${checkoutPanelS} px-5 py-5 text-right md:px-6 md:py-6`}>
        <h2 className="text-xl font-black text-white md:text-2xl">معلومات العميل</h2>
        <p className="mt-2 text-sm leading-7 text-[#b8b8c2]">
          أدخل معلومات الطلب والتوصيل بدقة حتى نكمل المعالجة بسرعة.
        </p>
      </div>

      <div className={`${checkoutPanelS} px-5 py-5 md:px-6 md:py-6`}>
        <div className="mb-4 rounded-[24px] border border-[#ff3351]/20 bg-[#ff3351]/08 px-4 py-4 text-right">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-sm font-bold text-white">
                استرجاع بياناتك عبر التحقق الآمن
              </div>
              <div className="mt-1 text-xs leading-6 text-[#b8b8c2]">
                إذا كنت عميلًا سابقًا يمكننا استدعاء بياناتك المحفوظة بعد التحقق.
              </div>
              {accountCustomerCode && (
                <div className="mt-2 text-xs font-bold text-[#ff8da0]">
                  كود العميل: {accountCustomerCode}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void prefillFromSavedAccount()}
              disabled={prefillLoading}
              className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#ff0e34] px-5 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {prefillLoading ? "جارٍ الاسترجاع..." : "أنا عميل سابق"}
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <Field label="الاسم الكامل *" error={errors.name} htmlFor="checkout-name">
            <input
              id="checkout-name"
              className={controlS}
              value={info.name}
              onChange={(event) => setInfo({ ...info, name: event.target.value })}
              placeholder="محمد أحمد"
            />
          </Field>

          <Field
            label="رقم الهاتف *"
            error={errors.phone}
            htmlFor="checkout-phone"
          >
            <input
              id="checkout-phone"
              className={controlS}
              value={info.phone}
              onChange={(event) =>
                setInfo({ ...info, phone: event.target.value.replace(/[^\d-]/g, "") })
              }
              placeholder="0541234567"
              dir="ltr"
            />
          </Field>
        </div>

        <Field label="البريد الإلكتروني" error={errors.email} htmlFor="checkout-email">
          <input
            id="checkout-email"
            className={controlS}
            type="email"
            value={info.email}
            onChange={(event) => setInfo({ ...info, email: event.target.value })}
            placeholder="email@example.com"
            dir="ltr"
          />
        </Field>

        <div className="grid gap-3 md:grid-cols-2">
          <CityCombobox
            value={info.city}
            onChange={(value) => setInfo({ ...info, city: value })}
            error={errors.city}
          />

          <Field label="العنوان بالتفصيل *" error={errors.address} htmlFor="checkout-address">
            <input
              id="checkout-address"
              className={controlS}
              value={info.address}
              onChange={(event) => setInfo({ ...info, address: event.target.value })}
              placeholder="الشارع + رقم البيت"
            />
          </Field>
        </div>

        {hasInstallmentItems && (
          <Field label="رقم الهوية *" error={errors.idNumber} htmlFor="checkout-id">
            <input
              id="checkout-id"
              className={controlS}
              value={info.idNumber}
              onChange={(event) =>
                setInfo({
                  ...info,
                  idNumber: event.target.value.replace(/\D/g, "").slice(0, 9),
                })
              }
              placeholder="XXXXXXXXX"
              maxLength={9}
              dir="ltr"
            />
          </Field>
        )}

        <Field label="ملاحظات إضافية" htmlFor="checkout-notes">
          <textarea
            id="checkout-notes"
            className={`${controlS} min-h-[96px] resize-y`}
            value={info.notes}
            onChange={(event) => setInfo({ ...info, notes: event.target.value })}
            placeholder="أي ملاحظات تريد إضافتها..."
          />
        </Field>

        <button
          type="button"
          onClick={() => validateInfo() && setStep(2)}
          className="mt-2 inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#e20d30]"
        >
          متابعة إلى الدفع
        </button>
      </div>
    </div>
  );

  const PayStep = () => (
    <div className="space-y-4">
      <div className={`${checkoutPanelS} px-5 py-5 text-right md:px-6 md:py-6`}>
        <h2 className="text-xl font-black text-white md:text-2xl">الدفع</h2>
        <p className="mt-2 text-sm leading-7 text-[#b8b8c2]">
          راجع المبلغ النهائي وحدد مسار السداد المناسب قبل إرسال الطلب.
        </p>
      </div>

      <div className={`${checkoutPanelS} px-5 py-5 md:px-6 md:py-6`}>
        <div className={`${checkoutSoftPanelS} mb-4 px-4 py-4`}>
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black text-white md:text-[2rem]">
              ₪{total.toLocaleString()}
            </span>
            <span className="text-sm font-bold text-[#d9d9df] md:text-base">المجموع</span>
          </div>
          <div className="mt-2 text-sm text-[#9d9daa]">
            {items.length} منتج • التوصيل إلى {info.city || "المدينة المحددة"}
          </div>
        </div>

        {hasInstallmentItems ? (
          <>
            <div className="mb-4 rounded-[22px] border border-[#274163] bg-[#101b2a] px-4 py-4 text-right">
              <div className="text-sm font-bold text-white">مسار الأجهزة والأقساط</div>
              <div className="mt-2 text-sm leading-7 text-[#8fc7ff]">
                هذا الطلب يحتاج مراجعة من الفريق، لذلك يتم اعتماد التحويل البنكي وخطة
                الأقساط من نفس الصفحة.
              </div>
            </div>

            <ChoiceCombobox
              label="البنك *"
              error={errors.bank}
              value={pay.bank}
              onChange={(value) => setPay({ ...pay, bank: value })}
              placeholder="اختر البنك..."
              options={bankOptions}
            />

            <div className="grid gap-3 md:grid-cols-2">
              <Field
                label="رقم الفرع *"
                error={errors.branch}
                htmlFor="checkout-branch"
              >
                <input
                  id="checkout-branch"
                  className={controlS}
                  value={pay.branch}
                  onChange={(event) =>
                    setPay({
                      ...pay,
                      branch: event.target.value.replace(/\D/g, "").slice(0, 3),
                    })
                  }
                  maxLength={3}
                  dir="ltr"
                />
              </Field>

              <Field
                label="رقم الحساب *"
                error={errors.account}
                htmlFor="checkout-account"
              >
                <input
                  id="checkout-account"
                  className={controlS}
                  value={pay.account}
                  onChange={(event) =>
                    setPay({
                      ...pay,
                      account: event.target.value.replace(/\D/g, "").slice(0, 9),
                    })
                  }
                  maxLength={9}
                  dir="ltr"
                />
              </Field>
            </div>

            <ChoiceCombobox
              label="عدد الدفعات"
              value={String(pay.installments)}
              onChange={(value) => setPay({ ...pay, installments: Number(value) })}
              placeholder="اختر عدد الدفعات"
              options={installmentOptions}
            />

            {pay.installments > 1 && (
              <div className="mt-2 rounded-[22px] border border-[#1f6d47] bg-[#0d2419] px-4 py-4 text-right">
                <div className="text-sm font-bold text-[#8ce2ae]">
                  تقسيط من دون فوائد
                </div>
                <div className="mt-2 text-2xl font-black text-white">
                  ₪{Math.ceil(total / pay.installments).toLocaleString()} × {pay.installments}
                </div>
                <div className="mt-2 text-sm text-[#b8b8c2]">
                  إجمالي الطلب: ₪{total.toLocaleString()}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="rounded-[24px] border border-[#1f6d47] bg-[linear-gradient(135deg,#0d2419,#0f1d27)] px-5 py-5 text-right">
            <div className="text-sm font-bold text-white">بوابة دفع آمنة</div>
            <div className="mt-2 text-sm leading-7 text-[#b8b8c2]">
              سيتم تحويلك إلى صفحة دفع آمنة لإتمام شراء الإكسسوارات مباشرة بالبطاقة.
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[#8ce2ae]">
              <span className="rounded-full border border-[#24563c] px-3 py-1">Visa</span>
              <span className="rounded-full border border-[#24563c] px-3 py-1">
                Mastercard
              </span>
              <span className="rounded-full border border-[#24563c] px-3 py-1">
                Isracard
              </span>
              <span className="rounded-full border border-[#24563c] px-3 py-1">Bit</span>
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={() => validatePay() && void submitOrder()}
          disabled={loading}
          className={`mt-5 inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#e20d30] disabled:cursor-not-allowed disabled:opacity-60 ${
            loading ? "animate-pulse" : ""
          }`}
        >
          {loading
            ? "جارٍ إرسال الطلب..."
            : hasInstallmentItems
              ? `تأكيد الطلب — ₪${total.toLocaleString()}`
              : `متابعة إلى الدفع الآمن — ₪${total.toLocaleString()}`}
        </button>
      </div>
    </div>
  );

  const ConfirmStep = () => (
    <div className="space-y-4">
      <div className="rounded-[30px] border border-[#1f6d47] bg-[linear-gradient(135deg,#0d2419,#101c24)] px-5 py-8 text-center shadow-[0_24px_48px_rgba(0,0,0,0.24)] md:px-6 md:py-10">
        <div className="text-5xl">✓</div>
        <div className="mt-4 text-2xl font-black text-white md:text-[2.2rem]">
          تم إرسال الطلب
        </div>
        <div className="mt-2 text-3xl font-black text-[#ff3351] md:text-[2.8rem]">
          {order?.id}
        </div>
        {order?.customerCode && (
          <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-4 py-2 text-sm font-bold text-[#ff8da0]">
            <span>{order.customerCode}</span>
            {order.isNewCustomer && <span className="text-white/70">كودك الجديد</span>}
          </div>
        )}
        <div className="mt-3 text-sm leading-7 text-[#c5d7cc]">
          {order?.hasDevice
            ? "طلبك قيد المراجعة، وسيتواصل معك الفريق خلال يوم عمل."
            : "تم تأكيد الطلب، ويجري الآن التحضير للشحن."}
        </div>
      </div>

      <div className={`${checkoutPanelS} px-5 py-5 text-right md:px-6`}>
        <div className="mb-3 text-sm font-bold text-white">تفاصيل الطلب</div>
        <div className="space-y-3">
          {order?.items.map((item, index) => (
            <div
              key={`order-item-${index}`}
              className="flex items-center justify-between rounded-[22px] border border-[#2d2d35] bg-white/[0.02] px-4 py-3"
            >
              <span className="text-sm font-black text-[#ff3351]">₪{item.price}</span>
              <span className="text-sm text-white">
                {lang === "he" ? item.name_he || item.name : item.name}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-[#2d2d35] pt-4">
          <span className="text-2xl font-black text-white">₪{order?.total.toLocaleString()}</span>
          <span className="text-sm font-bold text-[#d9d9df]">المجموع</span>
        </div>

        {order?.hasDevice && (
          <div className="mt-4 rounded-[22px] border border-[#2d2d35] bg-white/[0.02] px-4 py-4">
            <div className="flex items-center justify-between text-sm text-[#b8b8c2]">
              <span>{order.bankName}</span>
              <span>طريقة الدفع: حوالة بنكية</span>
            </div>
            {order.installments > 1 && (
              <div className="mt-3 flex items-center justify-between">
                <span className="text-lg font-black text-[#8ce2ae]">
                  ₪{order.monthlyAmount.toLocaleString()} × {order.installments}
                </span>
                <span className="text-sm text-[#b8b8c2]">خطة الأقساط</span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className={`${checkoutPanelS} px-5 py-5 text-right md:px-6`}>
        <div className="mb-3 text-sm font-bold text-white">عنوان التوصيل</div>
        <div className="space-y-2 text-sm leading-7 text-[#b8b8c2]">
          <div>
            {order?.customer} • {order?.phone}
          </div>
          <div>
            {order?.city} — {order?.address}
          </div>
          <div className="text-[#8f8f99]">التوصيل: الأحد - الخميس (1-2 يوم عمل)</div>
        </div>
      </div>

      {order?.notes && (
        <div className={`${checkoutPanelS} px-5 py-5 text-right text-sm leading-7 text-[#b8b8c2] md:px-6`}>
          <div className="mb-2 text-sm font-bold text-white">ملاحظاتك</div>
          <div>{order.notes}</div>
        </div>
      )}

      <button
        type="button"
        onClick={() => router.push("/store")}
        className="inline-flex min-h-[54px] w-full items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-5 text-sm font-bold text-white transition-colors hover:bg-[#e20d30]"
      >
        متابعة التسوّق
      </button>
    </div>
  );

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 28%)",
      }}
    >
      <StoreHeader showBack />

      <div
        className="mx-auto max-w-[980px]"
        style={{ padding: scr.mobile ? "14px 14px 36px" : "24px 24px 56px" }}
      >
        <StepBar />
        {step === 0 && <CartStep />}
        {step === 1 && <InfoStep />}
        {step === 2 && <PayStep />}
        {step === 3 && <ConfirmStep />}
      </div>

      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`fixed bottom-5 left-1/2 z-[999] -translate-x-1/2 rounded-2xl border px-6 py-3 text-sm font-bold shadow-[0_20px_40px_rgba(0,0,0,0.35)] ${
            toast.type === "error"
              ? "border-[#6a2232] bg-[#2a1016] text-[#ff8297]"
              : "border-[#1f6d47] bg-[#0e241a] text-[#8ce2ae]"
          }`}
        >
          {toast.message}
        </div>
      ))}

      <Footer />
    </div>
  );
}
