// =====================================================
// ClalMobile — Customer Account Page
// Tabs: طلباتي | معلوماتي | المفضلة
// =====================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Footer } from "@/components/website/sections";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useWishlist } from "@/lib/store/wishlist";
import { useCart } from "@/lib/store/cart";

type TabKey = "orders" | "profile" | "wishlist";

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
  customer_code?: string;
}

interface HotAccountData {
  id: string;
  hot_mobile_id?: string;
  hot_customer_code?: string;
  line_phone?: string;
  label?: string;
  status: string;
  is_primary: boolean;
  source?: string;
  created_at: string;
}

interface OrderData {
  id: string;
  status: string;
  total: number;
  items_total: number;
  discount_amount: number;
  coupon_code?: string;
  payment_method: string;
  payment_status?: string;
  shipping_city: string;
  shipping_address: string;
  created_at: string;
  updated_at: string;
  delivered_at?: string | null;
  shipped_at?: string | null;
  cancelled_at_customer?: string | null;
  cancellation_reason?: string | null;
  cancellation_fee?: number | null;
  cancellation_refund?: number | null;
  items: {
    id: string;
    product_name: string;
    product_brand: string;
    price: number;
    quantity: number;
    color?: string;
    storage?: string;
  }[];
}

/** Whether the customer can still cancel this order under Israeli Consumer Protection
 *  Cancellation Regulations 2010 — 14 days from delivery (or shipped/created if no delivery date),
 *  4 months when extended_window is declared by the customer. */
function canCustomerCancel(order: OrderData, extendedWindow: boolean): { allowed: boolean; daysLeft: number } {
  const finalised = ["cancelled", "rejected", "returned"];
  if (finalised.includes(order.status)) return { allowed: false, daysLeft: 0 };
  const ref = order.delivered_at || order.shipped_at || order.created_at;
  const ageDays = (Date.now() - new Date(ref).getTime()) / 86_400_000;
  const max = extendedWindow ? 120 : 14;
  return { allowed: ageDays <= max, daysLeft: Math.max(0, Math.ceil(max - ageDays)) };
}

const STATUS_CONFIG: Record<
  string,
  { label_ar: string; label_he: string; color: string; icon: string }
> = {
  pending: {
    label_ar: "قيد الانتظار",
    label_he: "ממתין",
    color: "border border-amber-500/25 bg-amber-500/10 text-amber-300",
    icon: "⏳",
  },
  confirmed: {
    label_ar: "مؤكد",
    label_he: "מאושר",
    color: "border border-sky-500/25 bg-sky-500/10 text-sky-300",
    icon: "✅",
  },
  processing: {
    label_ar: "قيد التجهيز",
    label_he: "בעיבוד",
    color: "border border-violet-500/25 bg-violet-500/10 text-violet-300",
    icon: "📦",
  },
  shipped: {
    label_ar: "تم الشحن",
    label_he: "נשלח",
    color: "border border-indigo-500/25 bg-indigo-500/10 text-indigo-300",
    icon: "🚚",
  },
  delivered: {
    label_ar: "تم التوصيل",
    label_he: "נמסר",
    color: "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
    icon: "✅",
  },
  cancelled: {
    label_ar: "ملغي",
    label_he: "בוטל",
    color: "border border-[#6a2232] bg-[#2a1016] text-[#ff8da0]",
    icon: "❌",
  },
};

