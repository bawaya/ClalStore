import {
  trackViewProduct,
  trackAddToCart,
  trackRemoveFromCart,
  trackBeginCheckout,
  trackPurchaseWithItems,
  trackSearch,
} from "@/components/shared/Analytics";

interface ProductInfo {
  name_ar: string;
  price: number;
}

export function onProductView(product: ProductInfo) {
  trackViewProduct(product.name_ar, product.price);
}

export function onAddToCart(product: ProductInfo) {
  trackAddToCart(product.name_ar, product.price);
}

export function onRemoveFromCart(product: ProductInfo) {
  trackRemoveFromCart(product.name_ar, product.price);
}

export function onCheckoutStart(total: number, items: { name_ar: string; price: number; quantity: number }[]) {
  trackBeginCheckout(
    total,
    items.map((i) => ({ item_name: i.name_ar, price: i.price, quantity: i.quantity })),
  );
}

export function onPurchaseComplete(
  orderId: string,
  total: number,
  items: { name_ar: string; price: number; quantity: number }[],
) {
  trackPurchaseWithItems(
    orderId,
    total,
    items.map((i) => ({ item_name: i.name_ar, price: i.price, quantity: i.quantity })),
  );
}

export function onSearch(term: string, count: number) {
  trackSearch(term, count);
}
