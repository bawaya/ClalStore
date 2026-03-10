// =====================================================
// ClalMobile — Cart Store (Zustand)
// Persistent cart state across pages
// =====================================================

import { create } from "zustand";

const CART_STORAGE_KEY = "clal_cart";

function loadCartFromStorage(): { items: CartItem[]; couponCode: string; discountAmount: number } {
  if (typeof window === "undefined") return { items: [], couponCode: "", discountAmount: 0 };
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return { items: [], couponCode: "", discountAmount: 0 };
    const parsed = JSON.parse(raw);
    return {
      items: Array.isArray(parsed.items) ? parsed.items : [],
      couponCode: parsed.couponCode || "",
      discountAmount: parsed.discountAmount || 0,
    };
  } catch {
    return { items: [], couponCode: "", discountAmount: 0 };
  }
}

function saveCartToStorage(items: CartItem[], couponCode: string, discountAmount: number) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items, couponCode, discountAmount }));
  } catch {}
}

export interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  name_he?: string;        // Hebrew name for language switching
  brand: string;
  type: "device" | "accessory";
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
  hasOnlyAccessories: () => boolean;
}

const _initial = loadCartFromStorage();

export const useCart = create<CartStore>((set, get) => ({
  items: _initial.items,
  couponCode: _initial.couponCode,
  discountAmount: _initial.discountAmount,

  addItem: (item) => {
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => {
      const newItems = [...state.items, { ...item, cartId, quantity: 1 }];
      saveCartToStorage(newItems, state.couponCode, state.discountAmount);
      _trackAbandonedCart(newItems);
      return { items: newItems };
    });
  },

  removeItem: (cartId) => {
    set((state) => {
      const newItems = state.items.filter((i) => i.cartId !== cartId);
      saveCartToStorage(newItems, state.couponCode, state.discountAmount);
      return { items: newItems };
    });
  },

  updateQuantity: (cartId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(cartId);
      return;
    }
    set((state) => {
      const newItems = state.items.map((i) =>
        i.cartId === cartId ? { ...i, quantity } : i
      );
      saveCartToStorage(newItems, state.couponCode, state.discountAmount);
      return { items: newItems };
    });
  },

  clearCart: () => {
    _markCartRecovered();
    saveCartToStorage([], "", 0);
    set({ items: [], couponCode: "", discountAmount: 0 });
  },

  applyCoupon: (code, discount) => {
    const state = get();
    saveCartToStorage(state.items, code, discount);
    set({ couponCode: code, discountAmount: discount });
  },

  clearCoupon: () => {
    const state = get();
    saveCartToStorage(state.items, "", 0);
    set({ couponCode: "", discountAmount: 0 });
  },

  getItemCount: () => get().items.reduce((s, i) => s + i.quantity, 0),

  getSubtotal: () =>
    get().items.reduce((s, i) => s + i.price * i.quantity, 0),

  getTotal: () => Math.max(0, get().getSubtotal() - get().discountAmount),

  hasDevices: () => get().items.some((i) => i.type === "device"),

  hasOnlyAccessories: () => {
    const items = get().items;
    return items.length > 0 && items.every((i) => i.type === "accessory");
  },
}));

// ===== Abandoned Cart Tracking (debounced, fire-and-forget) =====
let _abandonedCartTimer: ReturnType<typeof setTimeout> | null = null;

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
  if (_abandonedCartTimer) clearTimeout(_abandonedCartTimer);
  _abandonedCartTimer = setTimeout(() => {
    try {
      const total = items.reduce((s, i) => s + i.price * i.quantity, 0);
      fetch("/api/cart/abandoned", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
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
  }, 3000);
}

function _markCartRecovered() {
  if (typeof window === "undefined") return;
  try {
    fetch(`/api/cart/abandoned?visitor_id=${_getVisitorId()}`, { method: "DELETE" }).catch(() => {});
  } catch {}
}
