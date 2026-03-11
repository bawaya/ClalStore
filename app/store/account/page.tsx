"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useWishlist } from "@/lib/store/wishlist";
import { useCart } from "@/lib/store/cart";
import { ORDER_STATUS, type OrderStatus } from "@/lib/constants";
import { LoyaltyWidget } from "@/components/store/LoyaltyWidget";

type TabKey = "orders" | "loyalty" | "profile" | "wishlist";

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  email: string;
  city: string;
  address: string;
}

interface OrderItem {
  id: string;
  product_name: string;
  product_brand: string;
  price: number;
  quantity: number;
  color?: string;
  storage?: string;
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
  items: OrderItem[];
}

const TABS: { key: TabKey; icon: string }[] = [
  { key: "orders", icon: "📦" },
  { key: "loyalty", icon: "🏆" },
  { key: "profile", icon: "👤" },
  { key: "wishlist", icon: "❤️" },
];

function StatusBadge({ status, lang }: { status: string; lang: string }) {
  const conf = ORDER_STATUS[status as OrderStatus];
  if (!conf) return <span className="text-xs text-muted">{status}</span>;

  return (
    <span
      className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full"
      style={{ background: conf.color + "18", color: conf.color }}
    >
      <span className="text-[11px]">{conf.icon}</span>
      {lang === "he" ? conf.labelHe : conf.label}
    </span>
  );
}

