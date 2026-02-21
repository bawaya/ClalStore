// =====================================================
// ClalMobile — Compare Store (Zustand)
// Side-by-side product comparison (max 4)
// =====================================================

"use client";

import { create } from "zustand";
import type { Product } from "@/types/database";

const MAX_COMPARE = 4;
const STORAGE_KEY = "clal_compare";

export interface CompareProduct {
  id: string;
  name_ar: string;
  name_he: string;
  brand: string;
  type: "device" | "accessory";
  price: number;
  old_price?: number;
  image_url?: string;
  specs: Record<string, string>;
  stock: number;
  colors: any[];
  storage_options: string[];
}

interface CompareStore {
  items: CompareProduct[];
  addItem: (product: Product) => boolean; // returns false if at max
  removeItem: (productId: string) => void;
  clearAll: () => void;
  isInCompare: (productId: string) => boolean;
}

function loadFromStorage(): CompareProduct[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: CompareProduct[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {}
}

export const useCompare = create<CompareStore>((set, get) => ({
  items: loadFromStorage(),

  addItem: (product: Product) => {
    const current = get().items;
    if (current.length >= MAX_COMPARE) return false;
    if (current.some((i) => i.id === product.id)) return true; // already in

    const item: CompareProduct = {
      id: product.id,
      name_ar: product.name_ar,
      name_he: product.name_he,
      brand: product.brand,
      type: product.type as "device" | "accessory",
      price: product.price,
      old_price: product.old_price,
      image_url: product.image_url,
      specs: product.specs || {},
      stock: product.stock,
      colors: product.colors || [],
      storage_options: product.storage_options || [],
    };

    const newItems = [...current, item];
    saveToStorage(newItems);
    set({ items: newItems });
    return true;
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

  isInCompare: (productId: string) => {
    return get().items.some((i) => i.id === productId);
  },
}));