export default function AccountPage() {
  const scr = useScreen();
  const { lang } = useLang();
  const router = useRouter();
  const wishlist = useWishlist();
  const cart = useCart();

  const [tab, setTab] = useState<TabKey>("orders");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [hotAccounts, setHotAccounts] = useState<HotAccountData[]>([]);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [token, setToken] = useState("");
  // Cancellation modal state
  const [cancelOrder, setCancelOrder] = useState<OrderData | null>(null);
  const [cancelReason, setCancelReason] = useState<"changed_mind" | "defect" | "late_delivery" | "wrong_item" | "other">("changed_mind");
  const [cancelNotes, setCancelNotes] = useState("");
  const [cancelExtended, setCancelExtended] = useState(false);
  const [cancelSubmitting, setCancelSubmitting] = useState(false);
  const [cancelMsg, setCancelMsg] = useState("");

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formAddress, setFormAddress] = useState("");

  useEffect(() => {
    const savedToken = localStorage.getItem("clal_customer_token");
    const savedCustomer = localStorage.getItem("clal_customer");

    if (!savedToken) {
      router.replace("/store/auth?return=/store/account");
      return;
    }

    setToken(savedToken);

    if (savedCustomer) {
      try {
        const parsed = JSON.parse(savedCustomer);
        setCustomer(parsed);
        setFormName(parsed.name || "");
        setFormEmail(parsed.email || "");
        setFormCity(parsed.city || "");
        setFormAddress(parsed.address || "");
      } catch {
        // ignore corrupted local data
      }
    }
  }, [router]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem("clal_customer_token");
    localStorage.removeItem("clal_customer");
    router.replace("/store/auth");
  }, [router]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/customer/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      const data = json.data ?? json;
      if (json.success) {
        setOrders(data.orders || []);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch {
      // ignore transient failures
    }
    setLoadingOrders(false);
  }, [token, handleLogout]);

  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/customer/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const pJson = await res.json();
      const pData = pJson.data ?? pJson;
      if (pJson.success && pData.customer) {
        setCustomer(pData.customer);
        setHotAccounts(pData.hotAccounts || []);
        setFormName(pData.customer.name || "");
        setFormEmail(pData.customer.email || "");
        setFormCity(pData.customer.city || "");
        setFormAddress(pData.customer.address || "");
        localStorage.setItem("clal_customer", JSON.stringify(pData.customer));
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch {
      // ignore transient failures
    }
    setLoadingProfile(false);
  }, [token, handleLogout]);

  useEffect(() => {
    if (token && tab === "orders") fetchOrders();
    if (token && tab === "profile") fetchProfile();
  }, [token, tab, fetchOrders, fetchProfile]);

  const handleSaveProfile = async () => {
    setSavingProfile(true);
    setProfileMsg("");
    try {
      const res = await fetch("/api/customer/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: formName,
          email: formEmail,
          city: formCity,
          address: formAddress,
        }),
      });
      const json = await res.json();
      const data = json.data ?? json;

      if (json.success && data.customer) {
        setCustomer(data.customer);
        setHotAccounts(data.hotAccounts || hotAccounts);
        localStorage.setItem("clal_customer", JSON.stringify(data.customer));
        setProfileMsg(lang === "he" ? "נשמר בהצלחה!" : "تم الحفظ بنجاح!");
        setTimeout(() => setProfileMsg(""), 3000);
      } else {
        setProfileMsg(json.error || data.error || (lang === "he" ? "שגיאה" : "خطأ"));
      }
    } catch {
      setProfileMsg(lang === "he" ? "שגיאה" : "خطأ في الاتصال");
    }
    setSavingProfile(false);
  };

  // Submit cancellation request
  const submitCancel = async () => {
    if (!cancelOrder) return;
    setCancelSubmitting(true);
    setCancelMsg("");
    try {
      const res = await fetch(`/api/customer/orders/${encodeURIComponent(cancelOrder.id)}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: cancelReason,
          notes: cancelNotes || undefined,
          extended_window: cancelExtended,
        }),
      });
      const json = await res.json();
      const data = json.data ?? json;
      if (json.success) {
        setCancelMsg(data.message || (lang === "he" ? "הזמנה בוטלה" : "تم إلغاء الطلب"));
        // Refresh orders list
        await fetchOrders();
        setTimeout(() => {
          setCancelOrder(null);
          setCancelMsg("");
          setCancelNotes("");
          setCancelReason("changed_mind");
          setCancelExtended(false);
        }, 2200);
      } else {
        setCancelMsg(json.error || (lang === "he" ? "שגיאה" : "خطأ"));
      }
    } catch {
      setCancelMsg(lang === "he" ? "שגיאת רשת" : "خطأ في الاتصال");
    }
    setCancelSubmitting(false);
  };

  const handleAddAllWishlistToCart = () => {
    wishlist.items.forEach((item) => {
      cart.addItem({
        productId: item.id,
        name: lang === "he" ? item.name_he : item.name_ar,
        brand: item.brand,
        price: item.price,
        image: item.image_url,
        type: item.type,
      });
    });
  };

  const isMob = scr.mobile;
  const panelS =
    "rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.24)]";
  const softPanelS = "rounded-[22px] border border-[#30303a] bg-white/[0.03]";
  const accentBadgeClass =
    "inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]";
  const fieldLabelClass = "mb-1.5 block text-xs font-semibold text-[#8f8f99]";
  const inputClass =
    "w-full rounded-2xl border border-[#3a3a44] bg-white/[0.03] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#8f8f99] focus:border-[#ff3351]/45 focus:bg-white/[0.05]";
  const readOnlyInputClass = `${inputClass} cursor-not-allowed opacity-70`;
  const primaryButtonClass =
    "inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-6 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f] disabled:cursor-not-allowed disabled:opacity-60";
  const secondaryButtonClass =
    "inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-5 text-sm font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white disabled:opacity-60";
  const dangerGhostButtonClass =
    "inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#6a2232] bg-[#2a1016] px-5 text-sm font-bold text-[#ff8297] transition-colors hover:bg-[#34131d] disabled:opacity-60";
  const successBoxClass =
    "rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-xs text-emerald-300";
  const infoBoxClass =
    "rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3 text-[11px] leading-relaxed text-sky-300";
  const tabButtonClass = (active: boolean) =>
    `flex-1 rounded-[20px] px-4 py-3 text-sm font-bold transition-colors ${
      active
        ? "border border-[#ff3351]/45 bg-[#ff3351]/10 text-white"
        : "border border-transparent bg-transparent text-[#9d9daa] hover:border-[#30303a] hover:bg-white/[0.03] hover:text-white"
    }`;
  const accountCopy =
    lang === "he"
      ? {
          badge: "אזור לקוח",
          title: "החשבון שלי",
          subtitle:
            "כאן תמצאו את ההזמנות, פרטי החשבון והמועדפים שלכם מתוך ממשק כהה ורשמי שממשיך את שפת החנות.",
          logout: "התנתק",
          orders: "הזמנות",
          wishlist: "מועדפים",
          hotAccounts: "חשבונות HOT",
        }
      : {
          badge: "منطقة العميل",
          title: "حسابي",
          subtitle:
            "هنا تجد طلباتك وبياناتك ومفضلتك داخل نفس الواجهة الداكنة الرسمية التي اعتمدناها في المتجر.",
          logout: "تسجيل خروج",
          orders: "طلبات",
          wishlist: "مفضلة",
          hotAccounts: "حسابات HOT",
        };

  const tabs: { key: TabKey; label_ar: string; label_he: string; icon: string }[] = [
    { key: "orders", label_ar: "طلباتي", label_he: "ההזמנות שלי", icon: "📦" },
    { key: "profile", label_ar: "معلوماتي", label_he: "המידע שלי", icon: "👤" },
    { key: "wishlist", label_ar: "المفضلة", label_he: "מועדפים", icon: "❤️" },
  ];

  if (!token) return null;

  return (
    <>
      <StoreHeader />
      <main
        dir="rtl"
        className="min-h-screen px-4 pb-24 pt-6 text-white"
        style={{
          backgroundImage:
            "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 28%)",
          backgroundColor: "#111114",
        }}
      >
        <div className="mx-auto max-w-5xl">
          <div
            className={`${panelS} mb-4 flex flex-col gap-4 px-5 py-5 md:flex-row md:items-end md:justify-between md:px-6`}
          >
            <div>
              <span className={accentBadgeClass}>{accountCopy.badge}</span>
              <h1 className="mt-3 text-2xl font-black text-white md:text-[2.3rem]">
                {accountCopy.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-8 text-[#b8b8c2]">
                {accountCopy.subtitle}
              </p>
            </div>
            <button
              onClick={handleLogout}
              className={dangerGhostButtonClass}
            >
              {accountCopy.logout}
            </button>
          </div>

          {customer?.name && (
            <div className={`${panelS} mb-4 px-5 py-4 md:px-6`}>
              <p className="text-sm font-semibold text-[#d7d7dd]">
                {lang === "he" ? `שלום ${customer.name}` : `مرحباً ${customer.name}`}
              </p>
              <p className="mt-1 text-xs leading-7 text-[#8f8f99]">
                {lang === "he"
                  ? "ניתן לעקוב אחר הזמנות, לעדכן פרטים ולנהל את המועדפים ממקום אחד."
                  : "يمكنك من هنا متابعة الطلبات وتحديث بياناتك وإدارة المفضلة من مكان واحد."}
              </p>
              {customer.customer_code && (
                <div className="mt-3 inline-flex items-center rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-bold text-[#ff8da0]">
                  {customer.customer_code}
                </div>
              )}
            </div>
          )}

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <div className={`${softPanelS} px-4 py-4`}>
              <strong className="block text-xl font-black text-white">{orders.length}</strong>
              <span className="text-sm text-[#b8b8c2]">{accountCopy.orders}</span>
            </div>
            <div className={`${softPanelS} px-4 py-4`}>
              <strong className="block text-xl font-black text-white">{wishlist.items.length}</strong>
              <span className="text-sm text-[#b8b8c2]">{accountCopy.wishlist}</span>
            </div>
            <div className={`${softPanelS} px-4 py-4`}>
              <strong className="block text-xl font-black text-white">{hotAccounts.length}</strong>
              <span className="text-sm text-[#b8b8c2]">{accountCopy.hotAccounts}</span>
            </div>
          </div>

          <div className={`${panelS} mb-6 grid gap-2 p-2 md:grid-cols-3`}>
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={tabButtonClass(tab === item.key)}
              >
                <span className="mr-1">{item.icon}</span>
                {lang === "he" ? item.label_he : item.label_ar}
              </button>
            ))}
          </div>

          {tab === "orders" && (
            <div>
              {loadingOrders ? (
                <div className={`${panelS} py-16 text-center text-[#b8b8c2]`}>
                  <div className="mb-2 text-3xl">⏳</div>
                  {lang === "he" ? "טוען..." : "جاري التحميل..."}
                </div>
              ) : orders.length === 0 ? (
                <div className={`${panelS} py-16 text-center`}>
                  <div className="mb-4 text-5xl">📦</div>
                  <p className="text-lg text-[#b8b8c2]">
                    {lang === "he" ? "אין הזמנות עדיין" : "لا توجد طلبات بعد"}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className={`${primaryButtonClass} mt-4`}
                  >
                    {lang === "he" ? "התחל לקנות" : "ابدأ التسوق"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <div key={order.id} className={`${panelS} overflow-hidden`}>
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="flex w-full items-center justify-between p-4 text-right"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{statusConf.icon}</span>
                            <div>
                              <p className="text-sm font-bold">{order.id}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(order.created_at).toLocaleDateString(
                                  lang === "he" ? "he-IL" : "ar-EG",
                                )}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-3">
                            <span
                              className={`rounded-full px-2 py-1 text-xs font-medium ${statusConf.color}`}
                            >
                              {lang === "he" ? statusConf.label_he : statusConf.label_ar}
                            </span>
                            <span className="text-sm font-bold text-white">₪{order.total}</span>
                            <span
                              className={`text-[#8f8f99] transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            >
                              ▼
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-[#2d2d35] px-4 pb-4">
                            <div className="mt-3 space-y-2">
                              {order.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="flex items-center justify-between text-sm"
                                >
                                  <div>
                                    <span className="font-medium text-white">
                                      {item.product_name}
                                    </span>
                                    {item.color && (
                                      <span className="mr-2 text-[#8f8f99]">({item.color})</span>
                                    )}
                                    {item.storage && (
                                      <span className="mr-1 text-[#8f8f99]">{item.storage}</span>
                                    )}
                                    <span className="text-[#8f8f99]"> ×{item.quantity}</span>
                                  </div>
                                  <span className="font-medium text-[#ff667d]">
                                    ₪{item.price * item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 space-y-1 border-t border-[#2f2f38] pt-3 text-sm">
                              {order.discount_amount > 0 && (
                                <div className="flex justify-between text-emerald-300">
                                  <span>{lang === "he" ? "הנחה" : "خصم"}</span>
                                  <span>-₪{order.discount_amount}</span>
                                </div>
                              )}
                              {order.coupon_code && (
                                <div className="flex justify-between text-xs text-[#8f8f99]">
                                  <span>{lang === "he" ? "קופון" : "كوبون"}</span>
                                  <span>{order.coupon_code}</span>
                                </div>
                              )}
                              <div className="flex justify-between text-white">
                                <span>{lang === "he" ? "שיטת תשלום" : "طريقة الدفع"}</span>
                                <span>
                                  {order.payment_method === "credit"
                                    ? lang === "he"
                                      ? "אשראי"
                                      : "بطاقة ائتمان"
                                    : order.payment_method === "bank"
                                      ? lang === "he"
                                        ? "העברה בנקאית"
                                        : "تحويل بنكي"
                                      : order.payment_method}
                                </span>
                              </div>
                              {order.shipping_city && (
                                <div className="flex justify-between text-[#b8b8c2]">
                                  <span>{lang === "he" ? "עיר" : "المدينة"}</span>
                                  <span>{order.shipping_city}</span>
                                </div>
                              )}
                              {order.shipping_address && (
                                <div className="flex justify-between text-xs text-[#8f8f99]">
                                  <span>{lang === "he" ? "כתובת" : "العنوان"}</span>
                                  <span className="max-w-[200px] truncate">
                                    {order.shipping_address}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Cancellation status (already cancelled) */}
                            {order.status === "cancelled" && order.cancelled_at_customer && (
                              <div className="mt-3 rounded-2xl border border-[#6a2232] bg-[#2a1016] p-3 text-xs text-[#ff8da0]">
                                ❌ {lang === "he" ? "הזמנה בוטלה על ידך" : "تم إلغاء الطلب من قبلك"}
                                {order.cancellation_refund != null && (
                                  <div className="mt-1 text-[#b8b8c2]">
                                    {lang === "he" ? "החזר" : "المُعاد"}: ₪{order.cancellation_refund} •{" "}
                                    {lang === "he" ? "דמי ביטול" : "رسوم الإلغاء"}: ₪{order.cancellation_fee || 0}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Cancel button (only when window is still open) */}
                            {(() => {
                              const ccc = canCustomerCancel(order, false);
                              if (!ccc.allowed) return null;
                              return (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCancelOrder(order);
                                    setCancelReason("changed_mind");
                                    setCancelNotes("");
                                    setCancelExtended(false);
                                    setCancelMsg("");
                                  }}
                                  className="mt-3 w-full rounded-full border border-[#6a2232] bg-[#2a1016] py-2.5 text-xs font-bold text-[#ff8da0] transition-colors hover:bg-[#34131d]"
                                >
                                  ↩️ {lang === "he"
                                    ? `בטל הזמנה (נותרו ${ccc.daysLeft} ימים)`
                                    : `إلغاء الطلب (متبقّي ${ccc.daysLeft} يوم)`}
                                </button>
                              );
                            })()}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div className={`${panelS} p-6`}>
              {loadingProfile ? (
                <div className="py-8 text-center text-[#b8b8c2]">
                  {lang === "he" ? "טוען..." : "جاري التحميل..."}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-[24px] border border-[#ff3351]/20 bg-[#ff3351]/08 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-[#8f8f99]">
                          {lang === "he" ? "זהות הלקוח" : "هوية العميل"}
                        </div>
                        <div className="mt-1 text-sm font-black text-[#ff667d]" dir="ltr">
                          {customer?.customer_code || (lang === "he" ? "לא קיים" : "لا يوجد بعد")}
                        </div>
                      </div>
                      <div className="text-2xl">🎟️</div>
                    </div>

                    <div className="mt-4 border-t border-white/5 pt-4">
                      <div className="mb-2 text-xs font-semibold text-[#8f8f99]">
                        {lang === "he" ? "חשבונות HOT מקושרים" : "حسابات HOT المرتبطة"}
                      </div>

                      {hotAccounts.length === 0 ? (
                        <div className="text-xs text-[#8f8f99]">
                          {lang === "he"
                            ? "עדיין לא קושרו חשבונות HOT לחשבון זה."
                            : "لا توجد حسابات HOT مرتبطة بهذا الحساب بعد."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {hotAccounts.map((account) => (
                            <div
                              key={account.id}
                              className="rounded-[20px] border border-[#30303a] bg-white/[0.03] px-3 py-3 text-right"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-bold text-white">
                                  {account.label ||
                                    account.hot_customer_code ||
                                    account.hot_mobile_id ||
                                    "HOT"}
                                </div>
                                <div className="flex items-center gap-2">
                                  {account.is_primary && (
                                    <span className="rounded-full bg-yellow-500/15 px-2 py-0.5 text-[10px] font-bold text-yellow-400">
                                      {lang === "he" ? "ראשי" : "رئيسي"}
                                    </span>
                                  )}
                                    <span className="rounded-full bg-[#ff3351]/10 px-2 py-0.5 text-[10px] font-bold text-[#ff667d]">
                                    {account.status}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] text-[#b8b8c2]" dir="ltr">
                                {[account.hot_mobile_id, account.hot_customer_code, account.line_phone]
                                  .filter(Boolean)
                                  .join(" • ")}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className={fieldLabelClass}>
                      {lang === "he" ? "טלפון" : "الهاتف"}
                    </label>
                    <input
                      type="text"
                      value={customer?.phone || ""}
                      readOnly
                      className={readOnlyInputClass}
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={fieldLabelClass}>
                      {lang === "he" ? "שם" : "الاسم"}
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(event) => setFormName(event.target.value)}
                      className={inputClass}
                      placeholder={lang === "he" ? "הזן שם" : "أدخل اسمك"}
                    />
                  </div>

                  <div>
                    <label className={fieldLabelClass}>
                      {lang === "he" ? "אימייל" : "البريد الإلكتروني"}
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(event) => setFormEmail(event.target.value)}
                      className={inputClass}
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className={fieldLabelClass}>
                      {lang === "he" ? "עיר" : "المدينة"}
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(event) => setFormCity(event.target.value)}
                      className={inputClass}
                      placeholder={lang === "he" ? "הזן עיר" : "أدخل المدينة"}
                    />
                  </div>

                  <div>
                    <label className={fieldLabelClass}>
                      {lang === "he" ? "כתובת" : "العنوان"}
                    </label>
                    <textarea
                      value={formAddress}
                      onChange={(event) => setFormAddress(event.target.value)}
                      className={`${inputClass} resize-none`}
                      rows={2}
                      placeholder={lang === "he" ? "הזן כתובת" : "أدخل العنوان"}
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className={`${primaryButtonClass} w-full`}
                  >
                    {savingProfile
                      ? lang === "he"
                        ? "שומר..."
                        : "جاري الحفظ..."
                      : lang === "he"
                        ? "שמור שינויים"
                        : "حفظ التعديلات"}
                  </button>

                  {profileMsg && (
                    <p
                      className={`text-center text-sm font-medium ${
                        profileMsg.includes("نجاح") || profileMsg.includes("הצלחה")
                          ? "text-emerald-400"
                          : "text-[#ff8297]"
                      }`}
                    >
                      {profileMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === "wishlist" && (
            <div>
              {wishlist.items.length === 0 ? (
                <div className={`${panelS} py-16 text-center`}>
                  <div className="mb-4 text-5xl">🤍</div>
                  <p className="text-lg text-[#b8b8c2]">
                    {lang === "he" ? "אין מועדפים עדיין" : "لا توجد منتجات مفضلة"}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className={`${primaryButtonClass} mt-4`}
                  >
                    {lang === "he" ? "גלה מוצרים" : "تصفح المنتجات"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-[#b8b8c2]">
                      {wishlist.items.length} {lang === "he" ? "מוצרים" : "منتج"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAllWishlistToCart}
                        className={primaryButtonClass}
                      >
                        {lang === "he" ? "הוסף הכל לסל" : "أضف الكل للسلة"}
                      </button>
                      <button
                        onClick={() => wishlist.clearAll()}
                        className={dangerGhostButtonClass}
                      >
                        {lang === "he" ? "נקה הכל" : "مسح الكل"}
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${isMob ? "grid-cols-2" : "grid-cols-3"}`}>
                    {wishlist.items.map((item) => (
                      <div key={item.id} className={`${panelS} group relative overflow-hidden`}>
                        <div className="relative aspect-square border-b border-[#2a2a31] bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.06),transparent_58%),#141419]">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={lang === "he" ? item.name_he : item.name_ar}
                              fill
                              className="object-contain p-2"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl text-[#8f8f99]">
                              📱
                            </div>
                          )}
                          <button
                            onClick={() => wishlist.removeItem(item.id)}
                            className="absolute left-2 top-2 flex h-8 w-8 items-center justify-center rounded-full border border-[#6a2232] bg-[#2a1016] text-sm text-[#ff8297] transition hover:bg-[#34131d]"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="p-3">
                          <p className="text-xs text-[#b8b8c2]">{item.brand}</p>
                          <p className="line-clamp-1 text-sm font-bold text-white">
                            {lang === "he" ? item.name_he : item.name_ar}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm font-bold text-[#ff667d]">₪{item.price}</span>
                            {item.old_price && item.old_price > item.price && (
                              <span className="text-xs text-[#8f8f99] line-through">
                                ₪{item.old_price}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() =>
                              cart.addItem({
                                productId: item.id,
                                name: lang === "he" ? item.name_he : item.name_ar,
                                brand: item.brand,
                                price: item.price,
                                image: item.image_url,
                                type: item.type,
                              })
                            }
                            className={`${primaryButtonClass} mt-2 w-full`}
                          >
                            {lang === "he" ? "הוסף לסל" : "أضف للسلة"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ───── Cancellation modal ───── */}
      {cancelOrder && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 p-3"
          dir="rtl"
          onClick={() => !cancelSubmitting && setCancelOrder(null)}
        >
          <div
            className={`${panelS} w-full max-w-md p-5`}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="mb-1 text-lg font-black text-white">
              ↩️ {lang === "he" ? "ביטול הזמנה" : "إلغاء الطلب"}
            </h3>
            <p className="mb-3 text-xs text-[#b8b8c2]">
              {lang === "he"
                ? `הזמנה ${cancelOrder.id} • ₪${cancelOrder.total}`
                : `طلب ${cancelOrder.id} • ₪${cancelOrder.total}`}
            </p>

            <label className="mb-3 block">
              <span className={fieldLabelClass}>
                {lang === "he" ? "סיבת הביטול *" : "سبب الإلغاء *"}
              </span>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as typeof cancelReason)}
                className={inputClass}
                disabled={cancelSubmitting}
              >
                <option value="changed_mind">{lang === "he" ? "שיניתי את דעתי" : "غيّرت رأيي"}</option>
                <option value="defect">{lang === "he" ? "מוצר פגום (ללא דמי ביטול)" : "منتج معيب (بدون رسوم)"}</option>
                <option value="late_delivery">{lang === "he" ? "איחור באספקה" : "تأخّر التوصيل"}</option>
                <option value="wrong_item">{lang === "he" ? "מוצר לא מתאים" : "منتج خاطئ"}</option>
                <option value="other">{lang === "he" ? "אחר" : "آخر"}</option>
              </select>
            </label>

            <label className="mb-3 block">
              <span className={fieldLabelClass}>
                {lang === "he" ? "הערות (אופציונלי)" : "ملاحظات (اختياري)"}
              </span>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                className={`${inputClass} min-h-[60px] resize-y`}
                disabled={cancelSubmitting}
                maxLength={500}
              />
            </label>

            <label className="mb-3 flex cursor-pointer items-start gap-2 rounded-2xl border border-[#30303a] bg-white/[0.03] p-3">
              <input
                type="checkbox"
                checked={cancelExtended}
                onChange={(e) => setCancelExtended(e.target.checked)}
                disabled={cancelSubmitting}
                className="mt-0.5 w-4 h-4 accent-[#c41040]"
              />
              <span className="text-[11px] leading-relaxed text-[#b8b8c2]">
                {lang === "he"
                  ? "אני אזרח/ית 65+, אדם עם מוגבלות, או עולה חדש (5 שנים מתעודת עולה) — חלון מורחב של 4 חודשים."
                  : "أنا فوق 65 سنة، أو من ذوي الإعاقة، أو مهاجر جديد (خلال 5 سنوات من شهادة العولة) — فترة ممتدة 4 شهور."}
              </span>
            </label>

            <div className={`${infoBoxClass} mb-3`}>
              ℹ️ {lang === "he"
                ? "בכל סיבה שאינה פגם — דמי ביטול של 5% או ₪100, הנמוך מביניהם. במקרה של מוצר פגום — ללא דמי ביטול."
                : "لأي سبب غير العيب — رسوم إلغاء 5% أو ₪100 (الأقل). للمنتج المعيب — بدون رسوم."}
            </div>

            {cancelMsg && (
              <div className={`${successBoxClass} mb-3`}>
                {cancelMsg}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelOrder(null)}
                disabled={cancelSubmitting}
                className={`${secondaryButtonClass} flex-1`}
              >
                {lang === "he" ? "ביטול" : "تراجع"}
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={cancelSubmitting}
                className={`${primaryButtonClass} flex-1`}
              >
                {cancelSubmitting
                  ? "⏳ ..."
                  : lang === "he"
                    ? "אשר ביטול"
                    : "تأكيد الإلغاء"}
              </button>
            </div>
          </div>
        </div>
      )}
      <Footer />
    </>
  );
}
