"use client";

import Link from "next/link";
import { Footer } from "@/components/website/sections";
import { ProductCard } from "@/components/store/ProductCard";
import { StoreHeader } from "@/components/store/StoreHeader";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";
import { useWishlist } from "@/lib/store/wishlist";
import type { Product } from "@/types/database";

export default function WishlistPage() {
  const scr = useScreen();
  const { t, lang } = useLang();
  const { items, clearAll } = useWishlist();
  const addToCart = useCart((state) => state.addItem);

  const handleAddAllToCart = () => {
    items.forEach((item) => {
      addToCart({
        productId: item.id,
        name: item.name_ar,
        name_he: item.name_he || undefined,
        brand: item.brand,
        type: item.type,
        price: item.price,
        image: item.image_url || undefined,
      });
    });
  };

  const intro =
    lang === "he"
      ? {
          badge: "מועדפים שמורים",
          title: "רשימת בחירות מסודרת ונקייה",
          subtitle:
            "שמרו כאן את המכשירים והאביזרים שתרצו לחזור אליהם, והשוו אותם אחר כך בלחיצה אחת.",
          count: "מוצרים שמורים",
          action: "העבר הכל לסל",
          clear: "נקה הכל",
        }
      : {
          badge: "منتجات محفوظة",
          title: "قائمة مفضلة مرتبة وواضحة",
          subtitle:
            "احتفظ هنا بالأجهزة والإكسسوارات التي تريد الرجوع إليها لاحقًا أو إضافتها إلى السلة دفعة واحدة.",
          count: "منتجات محفوظة",
          action: "إضافة الكل إلى السلة",
          clear: "مسح الكل",
        };

  const pageShell = (
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
                  {items.filter((item) => item.type === "device").length}
                </strong>
                <span className="text-sm text-[#b8b8c2]">
                  {lang === "he" ? "מכשירים" : "أجهزة"}
                </span>
              </div>
            </div>
          </div>
        </section>

        {items.length === 0 ? (
          <section className="rounded-[30px] border border-[#2d2d35] bg-[linear-gradient(180deg,#17171b_0%,#111115_100%)] px-6 py-16 text-center shadow-[0_24px_48px_rgba(0,0,0,0.24)]">
            <div className="text-5xl">♡</div>
            <h2 className="mt-4 text-xl font-black text-white md:text-2xl">
              {t("wishlist.emptyTitle")}
            </h2>
            <p className="mt-3 text-sm leading-8 text-[#b8b8c2] md:text-base">
              {t("wishlist.emptyDesc")}
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
                    {lang === "he" ? "גישה מהירה" : "وصول سريع"}
                  </span>
                  <p className="mt-3 text-sm leading-8 text-[#b8b8c2]">
                    {lang === "he"
                      ? "כאן תמצאו את כל המוצרים ששמרתם, עם אפשרות להעביר את כולם ישירות לסל."
                      : "هنا تجد كل المنتجات التي حفظتها، مع إمكانية نقلها كلها مباشرة إلى السلة."}
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleAddAllToCart}
                    className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-[#ff0e34] px-5 text-sm font-bold text-[#ff6b82] transition-colors hover:bg-[#ff0e34]/10"
                  >
                    {intro.action}
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

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {items.map((item) => (
                <ProductCard key={item.id} product={item as unknown as Product} />
              ))}
            </div>
          </>
        )}
      </div>

      <Footer />
    </div>
  );

  return pageShell;
}
