// =====================================================
// ClalMobile — Wishlist Page
// Grid display of favorite products
// =====================================================

"use client";

import Link from "next/link";
import { useWishlist } from "@/lib/store/wishlist";
import { useCart } from "@/lib/store/cart";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { StoreHeader } from "@/components/store/StoreHeader";
import { ProductCard } from "@/components/store/ProductCard";
import { getProductName } from "@/lib/utils";
import type { Product } from "@/types/database";

export default function WishlistPage() {
  const scr = useScreen();
  const { t } = useLang();
  const { items, removeItem, clearAll } = useWishlist();
  const addToCart = useCart((s) => s.addItem);

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

  if (items.length === 0) {
    return (
      <div dir="rtl" className="font-arabic bg-surface-bg text-white min-h-screen">
        <StoreHeader showBack />
        <div className="max-w-[1200px] mx-auto text-center" style={{ padding: scr.mobile ? "60px 16px" : "100px 24px" }}>
          <div style={{ fontSize: scr.mobile ? 48 : 64 }} className="mb-4">🤍</div>
          <h2 className="font-black mb-2" style={{ fontSize: scr.mobile ? 18 : 24 }}>
            {t("wishlist.emptyTitle")}
          </h2>
          <p className="text-muted mb-6" style={{ fontSize: scr.mobile ? 12 : 14 }}>
            {t("wishlist.emptyDesc")}
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
            ❤️ {t("wishlist.title")} ({items.length})
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={handleAddAllToCart}
              className="rounded-lg font-extrabold cursor-pointer transition-all text-white"
              style={{
                background: "#c41040",
                fontSize: scr.mobile ? 10 : 12,
                padding: scr.mobile ? "5px 12px" : "6px 16px",
                border: "none",
              }}
            >
              🛒 {t("wishlist.addAllToCart")}
            </button>
            <button
              onClick={clearAll}
              className="border border-surface-border bg-transparent text-muted rounded-lg cursor-pointer font-bold hover:text-white transition-colors"
              style={{ fontSize: scr.mobile ? 10 : 12, padding: "5px 12px" }}
            >
              🗑 {t("wishlist.clearAll")}
            </button>
          </div>
        </div>

        {/* Products grid */}
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: scr.mobile ? "1fr 1fr" : scr.tablet ? "1fr 1fr 1fr" : "1fr 1fr 1fr 1fr" }}
        >
          {items.map((item) => (
            <ProductCard key={item.id} product={item as unknown as Product} />
          ))}
        </div>
      </div>
    </div>
  );
}
