// =====================================================
// ClalMobile — Wishlist Store (Zustand)
// Persistent favorites/wishlist with localStorage
// =====================================================

"use client";

import { create } from "zustand";
import type { Product } from "@/types/database";

const STORAGE_KEY = "clal_wishlist";

export interface WishlistProduct {
  id: string;
  name_ar: string;
  name_he: string;
  brand: string;
  type: "device" | "accessory";
  price: number;
  old_price?: number;
  image_url?: string;
  stock: number;
  colors: any[];
  storage_options: string[];
  specs: Record<string, string>;
  featured: boolean;
  active: boolean;
  gallery: string[];
  description_ar?: string;
  description_he?: string;
  cost: number;
  sold: number;
  created_at: string;
  updated_at: string;
}

interface WishlistStore {
  items: WishlistProduct[];
  addItem: (product: Product) => void;
  removeItem: (productId: string) => void;
  clearAll: () => void;
  isInWishlist: (productId: string) => boolean;
  getCount: () => number;
}

function loadFromStorage(): WishlistProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: WishlistProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export const useWishlist = create<WishlistStore>((set, get) => ({
  items: loadFromStorage(),

  addItem: (product: Product) => {
    const current = get().items;
    if (current.some((i) => i.id === product.id)) return;

    const item: WishlistProduct = {
      id: product.id,
      name_ar: product.name_ar,
      name_he: product.name_he,
      brand: product.brand,
      type: product.type as "device" | "accessory",
      price: product.price,
      old_price: product.old_price,
      image_url: product.image_url,
      stock: product.stock,
      colors: product.colors || [],
      storage_options: product.storage_options || [],
      specs: product.specs || {},
      featured: product.featured,
      active: product.active,
      gallery: product.gallery || [],
      description_ar: product.description_ar,
      description_he: product.description_he,
      cost: product.cost,
      sold: product.sold,
      created_at: product.created_at,
      updated_at: product.updated_at,
    };

    const newItems = [...current, item];
    saveToStorage(newItems);
    set({ items: newItems });
  },

  removeItem: (productId: string) => {
    const newItems = get().items.filter((i) => i.id !== productId);
    saveToStorage(newItems);
    set({ items: newItems });
  },

  clearAll: () => {
    saveToStorage([]);
    set({ items: [] });
  },

  isInWishlist: (productId: string) => {
    return get().items.some((i) => i.id === productId);
  },

  getCount: () => get().items.length,
}));