function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-white/5 ${className}`} />
  );
}

function GlassCard({
  children,
  className = "",
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-sm ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

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

  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formCity, setFormCity] = useState("");
  const [formAddress, setFormAddress] = useState("");

  const isMob = scr.mobile;

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
      } catch { /* corrupted storage */ }
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.removeItem("clal_customer_token");
    localStorage.removeItem("clal_customer");
    router.replace("/store");
  };

  // ---------- Orders ----------
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
    } catch { /* network error */ }
    setLoadingOrders(false);
  }, [token]);

  // ---------- Profile ----------
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
    } catch { /* network error */ }
    setLoadingProfile(false);
  }, [token]);

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
      const data = await res.json();
      if (data.success && data.customer) {
        setCustomer(data.customer);
        localStorage.setItem("clal_customer", JSON.stringify(data.customer));
        setProfileMsg("saved");
        setTimeout(() => setProfileMsg(""), 3000);
      } else {
        setProfileMsg("error");
      }
    } catch {
      setProfileMsg("error");
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

  if (!token) return null;

  return (
    <>
      <StoreHeader />
      <main dir="rtl" className="min-h-screen pt-20 pb-28 px-4 bg-surface-bg text-white">
        <div className="max-w-3xl mx-auto">

          {/* ── Hero / Welcome ── */}
          <div className="relative mb-8">
            <div
              className="absolute -top-20 start-1/2 -translate-x-1/2 w-[360px] h-[360px] rounded-full opacity-[0.07] pointer-events-none blur-[100px]"
              style={{ background: "#c41040" }}
            />
            <div className="relative flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-black tracking-tight">
                  {t("account.title")}
                </h1>
                {customer?.name && (
                  <p className="mt-1 text-[15px] text-zinc-400">
                    {t("account.welcome")}{" "}
                    <span className="text-white font-semibold">{customer.name}</span> 👋
                  </p>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="shrink-0 mt-1 flex items-center gap-1.5 text-[13px] text-zinc-500 hover:text-red-400 transition-colors duration-200"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                  <polyline points="16 17 21 12 16 7" />
                  <line x1="21" y1="12" x2="9" y2="12" />
                </svg>
                {t("account.logout")}
              </button>
            </div>
          </div>

          {/* ── Tab Navigation ── */}
          <div className="flex gap-1 p-1 mb-6 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            {TABS.map(({ key, icon }) => {
              const isActive = tab === key;
              return (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={`relative flex-1 py-2.5 flex items-center justify-center gap-1.5 text-[13px] font-bold rounded-[10px] transition-all duration-300 ${
                    isActive
                      ? "text-white shadow-lg"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                  style={isActive ? { background: "linear-gradient(135deg, #c41040 0%, #a00d34 100%)" } : undefined}
                >
                  <span className="text-sm">{icon}</span>
                  {t(`account.${key}`)}
                </button>
              );
            })}
          </div>

          {/* ═══════════ ORDERS TAB ═══════════ */}
          {tab === "orders" && (
            <div className="space-y-3">
              {loadingOrders ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-20 rounded-2xl" />
                  ))}
                </div>
              ) : orders.length === 0 ? (
                <GlassCard className="py-16 text-center">
                  <div className="text-5xl mb-4">📦</div>
                  <p className="text-zinc-400 text-lg font-medium">
                    {t("account.noOrders")}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                    style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
                  >
                    {t("account.startShopping")}
                  </button>
                </GlassCard>
              ) : (
                orders.map((order) => {
                  const isExpanded = expandedOrder === order.id;
                  const shortId = order.id.slice(0, 8).toUpperCase();
                  const date = new Date(order.created_at).toLocaleDateString(
                    lang === "he" ? "he-IL" : "ar-EG",
                    { day: "numeric", month: "short", year: "numeric" }
                  );
                  return (
                    <GlassCard key={order.id}>
                      <button
                        onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                        className="w-full p-4 flex items-center justify-between gap-3 text-start"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center text-lg"
                            style={{
                              background: (ORDER_STATUS[order.status as OrderStatus]?.color || "#555") + "14",
                            }}
                          >
                            {ORDER_STATUS[order.status as OrderStatus]?.icon || "📋"}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-bold text-sm text-white">#{shortId}</span>
                              <StatusBadge status={order.status} lang={lang} />
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{date}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className="font-bold text-sm text-white">₪{order.total}</span>
                          <svg
                            width="16" height="16" viewBox="0 0 24 24" fill="none"
                            stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                            className={`text-zinc-500 transition-transform duration-300 ${isExpanded ? "rotate-180" : ""}`}
                          >
                            <polyline points="6 9 12 15 18 9" />
                          </svg>
                        </div>
                      </button>

                      <div
                        className="overflow-hidden transition-all duration-300 ease-in-out"
                        style={{
                          maxHeight: isExpanded ? "600px" : "0px",
                          opacity: isExpanded ? 1 : 0,
                        }}
                      >
                        <div className="px-4 pb-4 border-t border-white/[0.06]">
                          {/* Items */}
                          <div className="mt-3 space-y-2">
                            {order.items.map((item) => (
                              <div key={item.id} className="flex items-center justify-between text-[13px]">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className="text-white font-medium truncate">{item.product_name}</span>
                                  {item.color && (
                                    <span className="text-zinc-500">({item.color})</span>
                                  )}
                                  {item.storage && (
                                    <span className="text-zinc-600 text-xs">{item.storage}</span>
                                  )}
                                  <span className="text-zinc-600">×{item.quantity}</span>
                                </div>
                                <span className="font-semibold shrink-0" style={{ color: "#c41040" }}>
                                  ₪{item.price * item.quantity}
                                </span>
                              </div>
                            ))}
                          </div>

                          {/* Summary */}
                          <div className="mt-3 pt-3 border-t border-white/[0.04] text-[13px] space-y-1.5">
                            {order.discount_amount > 0 && (
                              <div className="flex justify-between text-emerald-400">
                                <span>{lang === "he" ? "הנחה" : "خصم"}</span>
                                <span>-₪{order.discount_amount}</span>
                              </div>
                            )}
                            {order.coupon_code && (
                              <div className="flex justify-between text-zinc-500 text-xs">
                                <span>{lang === "he" ? "קופון" : "كوبون"}</span>
                                <span className="font-mono">{order.coupon_code}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-zinc-300">
                              <span>{lang === "he" ? "שיטת תשלום" : "طريقة الدفع"}</span>
                              <span>
                                {order.payment_method === "credit"
                                  ? (lang === "he" ? "אשראי" : "بطاقة ائتمان")
                                  : order.payment_method === "bank"
                                    ? (lang === "he" ? "העברה בנקאית" : "تحويل بنكي")
                                    : order.payment_method}
                              </span>
                            </div>
                            {order.shipping_city && (
                              <div className="flex justify-between text-zinc-500">
                                <span>{t("account.city")}</span>
                                <span>{order.shipping_city}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </GlassCard>
                  );
                })
              )}
            </div>
          )}

          {/* ═══════════ LOYALTY TAB ═══════════ */}
          {tab === "loyalty" && <LoyaltyWidget />}

          {/* ═══════════ PROFILE TAB ═══════════ */}
          {tab === "profile" && (
            <GlassCard className="p-5 sm:p-6">
              {loadingProfile ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i}>
                      <Skeleton className="h-3 w-16 mb-2" />
                      <Skeleton className="h-11 w-full" />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-4">
                  <ProfileField
                    label={t("account.phone")}
                    value={customer?.phone || ""}
                    readOnly
                    dir="ltr"
                  />
                  <ProfileField
                    label={t("account.name")}
                    value={formName}
                    onChange={setFormName}
                    placeholder={lang === "he" ? "הזן שם" : "أدخل اسمك"}
                  />
                  <ProfileField
                    label={t("account.email")}
                    value={formEmail}
                    onChange={setFormEmail}
                    type="email"
                    placeholder="example@email.com"
                    dir="ltr"
                  />
                  <ProfileField
                    label={t("account.city")}
                    value={formCity}
                    onChange={setFormCity}
                    placeholder={lang === "he" ? "הזן עיר" : "أدخل المدينة"}
                  />
                  <div>
                    <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
                      {t("account.address")}
                    </label>
                    <textarea
                      value={formAddress}
                      onChange={(e) => setFormAddress(e.target.value)}
                      rows={2}
                      placeholder={lang === "he" ? "הזן כתובת" : "أدخل العنوان"}
                      className="w-full px-4 py-3 rounded-xl text-sm text-white placeholder-zinc-600 bg-white/[0.04] border border-white/[0.08] focus:border-[#c41040]/50 focus:ring-1 focus:ring-[#c41040]/20 outline-none transition-all duration-200 resize-none"
                    />
                  </div>

                  <button
                    onClick={handleSaveProfile}
                    disabled={savingProfile}
                    className="w-full py-3 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none"
                    style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
                  >
                    {savingProfile
                      ? t("account.saving")
                      : t("account.saveChanges")}
                  </button>

                  {profileMsg && (
                    <p
                      className={`text-center text-sm font-medium transition-opacity duration-300 ${
                        profileMsg === "saved" ? "text-emerald-400" : "text-red-400"
                      }`}
                    >
                      {profileMsg === "saved"
                        ? t("account.saved")
                        : (lang === "he" ? "שגיאה בשמירה" : "خطأ في الحفظ")}
                    </p>
                  )}
                </div>
              )}
            </GlassCard>
          )}

          {/* ═══════════ WISHLIST TAB ═══════════ */}
          {tab === "wishlist" && (
            <div>
              {wishlist.items.length === 0 ? (
                <GlassCard className="py-16 text-center">
                  <div className="text-5xl mb-4">🤍</div>
                  <p className="text-zinc-400 text-lg font-medium">
                    {lang === "he" ? "אין מועדפים עדיין" : "لا توجد منتجات مفضلة"}
                  </p>
                  <button
                    onClick={() => router.push("/store")}
                    className="mt-5 inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                    style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
                  >
                    {lang === "he" ? "גלה מוצרים" : "تصفح المنتجات"}
                  </button>
                </GlassCard>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-zinc-500">
                      {wishlist.items.length} {lang === "he" ? "מוצרים" : "منتج"}
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={handleAddAllWishlistToCart}
                        className="text-xs font-bold px-3 py-1.5 rounded-lg text-white transition-all duration-200 hover:brightness-110"
                        style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
                      >
                        {lang === "he" ? "הוסף הכל לסל" : "أضف الكل للسلة"}
                      </button>
                      <button
                        onClick={() => wishlist.clearAll()}
                        className="text-xs font-medium px-3 py-1.5 rounded-lg text-red-400 bg-red-400/10 hover:bg-red-400/20 transition-colors duration-200"
                      >
                        {lang === "he" ? "נקה הכל" : "مسح الكل"}
                      </button>
                    </div>
                  </div>

                  <div className={`grid gap-3 ${isMob ? "grid-cols-2" : "grid-cols-3"}`}>
                    {wishlist.items.map((item) => (
                      <GlassCard key={item.id} className="group">
                        <div className="relative aspect-square bg-white/[0.02]">
                          {item.image_url ? (
                            <img
                              src={item.image_url}
                              alt={lang === "he" ? item.name_he : item.name_ar}
                              className="w-full h-full object-contain p-3"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-4xl text-zinc-700">📱</div>
                          )}
                          <button
                            onClick={() => wishlist.removeItem(item.id)}
                            className="absolute top-2 start-2 w-7 h-7 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity duration-200"
                          >
                            ✕
                          </button>
                        </div>
                        <div className="p-3 pt-2">
                          <p className="text-[11px] text-zinc-500">{item.brand}</p>
                          <p className="text-sm font-bold text-white line-clamp-1 mt-0.5">
                            {lang === "he" ? item.name_he : item.name_ar}
                          </p>
                          <div className="flex items-center justify-between mt-2">
                            <span className="font-bold text-sm" style={{ color: "#c41040" }}>₪{item.price}</span>
                            {item.old_price && item.old_price > item.price && (
                              <span className="text-xs text-zinc-600 line-through">₪{item.old_price}</span>
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
                            className="mt-2 w-full py-2 rounded-lg text-xs font-bold text-white transition-all duration-200 hover:brightness-110 active:scale-[0.97]"
                            style={{ background: "linear-gradient(135deg, #c41040, #a00d34)" }}
                          >
                            {lang === "he" ? "הוסף לסל" : "أضف للسلة"}
                          </button>
                        </div>
                      </GlassCard>
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

function ProfileField({
  label,
  value,
  onChange,
  readOnly,
  type = "text",
  placeholder,
  dir,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  readOnly?: boolean;
  type?: string;
  placeholder?: string;
  dir?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-500 mb-1.5">
        {label}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        dir={dir}
        className={`w-full px-4 py-3 rounded-xl text-sm text-white placeholder-zinc-600 bg-white/[0.04] border border-white/[0.08] outline-none transition-all duration-200 ${
          readOnly
            ? "opacity-50 cursor-not-allowed"
            : "focus:border-[#c41040]/50 focus:ring-1 focus:ring-[#c41040]/20"
        }`}
      />
    </div>
  );
}
