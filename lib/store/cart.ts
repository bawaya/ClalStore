// =====================================================
// ClalMobile — Cart Store (Zustand)
// Persistent cart state across pages
// =====================================================

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  name_he?: string;        // Hebrew name for language switching
  brand: string;
  type: "device" | "accessory" | "appliance" | "tv" | "computer" | "tablet" | "network";
  price: number;
  image?: string;
  color?: string;
  color_he?: string;       // Hebrew color name for language switching
  storage?: string;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  couponCode: string;
  discountAmount: number;

  // Actions
  addItem: (item: Omit<CartItem, "cartId" | "quantity">) => void;
  removeItem: (cartId: string) => void;
  updateQuantity: (cartId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string, discount: number) => void;
  clearCoupon: () => void;

  // Computed
  getItemCount: () => number;
  getSubtotal: () => number;
  getTotal: () => number;
  hasDevices: () => boolean;
  hasAppliances: () => boolean;
  /**
   * True if the cart contains any big-ticket item that should go through the
   * bank-transfer + installment checkout flow. Mirrors the mobile device flow
   * for appliances so the customer experience is identical.
   */
  hasInstallmentItems: () => boolean;
  hasOnlyAccessories: () => boolean;
}

export const useCart = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      couponCode: "",
      discountAmount: 0,

      addItem: (item) => {
        const cartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
        set((state) => {
          const newItems = [...state.items, { ...item, cartId, quantity: 1 }];
          // Fire-and-forget: save abandoned cart to API
          _trackAbandonedCart(newItems);
          return { items: newItems };
        });
      },

      removeItem: (cartId) => {
        set((state) => ({
          items: state.items.filter((i) => i.cartId !== cartId),
        }));
      },

      updateQuantity: (cartId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(cartId);
          return;
        }
        set((state) => ({
          items: state.items.map((i) =>
            i.cartId === cartId ? { ...i, quantity } : i,
          ),
        }));
      },

      clearCart: () => {
        // Mark cart as recovered when user clears (checkout complete)
        _markCartRecovered();
        set({ items: [], couponCode: "", discountAmount: 0 });
      },

      applyCoupon: (code, discount) => {
        set({ couponCode: code, discountAmount: discount });
      },

      clearCoupon: () => {
        set({ couponCode: "", discountAmount: 0 });
      },

      getItemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),

      getSubtotal: () =>
        get().items.reduce((s, i) => s + i.price * i.quantity, 0),

      getTotal: () => Math.max(0, get().getSubtotal() - get().discountAmount),

      hasDevices: () => get().items.some((i) => i.type === "device"),

      hasAppliances: () => get().items.some((i) => i.type === "appliance"),

      // Bank-transfer + ID-required flow applies to anything that's not a pure accessory.
      // TV/computer/tablet/appliance/device all use the same checkout experience.
      hasInstallmentItems: () =>
        get().items.some((i) => i.type !== "accessory"),

      hasOnlyAccessories: () => {
        const items = get().items;
        return items.length > 0 && items.every((i) => i.type === "accessory");
      },
    }),
    {
      name: "clal_cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        items: state.items,
        couponCode: state.couponCode,
        discountAmount: state.discountAmount,
      }),
    },
  ),
);

// ===== Abandoned Cart Tracking (fire-and-forget) =====
function _abandonedCartHeaders(): Record<string, string> {
  if (typeof document === "undefined") {
    return { "Content-Type": "application/json" };
  }
  const match = document.cookie.match(/(?:^|; )csrf_token=([^;]*)/);
  const token = match ? match[1] : "";
  return {
    "Content-Type": "application/json",
    "x-csrf-token": token,
  };
}

function _getVisitorId(): string {
  if (typeof window === "undefined") return "server";
  let id = localStorage.getItem("clal_visitor_id");
  if (!id) {
    id = `v_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    localStorage.setItem("clal_visitor_id", id);
  }
  return id;
}

function _trackAbandonedCart(items: CartItem[]) {
  if (typeof window === "undefined" || items.length === 0) return;
  try {
    const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
    fetch("/api/cart/abandoned", {
      method: "POST",
      headers: _abandonedCartHeaders(),
      body: JSON.stringify({
        visitor_id: _getVisitorId(),
        items: items.map((i) => ({
          productId: i.productId,
          name: i.name,
          brand: i.brand,
          price: i.price,
          quantity: i.quantity,
          color: i.color,
          storage: i.storage,
        })),
        total,
      }),
    }).catch(() => {});
  } catch {}
}

function _markCartRecovered() {
  if (typeof window === "undefined") return;
  try {
    fetch(`/api/cart/abandoned?visitor_id=${encodeURIComponent(_getVisitorId())}`, {
      method: "DELETE",
      headers: _abandonedCartHeaders(),
    }).catch(() => {});
  } catch {}
}
