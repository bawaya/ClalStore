// =====================================================
// ClalMobile — Cart Store (Zustand)
// Persistent cart state across pages
// =====================================================

import { create } from "zustand";

export interface CartItem {
  cartId: string;
  productId: string;
  name: string;
  brand: string;
  type: "device" | "accessory";
  price: number;
  image?: string;
  color?: string;
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

export const useCart = create<CartStore>((set, get) => ({
  items: [],
  couponCode: "",
  discountAmount: 0,

  addItem: (item) => {
    const cartId = `cart_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    set((state) => ({
      items: [...state.items, { ...item, cartId, quantity: 1 }],
    }));
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
        i.cartId === cartId ? { ...i, quantity } : i
      ),
    }));
  },

  clearCart: () => {
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

  hasOnlyAccessories: () => {
    const items = get().items;
    return items.length > 0 && items.every((i) => i.type === "accessory");
  },
}));
