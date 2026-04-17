import { describe, it, expect, beforeEach, vi } from "vitest";
import { useCart, type CartItem } from "@/lib/store/cart";

const mockStorage: Record<string, string> = {};

vi.stubGlobal("localStorage", {
  getItem: vi.fn((key: string) => mockStorage[key] ?? null),
  setItem: vi.fn((key: string, value: string) => {
    mockStorage[key] = value;
  }),
  removeItem: vi.fn((key: string) => {
    delete mockStorage[key];
  }),
  clear: vi.fn(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  }),
});

vi.stubGlobal("fetch", vi.fn(() => Promise.resolve({ ok: true })));

function makeItem(overrides: Partial<Omit<CartItem, "cartId" | "quantity">> = {}): Omit<CartItem, "cartId" | "quantity"> {
  return {
    productId: "p1",
    name: "iPhone 15",
    brand: "Apple",
    type: "device",
    price: 3499,
    ...overrides,
  };
}

describe("Cart Store", () => {
  beforeEach(() => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
    useCart.setState({ items: [], couponCode: "", discountAmount: 0 });
  });

  describe("addItem", () => {
    it("adds an item with quantity 1 and a unique cartId", () => {
      const store = useCart.getState();
      store.addItem(makeItem());

      const items = useCart.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].quantity).toBe(1);
      expect(items[0].cartId).toMatch(/^cart_/);
      expect(items[0].productId).toBe("p1");
      expect(items[0].name).toBe("iPhone 15");
    });

    it("generates unique cartIds for multiple items", () => {
      const store = useCart.getState();
      store.addItem(makeItem({ productId: "p1" }));
      store.addItem(makeItem({ productId: "p2", name: "Galaxy S24" }));

      const items = useCart.getState().items;
      expect(items).toHaveLength(2);
      expect(items[0].cartId).not.toBe(items[1].cartId);
    });

    it("is configured with persist middleware for localStorage", () => {
      // Verify persist middleware is active and uses correct storage key
      expect((useCart as unknown as { persist?: unknown }).persist).toBeDefined();
      expect((useCart as unknown as { persist: { getOptions: () => { name: string } } }).persist.getOptions().name).toBe("clal_cart");
    });
  });

  describe("removeItem", () => {
    it("removes an item by cartId", () => {
      useCart.getState().addItem(makeItem());
      const cartId = useCart.getState().items[0].cartId;

      useCart.getState().removeItem(cartId);
      expect(useCart.getState().items).toHaveLength(0);
    });

    it("does not remove unrelated items", () => {
      useCart.getState().addItem(makeItem({ productId: "p1" }));
      useCart.getState().addItem(makeItem({ productId: "p2" }));
      const cartId = useCart.getState().items[0].cartId;

      useCart.getState().removeItem(cartId);
      const items = useCart.getState().items;
      expect(items).toHaveLength(1);
      expect(items[0].productId).toBe("p2");
    });
  });

  describe("updateQuantity", () => {
    it("updates the quantity of an item", () => {
      useCart.getState().addItem(makeItem());
      const cartId = useCart.getState().items[0].cartId;

      useCart.getState().updateQuantity(cartId, 5);
      expect(useCart.getState().items[0].quantity).toBe(5);
    });

    it("removes the item when quantity is set to 0", () => {
      useCart.getState().addItem(makeItem());
      const cartId = useCart.getState().items[0].cartId;

      useCart.getState().updateQuantity(cartId, 0);
      expect(useCart.getState().items).toHaveLength(0);
    });

    it("removes the item when quantity is negative", () => {
      useCart.getState().addItem(makeItem());
      const cartId = useCart.getState().items[0].cartId;

      useCart.getState().updateQuantity(cartId, -1);
      expect(useCart.getState().items).toHaveLength(0);
    });
  });

  describe("clearCart", () => {
    it("resets items, couponCode, and discountAmount", () => {
      useCart.getState().addItem(makeItem());
      useCart.getState().applyCoupon("SAVE10", 10);

      useCart.getState().clearCart();

      const state = useCart.getState();
      expect(state.items).toHaveLength(0);
      expect(state.couponCode).toBe("");
      expect(state.discountAmount).toBe(0);
    });
  });

  describe("applyCoupon / clearCoupon", () => {
    it("applies a coupon code and discount", () => {
      useCart.getState().applyCoupon("SAVE50", 50);

      const state = useCart.getState();
      expect(state.couponCode).toBe("SAVE50");
      expect(state.discountAmount).toBe(50);
    });

    it("clears coupon code and discount", () => {
      useCart.getState().applyCoupon("SAVE50", 50);
      useCart.getState().clearCoupon();

      const state = useCart.getState();
      expect(state.couponCode).toBe("");
      expect(state.discountAmount).toBe(0);
    });
  });

  describe("getItemCount", () => {
    it("returns 0 for empty cart", () => {
      expect(useCart.getState().getItemCount()).toBe(0);
    });

    it("sums quantities across all items", () => {
      useCart.getState().addItem(makeItem({ productId: "p1" }));
      useCart.getState().addItem(makeItem({ productId: "p2" }));
      useCart.getState().updateQuantity(useCart.getState().items[0].cartId, 3);

      expect(useCart.getState().getItemCount()).toBe(4);
    });
  });

  describe("getSubtotal", () => {
    it("returns 0 for empty cart", () => {
      expect(useCart.getState().getSubtotal()).toBe(0);
    });

    it("calculates price * quantity for all items", () => {
      useCart.getState().addItem(makeItem({ price: 100 }));
      useCart.getState().addItem(makeItem({ price: 200 }));
      useCart.getState().updateQuantity(useCart.getState().items[0].cartId, 2);

      expect(useCart.getState().getSubtotal()).toBe(400);
    });
  });

  describe("getTotal", () => {
    it("returns subtotal when no discount", () => {
      useCart.getState().addItem(makeItem({ price: 100 }));
      expect(useCart.getState().getTotal()).toBe(100);
    });

    it("subtracts discount from subtotal", () => {
      useCart.getState().addItem(makeItem({ price: 100 }));
      useCart.getState().applyCoupon("CODE", 30);

      expect(useCart.getState().getTotal()).toBe(70);
    });

    it("never goes below 0", () => {
      useCart.getState().addItem(makeItem({ price: 10 }));
      useCart.getState().applyCoupon("BIG", 999);

      expect(useCart.getState().getTotal()).toBe(0);
    });
  });

  describe("hasDevices", () => {
    it("returns false for empty cart", () => {
      expect(useCart.getState().hasDevices()).toBe(false);
    });

    it("returns true when cart has a device", () => {
      useCart.getState().addItem(makeItem({ type: "device" }));
      expect(useCart.getState().hasDevices()).toBe(true);
    });

    it("returns false when cart has only accessories", () => {
      useCart.getState().addItem(makeItem({ type: "accessory" }));
      expect(useCart.getState().hasDevices()).toBe(false);
    });
  });

  describe("hasOnlyAccessories", () => {
    it("returns false for empty cart", () => {
      expect(useCart.getState().hasOnlyAccessories()).toBe(false);
    });

    it("returns true when all items are accessories", () => {
      useCart.getState().addItem(makeItem({ type: "accessory", productId: "a1" }));
      useCart.getState().addItem(makeItem({ type: "accessory", productId: "a2" }));
      expect(useCart.getState().hasOnlyAccessories()).toBe(true);
    });

    it("returns false when cart contains a device", () => {
      useCart.getState().addItem(makeItem({ type: "accessory" }));
      useCart.getState().addItem(makeItem({ type: "device" }));
      expect(useCart.getState().hasOnlyAccessories()).toBe(false);
    });
  });
});
