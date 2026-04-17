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
    </>
  );
}
