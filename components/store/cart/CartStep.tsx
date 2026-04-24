"use client";

import { useRouter } from "next/navigation";
import { useScreen } from "@/lib/hooks";
import { useLang } from "@/lib/i18n";
import { useCart } from "@/lib/store/cart";

interface Props {
  couponInput: string;
  setCouponInput: (v: string) => void;
  onApplyCoupon: () => void;
  onNext: () => void;
}

export function CartStep({ couponInput, setCouponInput, onApplyCoupon, onNext }: Props) {
  const scr = useScreen();
  const { lang } = useLang();
  const router = useRouter();
  const items = useCart((s) => s.items);
  const subtotal = useCart((s) => s.getSubtotal());
  const total = useCart((s) => s.getTotal());
  const discountAmount = useCart((s) => s.discountAmount);
  const hasInstallmentItems = useCart((s) => s.hasInstallmentItems());
  const onlyAccessories = useCart((s) => s.hasOnlyAccessories());
  const removeItem = useCart((s) => s.removeItem);

  return (
    <div>
      <h2 className="font-black text-right mb-3" style={{ fontSize: scr.mobile ? 16 : 22 }}>
        🛒 السلة ({items.length})
      </h2>
      {items.length === 0 ? (
        <div className="text-center py-10 text-dim">
          <div className="text-4xl mb-2">🛒</div>
          <div className="text-sm mb-3">السلة فاضية</div>
          <button onClick={() => router.push("/store")} className="btn-outline">
            تصفّح المنتجات
          </button>
        </div>
      ) : (
        <>
          {items.map((item) => (
            <div
              key={item.cartId}
              className="glass-card-static flex justify-between items-center mb-2"
              style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
            >
              <button
                onClick={() => removeItem(item.cartId)}
                className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center"
                aria-label="حذف المنتج"
              >
                ✕
              </button>
              <div className="flex-1 text-right me-2">
                <div className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                  {lang === "he" ? (item.name_he || item.name) : item.name}
                </div>
                <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  {item.brand} • {
                    item.type === "device" ? "📱 جهاز"
                    : item.type === "appliance" ? "🏠 جهاز ذكي"
                    : item.type === "tv" ? "📺 تلفزيون"
                    : item.type === "computer" ? "💻 كمبيوتر"
                    : item.type === "tablet" ? "📱 تابلت"
                    : item.type === "network" ? "📡 راوتر"
                    : "🔌 إكسسوار"
                  }
                  {item.color && ` • ${lang === "he" ? (item.color_he || item.color) : item.color}`}
                  {item.storage && ` • ${item.storage}`}
                </div>
              </div>
              <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                ₪{item.price.toLocaleString()}
              </span>
            </div>
          ))}

          {/* Coupon */}
          <div className="flex gap-1.5 mt-3 mb-2">
            <button
              onClick={onApplyCoupon}
              className="btn-primary px-3 py-2 rounded-xl text-xs font-bold cursor-pointer flex-shrink-0"
            >
              تطبيق
            </button>
            <input
              className="input"
              placeholder="🏷️ كوبون خصم..."
              value={couponInput}
              onChange={(e) => setCouponInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onApplyCoupon()}
              aria-label="كود الخصم"
            />
          </div>
          {discountAmount > 0 && (
            <div
              className="glass-elevated rounded-[10px] p-2 mb-2 text-state-success text-right"
              style={{ fontSize: scr.mobile ? 10 : 12 }}
            >
              🎉 خصم: -₪{discountAmount}
            </div>
          )}
          {hasInstallmentItems && (
            <div
              className="glass-elevated rounded-xl p-2.5 mb-2 text-state-info text-right"
              style={{ fontSize: scr.mobile ? 9 : 11 }}
            >
              📋 سلتك تحتوي جهاز — يخضع لفحص الفريق + ستحتاج هوية وبيانات بنك
            </div>
          )}
          {onlyAccessories && (
            <div
              className="glass-elevated rounded-xl p-2.5 mb-2 text-state-success text-right"
              style={{ fontSize: scr.mobile ? 9 : 11 }}
            >
              ⚡ إكسسوارات فقط — دفع مباشر بالبطاقة
            </div>
          )}

          {/* Total */}
          <div className="glass-card-static mt-2" style={{ padding: scr.mobile ? 14 : 20 }}>
            <div className="flex justify-between mb-1">
              <span className="text-muted text-xs">₪{subtotal.toLocaleString()}</span>
              <span className="text-muted text-xs">المنتجات</span>
            </div>
            {discountAmount > 0 && (
              <div className="flex justify-between mb-1">
                <span className="text-state-success text-xs">-₪{discountAmount}</span>
                <span className="text-state-success text-xs">خصم</span>
              </div>
            )}
            <div className="flex justify-between mb-1">
              <span className="text-muted text-xs">مجاناً</span>
              <span className="text-muted text-xs">التوصيل</span>
            </div>
            <div className="border-t border-surface-border pt-2 flex justify-between">
              <span className="font-black text-state-success" style={{ fontSize: scr.mobile ? 20 : 26 }}>
                ₪{total.toLocaleString()}
              </span>
              <span className="font-bold" style={{ fontSize: scr.mobile ? 14 : 16 }}>
                المجموع
              </span>
            </div>
            <button onClick={onNext} className="btn-primary w-full mt-3">
              المتابعة للشراء →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
