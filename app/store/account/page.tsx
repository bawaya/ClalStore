// =====================================================
// ClalMobile — Customer Account Page
// Tabs: طلباتي | معلوماتي | المفضلة
// =====================================================

"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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

const STATUS_CONFIG: Record<string, { label_ar: string; label_he: string; color: string; icon: string }> = {
  pending: { label_ar: "قيد الانتظار", label_he: "ממתין", color: "text-amber-600 bg-amber-50", icon: "⏳" },
  confirmed: { label_ar: "مؤكد", label_he: "מאושר", color: "text-blue-600 bg-blue-50", icon: "✅" },
  processing: { label_ar: "قيد التجهيز", label_he: "בעיבוד", color: "text-purple-600 bg-purple-50", icon: "📦" },
  shipped: { label_ar: "تم الشحن", label_he: "נשלח", color: "text-indigo-600 bg-indigo-50", icon: "🚚" },
  delivered: { label_ar: "تم التوصيل", label_he: "נמסר", color: "text-green-600 bg-green-50", icon: "✅" },
  cancelled: { label_ar: "ملغي", label_he: "בוטל", color: "text-red-600 bg-red-50", icon: "❌" },
};

export default function AccountPage() {
  const scr = useScreen();
  const { lang, t } = useLang();
  const router = useRouter();
  const wishlist = useWishlist();
  const cart = useCart();

  const [tab, setTab] = useState<TabKey>("orders");
  const [customer, setCustomer] = useState<CustomerData | null>(null);
  const [orders, setOrders] = useState<OrderData[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState("");
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [token, setToken] = useState("");

  // Profile form
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formAddress, setFormAddress] = useState("");

  // Auth guard
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
      } catch {}
    }
  }, [router]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await fetch("/api/customer/orders", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        setOrders(data.orders || []);
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch {}
    setLoadingOrders(false);
  }, [token]);

  // Fetch profile
  const fetchProfile = useCallback(async () => {
    if (!token) return;
    setLoadingProfile(true);
    try {
      const res = await fetch("/api/customer/profile", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        setFormName(data.customer.name || "");
        setFormEmail(data.customer.email || "");
        setFormCity(data.customer.city || "");
        setFormAddress(data.customer.address || "");
        localStorage.setItem("clal_customer", JSON.stringify(data.customer));
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch {}
    setLoadingProfile(false);
  }, [token]);

  useEffect(() => {
    if (token && tab === "orders") fetchOrders();
    if (token && tab === "profile") fetchProfile();
  }, [token, tab, fetchOrders, fetchProfile]);

  const handleLogout = () => {
    localStorage.removeItem("clal_customer_token");
    localStorage.removeItem("clal_customer");
    router.replace("/store/auth");
  };

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
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        localStorage.setItem("clal_customer", JSON.stringify(data.customer));
        setProfileMsg(lang === "he" ? "נשמר בהצלחה!" : "تم الحفظ بنجاح!");
        setTimeout(() => setProfileMsg(""), 3000);
      } else {
        setProfileMsg(data.error || (lang === "he" ? "שגיאה" : "خطأ"));
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

  const isRTL = true;
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
      <main
        dir="rtl"
        className="min-h-screen pt-20 pb-24 px-4"
        style={{ background: "var(--surface-bg, #f8f9fa)" }}
      >
        <div className="max-w-4xl mx-auto">
          {/* Page Header */}
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold">
              {lang === "he" ? "החשבון שלי" : "حسابي"}
            </h1>
            <button
              onClick={handleLogout}
              className="text-sm text-gray-500 hover:text-red-600 transition"
            >
              {lang === "he" ? "התנתק" : "تسجيل خروج"}
            </button>
          </div>

          {/* Customer Welcome */}
          {customer?.name && (
            <p className="text-gray-600 mb-4">
              {lang === "he" ? `שלום ${customer.name}` : `مرحباً ${customer.name}`} 👋
            </p>
          )}

          {/* Tabs */}
          <div className="flex gap-1 mb-6 rounded-xl overflow-hidden"
               style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, #e5e7eb)" }}>
            {tabs.map((t) => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex-1 py-3 text-sm font-medium transition-all ${
                  tab === t.key
                    ? "text-white"
                    : "text-gray-600 hover:bg-gray-50"
                }`}
                style={tab === t.key ? { background: "#c41040" } : {}}
              >
                <span className="mr-1">{t.icon}</span>
                {lang === "he" ? t.label_he : t.label_ar}
              </button>
            ))}
          </div>

          {/* ===== ORDERS TAB ===== */}
          {tab === "orders" && (
            <div>
              {loadingOrders ? (
                <div className="text-center py-16 text-gray-400">
                  <div className="animate-spin text-3xl mb-2">⏳</div>
                  {lang === "he" ? "טוען..." : "جاري التحميل..."}
                </div>
              ) : orders.length === 0 ? (
                <div className="text-center py-16"
                     style={{ background: "var(--card-bg, #fff)", borderRadius: 16, border: "1px solid var(--card-border, #e5e7eb)" }}>
                  <div className="text-5xl mb-4">📦</div>
                  <p className="text-gray-500 text-lg">
                    {lang === "he" ? "אין הזמנות עדיין" : "لا توجد طلبات بعد"}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className="mt-4 px-6 py-2 rounded-xl text-white text-sm font-medium"
                    style={{ background: "#c41040" }}
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
                      <div
                        key={order.id}
                        className="rounded-xl overflow-hidden"
                        style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, #e5e7eb)" }}
                      >
                        {/* Order Header — clickable */}
                        <button
                          onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                          className="w-full p-4 flex items-center justify-between text-right"
                        >
                          <div className="flex items-center gap-3">
                            <span className="text-xl">{statusConf.icon}</span>
                            <div>
                              <p className="font-bold text-sm">{order.id}</p>
                              <p className="text-xs text-gray-400">
                                {new Date(order.created_at).toLocaleDateString(lang === "he" ? "he-IL" : "ar-EG")}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`text-xs px-2 py-1 rounded-full font-medium ${statusConf.color}`}>
                              {lang === "he" ? statusConf.label_he : statusConf.label_ar}
                            </span>
                            <span className="font-bold text-sm">₪{order.total}</span>
                            <span className={`text-gray-400 transition-transform ${isExpanded ? "rotate-180" : ""}`}>▼</span>
                          </div>
                        </button>

                        {/* Order Details — expanded */}
                        {isExpanded && (
                          <div className="px-4 pb-4 border-t" style={{ borderColor: "var(--card-border, #e5e7eb)" }}>
                            {/* Items */}
                            <div className="mt-3 space-y-2">
                              {order.items.map((item) => (
                                <div key={item.id} className="flex items-center justify-between text-sm">
                                  <div>
                                    <span className="font-medium">{item.product_name}</span>
                                    {item.color && <span className="text-gray-400 mr-2">({item.color})</span>}
                                    {item.storage && <span className="text-gray-400 mr-1">{item.storage}</span>}
                                    <span className="text-gray-400"> ×{item.quantity}</span>
                                  </div>
                                  <span className="font-medium">₪{item.price * item.quantity}</span>
                                </div>
                              ))}
                            </div>

                            {/* Summary */}
                            <div className="mt-3 pt-3 border-t text-sm space-y-1"
                                 style={{ borderColor: "var(--card-border, #e5e7eb)" }}>
                              {order.discount_amount > 0 && (
                                <div className="flex justify-between text-green-600">
                                  <span>{lang === "he" ? "הנחה" : "خصم"}</span>
                                  <span>-₪{order.discount_amount}</span>
                                </div>
                              )}
                              {order.coupon_code && (
                                <div className="flex justify-between text-gray-400 text-xs">
                                  <span>{lang === "he" ? "קופון" : "كوبون"}</span>
                                  <span>{order.coupon_code}</span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span>{lang === "he" ? "שיטת תשלום" : "طريقة الدفع"}</span>
                                <span>{order.payment_method === "credit" ? (lang === "he" ? "אשראי" : "بطاقة ائتمان") : order.payment_method === "bank" ? (lang === "he" ? "העברה בנקאית" : "تحويل بنكي") : order.payment_method}</span>
                              </div>
                              {order.shipping_city && (
                                <div className="flex justify-between">
                                  <span>{lang === "he" ? "עיר" : "المدينة"}</span>
                                  <span>{order.shipping_city}</span>
                                </div>
                              )}
                              {order.shipping_address && (
                                <div className="flex justify-between text-xs text-gray-500">
                                  <span>{lang === "he" ? "כתובת" : "العنوان"}</span>
                                  <span className="max-w-[200px] truncate">{order.shipping_address}</span>
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

          {/* ===== PROFILE TAB ===== */}
          {tab === "profile" && (
            <div className="rounded-xl p-6"
                 style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, #e5e7eb)" }}>
              {loadingProfile ? (
                <div className="text-center py-8 text-gray-400">
                  {lang === "he" ? "טוען..." : "جاري التحميل..."}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Phone — readonly */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {lang === "he" ? "טלפון" : "الهاتف"}
                    </label>
                    <input
                      type="text"
                      value={customer?.phone || ""}
                      readOnly
                      className="w-full px-4 py-3 rounded-xl bg-gray-50 text-gray-500 cursor-not-allowed text-sm"
                      dir="ltr"
                    />
                  </div>

                  {/* Name */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {lang === "he" ? "שם" : "الاسم"}
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm"
                      style={{ background: "var(--surface-bg, #f8f9fa)", border: "1px solid var(--card-border, #e5e7eb)" }}
                      placeholder={lang === "he" ? "הזן שם" : "أدخل اسمك"}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {lang === "he" ? "אימייל" : "البريد الإلكتروني"}
                    </label>
                    <input
                      type="email"
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm"
                      style={{ background: "var(--surface-bg, #f8f9fa)", border: "1px solid var(--card-border, #e5e7eb)" }}
                      placeholder="example@email.com"
                      dir="ltr"
                    />
                  </div>

                  {/* City */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {lang === "he" ? "עיר" : "المدينة"}
                    </label>
                    <input
                      type="text"
                      value={formCity}
                      onChange={(e) => setFormCity(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm"
                      style={{ background: "var(--surface-bg, #f8f9fa)", border: "1px solid var(--card-border, #e5e7eb)" }}
                      placeholder={lang === "he" ? "הזן עיר" : "أدخل المدينة"}
                    />
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">
                      {lang === "he" ? "כתובת" : "العنوان"}
                    </label>
                    <textarea
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl text-sm resize-none"
                      style={{ background: "var(--surface-bg, #f8f9fa)", border: "1px solid var(--card-border, #e5e7eb)" }}
                      rows={2}
                      placeholder={lang === "he" ? "הזן כתובת" : "أدخل العنوان"}
                    />
                  </div>

                  {/* Save */}
                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full py-3 rounded-xl text-white font-bold text-sm transition disabled:opacity-50"
                    style={{ background: "#c41040" }}
                  >
                    {savingProfile
                      ? (lang === "he" ? "שומר..." : "جاري الحفظ...")
                      : (lang === "he" ? "שמור שינויים" : "حفظ التعديلات")}
                  </button>

                  {profileMsg && (
                    <p className={`text-center text-sm font-medium ${profileMsg.includes("بنجاح") || profileMsg.includes("בהצלחה") ? "text-green-600" : "text-red-600"}`}>
                      {profileMsg}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===== WISHLIST TAB ===== */}
          {tab === "wishlist" && (
            <div>
              {wishlist.items.length === 0 ? (
                <div className="text-center py-16"
                     style={{ background: "var(--card-bg, #fff)", borderRadius: 16, border: "1px solid var(--card-border, #e5e7eb)" }}>
                  <div className="text-5xl mb-4">🤍</div>
                  <p className="text-gray-500 text-lg">
                    {lang === "he" ? "אין מועדפים עדיין" : "لا توجد منتجات مفضلة"}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className="mt-4 px-6 py-2 rounded-xl text-white text-sm font-medium"
                    style={{ background: "#c41040" }}
                  >
                    {lang === "he" ? "גלה מוצרים" : "تصفح المنتجات"}
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-500">
                      {wishlist.items.length} {lang === "he" ? "מוצרים" : "منتج"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAllWishlistToCart}
                        className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
                        style={{ background: "#c41040" }}
                      >
                        {lang === "he" ? "הוסף הכל לסל" : "أضف الكل للسلة"}
                      </button>
                      <button
                        onClick={() => wishlist.clearAll()}
                        className="text-xs px-3 py-1.5 rounded-lg text-red-600 bg-red-50 font-medium"
                      >
                        {lang === "he" ? "נקה הכל" : "مسح الكل"}
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${isMob ? "grid-cols-2" : "grid-cols-3"}`}>
                    {wishlist.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-xl overflow-hidden relative group"
                        style={{ background: "var(--card-bg, #fff)", border: "1px solid var(--card-border, #e5e7eb)" }}
                      >
                        {/* Image */}
                        <div className="relative aspect-square bg-gray-50">
                          {item.image_url ? (
                            <img src={item.image_url} alt={lang === "he" ? item.name_he : item.name_ar}
                                 className="w-full h-full object-contain p-2" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl text-gray-300">📱</div>
                          )}
                          {/* Remove button */}
                          <button
                            onClick={() => wishlist.removeItem(item.id)}
                            className="absolute top-2 left-2 w-7 h-7 rounded-full bg-red-50 text-red-500 flex items-center justify-center text-sm hover:bg-red-100 transition"
                          >
                            ✕
                          </button>
                        </div>
                        {/* Info */}
                        <div className="p-3">
                          <p className="text-xs text-gray-400">{item.brand}</p>
                          <p className="text-sm font-bold line-clamp-1">
                            {lang === "he" ? item.name_he : item.name_ar}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-sm" style={{ color: "#c41040" }}>₪{item.price}</span>
                            {item.old_price && item.old_price > item.price && (
                              <span className="text-xs text-gray-400 line-through">₪{item.old_price}</span>
                            )}
                          </div>
                          <button
                            onClick={() => cart.addItem({
                              productId: item.id,
                              name: lang === "he" ? item.name_he : item.name_ar,
                              brand: item.brand,
                              price: item.price,
                              image: item.image_url,
                              type: item.type,
                            })}
                            className="mt-2 w-full py-2 rounded-lg text-xs text-white font-medium"
                            style={{ background: "#c41040" }}
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
