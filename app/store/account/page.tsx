// =====================================================
// ClalMobile — Customer Account Page
// Tabs: طلباتي | معلوماتي | المفضلة
// =====================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    color: "text-amber-600 bg-amber-50",
    icon: "⏳",
  },
  confirmed: {
    label_ar: "مؤكد",
    label_he: "מאושר",
    color: "text-blue-600 bg-blue-50",
    icon: "✅",
  },
  processing: {
    label_ar: "قيد التجهيز",
    label_he: "בעיבוד",
    color: "text-purple-600 bg-purple-50",
    icon: "📦",
  },
  shipped: {
    label_ar: "تم الشحن",
    label_he: "נשלח",
    color: "text-indigo-600 bg-indigo-50",
    icon: "🚚",
  },
  delivered: {
    label_ar: "تم التوصيل",
    label_he: "נמסר",
    color: "text-green-600 bg-green-50",
    icon: "✅",
  },
  cancelled: {
    label_ar: "ملغي",
    label_he: "בוטל",
    color: "text-red-600 bg-red-50",
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

  const tabs: { key: TabKey; label_ar: string; label_he: string; icon: string }[] = [
    { key: "orders", label_ar: "طلباتي", label_he: "ההזמנות שלי", icon: "📦" },
    { key: "profile", label_ar: "معلوماتي", label_he: "המידע שלי", icon: "👤" },
    { key: "wishlist", label_ar: "المفضلة", label_he: "מועדפים", icon: "❤️" },
  ];

  if (!token) return null;

  return (
    <>
      <StoreHeader />
      <main dir="rtl" className="min-h-screen bg-surface-bg px-4 pb-24 pt-20 text-white">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="text-2xl font-black text-white">
              {lang === "he" ? "החשבון שלי" : "حسابي"}
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-muted transition hover:text-state-error"
            >
              {lang === "he" ? "התנתק" : "تسجيل خروج"}
            </button>
          </div>

          {customer?.name && (
            <div className="mb-4">
              <p className="text-muted">
                {lang === "he" ? `שלום ${customer.name}` : `مرحباً ${customer.name}`} 👋
              </p>
              {customer.customer_code && (
                <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-bold text-brand">
                  <span>🎟️</span>
                  <span>{customer.customer_code}</span>
                </div>
              )}
            </div>
          )}

          <div className="card mb-6 flex overflow-hidden rounded-xl">
            {tabs.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`flex-1 py-3 text-sm font-bold transition-all ${
                  tab === item.key ? "bg-brand text-white" : "text-muted hover:bg-surface-elevated"
                }`}
              >
                <span className="mr-1">{item.icon}</span>
                {lang === "he" ? item.label_he : item.label_ar}
              </button>
            ))}
          </div>

          {tab === "orders" && (
            <div>
              {loadingOrders ? (
                <div className="py-16 text-center text-muted">
                  <div className="mb-2 text-3xl">⏳</div>
                  {lang === "he" ? "טוען..." : "جاري التحميل..."}
                </div>
              ) : orders.length === 0 ? (
                <div className="card py-16 text-center" style={{ borderRadius: 16 }}>
                  <div className="mb-4 text-5xl">📦</div>
                  <p className="text-lg text-muted">
                    {lang === "he" ? "אין הזמנות עדיין" : "لا توجد طلبات بعد"}
                  </p>
                  <button onClick={() => router.push("/store")} className="btn-primary mt-4">
                    {lang === "he" ? "התחל לקנות" : "ابدأ التسوق"}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {orders.map((order) => {
                    const statusConf = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending;
                    const isExpanded = expandedOrder === order.id;

                    return (
                      <div key={order.id} className="card overflow-hidden rounded-xl">
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
                              className={`text-muted transition-transform ${
                                isExpanded ? "rotate-180" : ""
                              }`}
                            >
                              ▼
                            </span>
                          </div>
                        </button>

                        {isExpanded && (
                          <div className="border-t border-surface-border px-4 pb-4">
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
                                      <span className="mr-2 text-muted">({item.color})</span>
                                    )}
                                    {item.storage && (
                                      <span className="mr-1 text-muted">{item.storage}</span>
                                    )}
                                    <span className="text-muted"> ×{item.quantity}</span>
                                  </div>
                                  <span className="font-medium text-brand">
                                    ₪{item.price * item.quantity}
                                  </span>
                                </div>
                              ))}
                            </div>

                            <div className="mt-3 space-y-1 border-t border-surface-border pt-3 text-sm">
                              {order.discount_amount > 0 && (
                                <div className="flex justify-between text-state-success">
                                  <span>{lang === "he" ? "הנחה" : "خصم"}</span>
                                  <span>-₪{order.discount_amount}</span>
                                </div>
                              )}
                              {order.coupon_code && (
                                <div className="flex justify-between text-xs text-muted">
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
                                <div className="flex justify-between text-muted">
                                  <span>{lang === "he" ? "עיר" : "المدينة"}</span>
                                  <span>{order.shipping_city}</span>
                                </div>
                              )}
                              {order.shipping_address && (
                                <div className="flex justify-between text-xs text-dim">
                                  <span>{lang === "he" ? "כתובת" : "العنوان"}</span>
                                  <span className="max-w-[200px] truncate">
                                    {order.shipping_address}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Cancellation status (already cancelled) */}
                            {order.status === "cancelled" && order.cancelled_at_customer && (
                              <div className="mt-3 rounded-xl border border-state-error/30 bg-state-error/5 p-3 text-xs text-state-error">
                                ❌ {lang === "he" ? "הזמנה בוטלה על ידך" : "تم إلغاء الطلب من قبلك"}
                                {order.cancellation_refund != null && (
                                  <div className="mt-1 text-muted">
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
                                  className="mt-3 w-full rounded-xl border border-state-error/40 bg-state-error/5 py-2 text-xs font-bold text-state-error hover:bg-state-error/10 transition-colors"
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
            <div className="card rounded-xl p-6">
              {loadingProfile ? (
                <div className="py-8 text-center text-muted">
                  {lang === "he" ? "טוען..." : "جاري التحميل..."}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="rounded-xl border border-brand/20 bg-brand/5 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-right">
                        <div className="text-xs font-semibold text-muted">
                          {lang === "he" ? "זהות הלקוח" : "هوية العميل"}
                        </div>
                        <div className="mt-1 text-sm font-black text-brand" dir="ltr">
                          {customer?.customer_code || (lang === "he" ? "לא קיים" : "لا يوجد بعد")}
                        </div>
                      </div>
                      <div className="text-2xl">🎟️</div>
                    </div>

                    <div className="mt-4 border-t border-white/5 pt-4">
                      <div className="mb-2 text-xs font-semibold text-muted">
                        {lang === "he" ? "חשבונות HOT מקושרים" : "حسابات HOT المرتبطة"}
                      </div>

                      {hotAccounts.length === 0 ? (
                        <div className="text-xs text-dim">
                          {lang === "he"
                            ? "עדיין לא קושרו חשבונות HOT לחשבון זה."
                            : "لا توجد حسابات HOT مرتبطة بهذا الحساب بعد."}
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {hotAccounts.map((account) => (
                            <div
                              key={account.id}
                              className="rounded-xl border border-white/5 bg-black/10 px-3 py-2 text-right"
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
                                  <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
                                    {account.status}
                                  </span>
                                </div>
                              </div>
                              <div className="mt-1 text-[11px] text-muted" dir="ltr">
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
                    <label className="mb-1 block text-xs font-semibold text-muted">
                      {lang === "he" ? "טלפון" : "الهاتف"}
                    </label>
                    <input
                      type="text"
                      value={customer?.phone || ""}
                      readOnly
                      className="input cursor-not-allowed opacity-60"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">
                      {lang === "he" ? "שם" : "الاسم"}
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(event) => setFormName(event.target.value)}
                      className="input"
                      placeholder={lang === "he" ? "הזן שם" : "أدخل اسمك"}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">
                      {lang === "he" ? "אימייל" : "البريد الإلكتروني"}
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(event) => setFormEmail(event.target.value)}
                      className="input"
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">
                      {lang === "he" ? "עיר" : "المدينة"}
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(event) => setFormCity(event.target.value)}
                      className="input"
                      placeholder={lang === "he" ? "הזן עיר" : "أدخل المدينة"}
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs font-semibold text-muted">
                      {lang === "he" ? "כתובת" : "العنوان"}
                    </label>
                    <textarea
                      value={formAddress}
                      onChange={(event) => setFormAddress(event.target.value)}
                      className="input resize-none"
                      rows={2}
                      placeholder={lang === "he" ? "הזן כתובת" : "أدخل العنوان"}
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="btn-primary w-full disabled:opacity-50"
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
                          ? "text-state-success"
                          : "text-state-error"
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
                <div className="card py-16 text-center">
                  <div className="mb-4 text-5xl">🤍</div>
                  <p className="text-lg text-muted">
                    {lang === "he" ? "אין מועדפים עדיין" : "لا توجد منتجات مفضلة"}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className="btn-primary mt-4 rounded-xl px-6 py-2 text-sm"
                  >
                    {lang === "he" ? "גלה מוצרים" : "تصفح المنتجات"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="mb-4 flex items-center justify-between">
                    <p className="text-sm text-muted">
                      {wishlist.items.length} {lang === "he" ? "מוצרים" : "منتج"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAllWishlistToCart}
                        className="btn-primary rounded-lg px-3 py-1.5 text-xs"
                      >
                        {lang === "he" ? "הוסף הכל לסל" : "أضف الكل للسلة"}
                      </button>
                      <button
                        onClick={() => wishlist.clearAll()}
                        className="rounded-lg bg-state-error/10 px-3 py-1.5 text-xs font-medium text-state-error"
                      >
                        {lang === "he" ? "נקה הכל" : "مسح الكل"}
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${isMob ? "grid-cols-2" : "grid-cols-3"}`}>
                    {wishlist.items.map((item) => (
                      <div key={item.id} className="card group relative overflow-hidden rounded-xl">
                        <div className="relative aspect-square bg-surface-elevated">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={lang === "he" ? item.name_he : item.name_ar}
                              fill
                              className="object-contain p-2"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-4xl text-dim">
                              📱
                            </div>
                          )}
                          <button
                            onClick={() => wishlist.removeItem(item.id)}
                            className="absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-state-error/10 text-sm text-state-error transition hover:bg-state-error/20"
                          >
                            ✕
                          </button>
                        </div>

                        <div className="p-3">
                          <p className="text-xs text-muted">{item.brand}</p>
                          <p className="line-clamp-1 text-sm font-bold text-white">
                            {lang === "he" ? item.name_he : item.name_ar}
                          </p>
                          <div className="mt-2 flex items-center justify-between">
                            <span className="text-sm font-bold text-brand">₪{item.price}</span>
                            {item.old_price && item.old_price > item.price && (
                              <span className="text-xs text-dim line-through">
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
                            className="btn-primary mt-2 w-full rounded-lg py-2 text-xs"
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
            className="card w-full max-w-md rounded-2xl bg-surface-card p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-black text-white mb-1">
              ↩️ {lang === "he" ? "ביטול הזמנה" : "إلغاء الطلب"}
            </h3>
            <p className="text-xs text-muted mb-3">
              {lang === "he"
                ? `הזמנה ${cancelOrder.id} • ₪${cancelOrder.total}`
                : `طلب ${cancelOrder.id} • ₪${cancelOrder.total}`}
            </p>

            <label className="block mb-3">
              <span className="text-xs text-muted mb-1 block">
                {lang === "he" ? "סיבת הביטול *" : "سبب الإلغاء *"}
              </span>
              <select
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value as typeof cancelReason)}
                className="input w-full"
                disabled={cancelSubmitting}
              >
                <option value="changed_mind">{lang === "he" ? "שיניתי את דעתי" : "غيّرت رأيي"}</option>
                <option value="defect">{lang === "he" ? "מוצר פגום (ללא דמי ביטול)" : "منتج معيب (بدون رسوم)"}</option>
                <option value="late_delivery">{lang === "he" ? "איחור באספקה" : "تأخّر التوصيل"}</option>
                <option value="wrong_item">{lang === "he" ? "מוצר לא מתאים" : "منتج خاطئ"}</option>
                <option value="other">{lang === "he" ? "אחר" : "آخر"}</option>
              </select>
            </label>

            <label className="block mb-3">
              <span className="text-xs text-muted mb-1 block">
                {lang === "he" ? "הערות (אופציונלי)" : "ملاحظات (اختياري)"}
              </span>
              <textarea
                value={cancelNotes}
                onChange={(e) => setCancelNotes(e.target.value)}
                className="input w-full min-h-[60px] resize-y"
                disabled={cancelSubmitting}
                maxLength={500}
              />
            </label>

            <label className="flex items-start gap-2 mb-3 cursor-pointer rounded-xl border border-surface-border bg-surface-elevated p-2.5">
              <input
                type="checkbox"
                checked={cancelExtended}
                onChange={(e) => setCancelExtended(e.target.checked)}
                disabled={cancelSubmitting}
                className="mt-0.5 w-4 h-4 accent-[#c41040]"
              />
              <span className="text-[11px] text-muted leading-relaxed">
                {lang === "he"
                  ? "אני אזרח/ית 65+, אדם עם מוגבלות, או עולה חדש (5 שנים מתעודת עולה) — חלון מורחב של 4 חודשים."
                  : "أنا فوق 65 سنة، أو من ذوي الإعاقة، أو مهاجر جديد (خلال 5 سنوات من شهادة العولة) — فترة ممتدة 4 شهور."}
              </span>
            </label>

            <div className="rounded-xl bg-state-info/5 border border-state-info/20 p-2.5 mb-3 text-[11px] text-state-info leading-relaxed">
              ℹ️ {lang === "he"
                ? "בכל סיבה שאינה פגם — דמי ביטול של 5% או ₪100, הנמוך מביניהם. במקרה של מוצר פגום — ללא דמי ביטול."
                : "لأي سبب غير العيب — رسوم إلغاء 5% أو ₪100 (الأقل). للمنتج المعيب — بدون رسوم."}
            </div>

            {cancelMsg && (
              <div className="rounded-xl bg-state-success/10 border border-state-success/30 p-2.5 mb-3 text-xs text-state-success">
                {cancelMsg}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelOrder(null)}
                disabled={cancelSubmitting}
                className="flex-1 rounded-xl border border-surface-border bg-surface-elevated py-2.5 text-sm font-bold text-white"
              >
                {lang === "he" ? "ביטול" : "تراجع"}
              </button>
              <button
                type="button"
                onClick={submitCancel}
                disabled={cancelSubmitting}
                className="flex-1 rounded-xl border-2 border-state-error bg-state-error py-2.5 text-sm font-bold text-white disabled:opacity-50"
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
    </>
  );
}
