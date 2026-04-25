"use client";

import Image from "next/image";
import Link from "next/link";
import { Footer } from "@/components/website/sections";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { useCompare } from "@/lib/store/compare";
import { getColorName, getProductName } from "@/lib/utils";

export default function ComparePage() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const { items, removeItem, clearAll } = useCompare();
  const addToCart = useCart((state) => state.addItem);

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

  const minPrice = items.length > 0 ? Math.min(...items.map((item) => item.price)) : 0;

  const specKeys = new Set<string>();
  items.forEach((item) => {
    Object.keys(item.specs || {}).forEach((key) => specKeys.add(key));
  });
  const specKeyList = Array.from(specKeys);

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

  const intro =
    lang === "he"
      ? {
          badge: "השוואה חכמה",
          title: "טבלת השוואה מסודרת להחלטה מהירה",
          subtitle:
            "השוו בין מפרט, זמינות, נפחי אחסון ומחירים מתוך תצוגה אחת ברורה ונטולת עומס.",
          count: "מוצרים מושווים",
          hint: "המחיר הנמוך מסומן בירוק",
          share: t("compare.share"),
          clear: t("compare.clearAll"),
          product: t("compare.product"),
          availability: "זמינות",
          remove: t("compare.remove"),
        }
      : {
          badge: "مقارنة ذكية",
          title: "جدول مقارنة منظم لاتخاذ القرار بسرعة",
          subtitle:
            "قارن بين المواصفات والتخزين والتوفر والسعر من شاشة واحدة واضحة ومن دون تشويش بصري.",
          count: "منتجات قيد المقارنة",
          hint: "أقل سعر يظهر باللون الأخضر",
          share: t("compare.share"),
          clear: t("compare.clearAll"),
          product: t("compare.product"),
          availability: "التوفر",
          remove: t("compare.remove"),
        };

  return (
    <div
      dir="rtl"
      className="font-arabic min-h-screen bg-[#111114] text-white"
      style={{
        backgroundImage:
          "radial-gradient(circle at top right, rgba(255,51,81,0.08), transparent 18%), radial-gradient(circle at left center, rgba(255,255,255,0.03), transparent 26%)",
      }}
    >
      <StoreHeader showBack />

      <div
        className="mx-auto max-w-[1540px]"
        style={{ padding: scr.mobile ? "16px 14px 80px" : "24px 24px 110px" }}
      >
        <section className="mb-5 rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,rgba(23,23,27,0.96),rgba(18,18,22,0.96))] px-5 py-5 shadow-[0_24px_48px_rgba(0,0,0,0.28)] md:px-7 md:py-6">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <div>
              <span className="inline-flex rounded-full border border-[#ff3351]/20 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                {intro.badge}
              </span>
              <h1 className="mt-3 text-2xl font-black leading-tight md:text-[2.4rem]">
                {intro.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-8 text-[#b8b8c2] md:text-base">
                {intro.subtitle}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">{items.length}</strong>
                <span className="text-sm text-[#b8b8c2]">{intro.count}</span>
              </div>
              <div className="rounded-[22px] border border-[#30303a] bg-white/[0.03] px-4 py-4">
                <strong className="block text-xl font-black text-white">
                  {items.length > 0 ? `₪${minPrice.toLocaleString()}` : "—"}
                </strong>
                <span className="text-sm text-[#b8b8c2]">{intro.hint}</span>
              </div>
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <section className="rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-6 py-16 text-center shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
            <div className="text-5xl">⚖</div>
            <h2 className="mt-4 text-xl font-black text-white md:text-2xl">
              {t("compare.emptyTitle")}
            </h2>
            <p className="mt-3 text-sm leading-8 text-[#b8b8c2] md:text-base">
              {t("compare.emptyDesc")}
            </p>
            <Link
              href="/store"
              className="mt-5 inline-flex min-h-[52px] items-center justify-center rounded-full border border-[#ff0e34] bg-[#ff0e34] px-6 text-sm font-bold text-white transition-colors hover:bg-[#df0d2f]"
            >
              {t("store.goToStore")}
            </Link>
          </section>
        ) : (
          <>
            <section className="mb-4 rounded-[26px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#131318_100%)] px-5 py-4 shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <span className="inline-flex rounded-full border border-[#ff3351]/18 bg-[#ff3351]/10 px-3 py-1 text-xs font-semibold text-[#ff8da0]">
                    {lang === "he" ? "פעולות מהירות" : "أدوات سريعة"}
                  </span>
                  <p className="mt-3 text-sm leading-8 text-[#b8b8c2]">
                    {lang === "he"
                      ? "טבלת ההשוואה שומרת על אותו סגנון כהה ורשמי של החנות, עם מיקוד במפרט ובמחיר."
                      : "جدول المقارنة يحافظ على نفس الروح الداكنة الرسمية للمتجر مع تركيز مباشر على المواصفات والسعر."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleShare}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#ff0e34] px-5 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
                  >
                    {intro.share}
                  </button>
                  <button
                    type="button"
                    onClick={clearAll}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#353540] bg-[#17171b] px-5 text-sm font-bold text-[#d6d6dd] transition-colors hover:border-[#ff3351]/35 hover:text-white"
                  >
                    {intro.clear}
                  </button>
                </div>
              </div>
            </section>

            <div className="overflow-x-auto rounded-[28px] border border-[#2f2f38] bg-[linear-gradient(180deg,#17171b_0%,#121216_100%)] shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
              <table
                className="w-full border-collapse"
                style={{ minWidth: scr.mobile ? items.length * 210 : "auto" }}
              >
                <thead>
                  <tr className="border-b border-[#2a2a32] bg-white/[0.02]">
                    <th
                      className="text-right text-sm font-bold text-[#8f8f99]"
                      style={{
                        padding: scr.mobile ? "14px 12px" : "18px 20px",
                        width: scr.mobile ? 100 : 180,
                      }}
                    >
                      {intro.product}
                    </th>
                    {items.map((item) => (
                      <th
                        key={item.id}
                        className="border-r border-[#2a2a32] text-center"
                        style={{ padding: scr.mobile ? 12 : 16 }}
                      >
                        <div className="flex flex-col items-center gap-3">
                          <div
                            className="relative overflow-hidden rounded-[24px] border border-[#31313a] bg-[#1a1a20]"
                            style={{
                              width: scr.mobile ? 110 : 140,
                              height: scr.mobile ? 110 : 140,
                            }}
                          >
                            {item.image_url ? (
                              <Image
                                src={item.image_url}
                                alt={getProductName(item, lang)}
                                fill
                                className="object-contain p-3"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-4xl text-white/15">
                                📱
                              </div>
                            )}
                          </div>
                          <div className="text-sm font-black text-white md:text-base">
                            {getProductName(item, lang)}
                          </div>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  <tr>
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                      {lang === "ar" ? "الماركة" : "מותג"}
                    </td>
                    {items.map((item) => (
                      <td
                        key={item.id}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center text-sm font-bold text-white"
                      >
                        {item.brand}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-white/[0.02]">
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                      {lang === "ar" ? "النوع" : "סוג"}
                    </td>
                    {items.map((item) => (
                      <td
                        key={item.id}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center text-sm text-[#d9d9df]"
                      >
                        {item.type === "device"
                          ? lang === "ar"
                            ? "جهاز"
                            : "מכשיר"
                          : lang === "ar"
                            ? "إكسسوار"
                            : "אביזר"}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                      {lang === "ar" ? "السعر" : "מחיר"}
                    </td>
                    {items.map((item) => (
                      <td
                        key={item.id}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center"
                      >
                        <div
                          className="text-lg font-black md:text-2xl"
                          style={{
                            color:
                              item.price === minPrice && items.length > 1
                                ? "#8ce2ae"
                                : "#ff3351",
                          }}
                        >
                          ₪{item.price.toLocaleString()}
                        </div>
                        {item.old_price && (
                          <div className="mt-1 text-xs text-[#6f6f7a] line-through">
                            ₪{item.old_price.toLocaleString()}
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-white/[0.02]">
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                      {t("detail.storage")}
                    </td>
                    {items.map((item) => (
                      <td
                        key={item.id}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center text-sm text-[#d9d9df]"
                      >
                        {item.storage_options?.length > 0
                          ? item.storage_options.join(" / ")
                          : "—"}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                      {lang === "ar" ? "الألوان" : "צבעים"}
                    </td>
                    {items.map((item) => (
                      <td
                        key={item.id}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center"
                      >
                        <div className="flex flex-wrap justify-center gap-2">
                          {(item.colors || []).slice(0, 5).map((color, index) => (
                            <span
                              key={`${item.id}-color-${index}`}
                              className="inline-block rounded-full border border-[#393943]"
                              style={{
                                width: 18,
                                height: 18,
                                background: color?.hex || "#888",
                              }}
                              title={getColorName(color, lang)}
                            />
                          ))}
                          {(!item.colors || item.colors.length === 0) && (
                            <span className="text-sm text-[#8f8f99]">—</span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {specKeyList.map((key, index) => (
                    <tr key={key} className={index % 2 === 0 ? "bg-white/[0.02]" : ""}>
                      <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                        {specLabels[key] || key}
                      </td>
                      {items.map((item) => (
                        <td
                          key={`${item.id}-${key}`}
                          className="border-b border-r border-[#2a2a32] px-4 py-4 text-center text-sm text-[#d9d9df]"
                        >
                          {item.specs?.[key] || "—"}
                        </td>
                      ))}
                    </tr>
                  ))}

                  <tr>
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]">
                      {intro.availability}
                    </td>
                    {items.map((item) => (
                      <td
                        key={`stock-${item.id}`}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center text-sm font-bold"
                      >
                        {item.stock > 0 ? (
                          <span className="text-[#8ce2ae]">
                            {lang === "ar" ? "متوفر" : "זמין"}
                          </span>
                        ) : (
                          <span className="text-[#ff8297]">{t("store.outOfStock")}</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-white/[0.02]">
                    <td className="border-b border-[#2a2a32] px-5 py-4 text-sm font-bold text-[#8f8f99]" />
                    {items.map((item) => (
                      <td
                        key={`action-${item.id}`}
                        className="border-b border-r border-[#2a2a32] px-4 py-4 text-center"
                      >
                        <button
                          type="button"
                          onClick={() => handleAddToCart(item)}
                          className="inline-flex min-h-[46px] w-full items-center justify-center rounded-full border border-[#ff0e34] px-4 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
                        >
                          {t("store.addToCart")}
                        </button>
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="px-5 py-4 text-sm font-bold text-[#8f8f99]" />
                    {items.map((item) => (
                      <td
                        key={`remove-${item.id}`}
                        className="border-r border-[#2a2a32] px-4 py-4 text-center"
                      >
                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="text-sm font-bold text-[#8f8f99] transition-colors hover:text-[#ff8297]"
                        >
                          {intro.remove}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );
}
