// =====================================================
// ClalMobile — Compare Page
// Side-by-side product comparison table (2-4 products)
// =====================================================

"use client";

import Link from "next/link";
import { useCompare } from "@/lib/store/compare";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";
import { getProductName, getColorName } from "@/lib/utils";

export default function ComparePage() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const { items, removeItem, clearAll } = useCompare();
  const addToCart = useCart((s) => s.addItem);

  const handleAddToCart = (item: (typeof items)[0]) => {
    addToCart({
      productId: item.id,
      name: item.name_ar,
      name_he: item.name_he || undefined,
      brand: item.brand,
      type: item.type,
      price: item.price,
      image: item.image_url || undefined,
    });
  };

  const handleShare = () => {
    const url = window.location.href;
    navigator.clipboard.writeText(url).catch(() => {});
  };

  // Find min price for green highlight
  const minPrice = items.length > 0 ? Math.min(...items.map((i) => i.price)) : 0;

  // Collect all spec keys
  const specKeys = new Set<string>();
  items.forEach((item) => {
    Object.keys(item.specs || {}).forEach((k) => specKeys.add(k));
  });
  const specKeyList = Array.from(specKeys);

  // Spec label mapping
  const specLabels: Record<string, string> = {
    screen: t("detail.screen"),
    camera: t("detail.camera"),
    front_camera: t("detail.frontCamera"),
    battery: t("detail.battery"),
    cpu: t("detail.cpu"),
    weight: t("detail.weight"),
    warranty: lang === "ar" ? "الضمان" : "אחריות",
    ram: "RAM",
    storage: lang === "ar" ? "التخزين" : "אחסון",
    os: t("detail.os"),
    sim: "SIM",
    waterproof: t("detail.waterproof"),
    charging: t("detail.charging"),
    network: t("detail.network"),
    bluetooth: "Bluetooth",
    usb: "USB",
    nfc: "NFC",
    dimensions: t("detail.dimensions"),
    color: lang === "ar" ? "الألوان" : "צבעים",
  };

  if (items.length === 0) {
    return (
      <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
        <StoreHeader showBack />
        <div className="max-w-[1200px] mx-auto text-center" style={{ padding: scr.mobile ? "60px 16px" : "100px 24px" }}>
          <div style={{ fontSize: scr.mobile ? 48 : 64 }} className="mb-4">⚖️</div>
          <h2 className="font-black mb-2" style={{ fontSize: scr.mobile ? 18 : 24 }}>
            {t("compare.emptyTitle")}
          </h2>
          <p className="text-muted mb-6" style={{ fontSize: scr.mobile ? 12 : 14 }}>
            {t("compare.emptyDesc")}
          </p>
          <Link
            href="/store"
            className="btn-primary inline-block"
            style={{ fontSize: scr.mobile ? 13 : 15, padding: scr.mobile ? "10px 24px" : "12px 32px" }}
          >
            {t("store.goToStore")}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
      <StoreHeader showBack />
      <div
        className="max-w-[1200px] mx-auto"
        style={{ padding: scr.mobile ? "16px 10px 100px" : "32px 24px 60px" }}
      >
        {/* Title + actions */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="font-black" style={{ fontSize: scr.mobile ? 18 : 26 }}>
            ⚖️ {t("compare.title")} ({items.length})
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="border border-surface-border bg-transparent text-muted rounded-lg cursor-pointer font-bold hover:text-white transition-colors"
              style={{ fontSize: scr.mobile ? 10 : 12, padding: "5px 12px" }}
            >
              📤 {t("compare.share")}
            </button>
            <button
              onClick={clearAll}
              className="border border-surface-border bg-transparent text-muted rounded-lg cursor-pointer font-bold hover:text-white transition-colors"
              style={{ fontSize: scr.mobile ? 10 : 12, padding: "5px 12px" }}
            >
              🗑 {t("compare.clearAll")}
            </button>
          </div>
        </div>

        {/* Comparison Table — horizontal scroll on mobile */}
        <div className="overflow-x-auto rounded-xl border border-surface-border">
          <table className="w-full border-collapse" style={{ minWidth: scr.mobile ? items.length * 160 : "auto" }}>
            {/* Product images row */}
            <thead>
              <tr className="bg-surface-card">
                <th
                  className="text-right text-muted font-bold border-b border-surface-border"
                  style={{ padding: scr.mobile ? "10px 8px" : "14px 16px", fontSize: scr.mobile ? 11 : 13, width: scr.mobile ? 80 : 140 }}
                >
                  {t("compare.product")}
                </th>
                {items.map((item) => (
                  <th
                    key={item.id}
                    className="text-center border-b border-surface-border border-r"
                    style={{ padding: scr.mobile ? 8 : 12 }}
                  >
                    <div className="flex flex-col items-center gap-1">
                      <div
                        className="bg-[#1a1a1e] rounded-lg flex items-center justify-center overflow-hidden mx-auto"
                        style={{ width: scr.mobile ? 80 : 120, height: scr.mobile ? 80 : 120 }}
                      >
                        {item.image_url ? (
                          <img src={item.image_url} alt={getProductName(item, lang)} className="max-w-full max-h-full object-contain p-1" />
                        ) : (
                          <span className="opacity-20 text-3xl">📱</span>
                        )}
                      </div>
                      <div className="font-extrabold text-white" style={{ fontSize: scr.mobile ? 11 : 14 }} dir="ltr">
                        {getProductName(item, lang)}
                      </div>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {/* Brand */}
              <tr>
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                  {lang === "ar" ? "الماركة" : "מותג"}
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r font-bold" style={{ padding: scr.mobile ? 6 : 10, fontSize: scr.mobile ? 11 : 13 }}>
                    {item.brand}
                  </td>
                ))}
              </tr>

              {/* Type */}
              <tr className="bg-surface-card/50">
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                  {lang === "ar" ? "النوع" : "סוג"}
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r" style={{ padding: scr.mobile ? 6 : 10, fontSize: scr.mobile ? 11 : 13 }}>
                    {item.type === "device" ? (lang === "ar" ? "📱 جهاز" : "📱 מכשיר") : (lang === "ar" ? "🔌 إكسسوار" : "🔌 אביזר")}
                  </td>
                ))}
              </tr>

              {/* Price */}
              <tr>
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                  {lang === "ar" ? "السعر" : "מחיר"}
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r" style={{ padding: scr.mobile ? 6 : 10 }}>
                    <span
                      className="font-black"
                      style={{
                        fontSize: scr.mobile ? 14 : 18,
                        color: item.price === minPrice && items.length > 1 ? "#10b981" : "#c41040",
                      }}
                    >
                      ₪{item.price.toLocaleString()}
                    </span>
                    {item.old_price && (
                      <span className="line-through text-[#52525b] mr-1" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                        ₪{item.old_price.toLocaleString()}
                      </span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Storage */}
              <tr className="bg-surface-card/50">
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                  {t("detail.storage")}
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r" style={{ padding: scr.mobile ? 6 : 10, fontSize: scr.mobile ? 10 : 12 }}>
                    {item.storage_options?.length > 0 ? item.storage_options.join(" / ") : "—"}
                  </td>
                ))}
              </tr>

              {/* Colors */}
              <tr>
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                  {lang === "ar" ? "الألوان" : "צבעים"}
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r" style={{ padding: scr.mobile ? 6 : 10 }}>
                    <div className="flex justify-center gap-1 flex-wrap">
                      {(item.colors || []).slice(0, 5).map((c: any, i: number) => (
                        <span key={i} className="inline-block rounded-full border border-surface-border" style={{ width: 16, height: 16, background: c?.hex || "#888" }} title={getColorName(c, lang)} />
                      ))}
                      {(!item.colors || item.colors.length === 0) && <span className="text-muted">—</span>}
                    </div>
                  </td>
                ))}
              </tr>

              {/* Specs rows */}
              {specKeyList.map((key, idx) => (
                <tr key={key} className={idx % 2 === 0 ? "bg-surface-card/50" : ""}>
                  <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                    {specLabels[key] || key}
                  </td>
                  {items.map((item) => (
                    <td key={item.id} className="text-center border-b border-surface-border border-r" style={{ padding: scr.mobile ? 6 : 10, fontSize: scr.mobile ? 10 : 12 }}>
                      {item.specs?.[key] || "—"}
                    </td>
                  ))}
                </tr>
              ))}

              {/* Availability */}
              <tr>
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                  {lang === "ar" ? "التوفر" : "זמינות"}
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r font-bold" style={{ padding: scr.mobile ? 6 : 10, fontSize: scr.mobile ? 11 : 13 }}>
                    {item.stock > 0 ? (
                      <span style={{ color: "#10b981" }}>✅ {lang === "ar" ? "متوفر" : "זמין"}</span>
                    ) : (
                      <span style={{ color: "#ef4444" }}>❌ {t("store.outOfStock")}</span>
                    )}
                  </td>
                ))}
              </tr>

              {/* Add to cart row */}
              <tr className="bg-surface-card/50">
                <td className="text-right text-muted font-bold border-b border-surface-border" style={{ padding: scr.mobile ? "8px" : "10px 16px", fontSize: scr.mobile ? 10 : 12 }}>
                </td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-b border-surface-border border-r" style={{ padding: scr.mobile ? 8 : 12 }}>
                    <button
                      onClick={() => handleAddToCart(item)}
                      className="w-full cursor-pointer font-extrabold rounded-lg transition-all active:scale-[0.97]"
                      style={{
                        border: "1.5px solid #c41040",
                        background: "transparent",
                        color: "#c41040",
                        padding: scr.mobile ? "6px 0" : "8px 0",
                        fontSize: scr.mobile ? 10 : 12,
                      }}
                    >
                      🛒 {t("store.addToCart")}
                    </button>
                  </td>
                ))}
              </tr>

              {/* Remove row */}
              <tr>
                <td className="text-right" style={{ padding: scr.mobile ? "8px" : "10px 16px" }}></td>
                {items.map((item) => (
                  <td key={item.id} className="text-center border-r" style={{ padding: scr.mobile ? 8 : 12 }}>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="text-muted cursor-pointer bg-transparent border-0 font-bold hover:text-red-400 transition-colors"
                      style={{ fontSize: scr.mobile ? 10 : 12 }}
                    >
                      ❌ {t("compare.remove")}
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
