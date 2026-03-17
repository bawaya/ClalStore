// =====================================================
// ClalMobile — Shared Hooks
// useScreen (responsive) + useToast + useDebounce
// =====================================================

"use client";

import { useState, useEffect, useCallback } from "react";

// ===== useScreen — Responsive breakpoints =====
// القاعدة الثابتة:
// mobile: < 768px  → Tabs nav + single column
// tablet: 768-1023 → Flexible grid (2-3 cols)
// desktop: ≥ 1024  → Sidebar nav + wide grid (3-4 cols)

export interface ScreenInfo {
  mobile: boolean;
  tablet: boolean;
  desktop: boolean;
  width: number;
}

export function useScreen(): ScreenInfo {
  // Always start with 1024 (desktop) — matches SSR to avoid hydration mismatch
  const [width, setWidth] = useState(1024);

  useEffect(() => {
    // Set actual width after mount
    setWidth(window.innerWidth);
    const handleResize = () => setWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    mobile: width < 768,
    tablet: width >= 768 && width < 1024,
    desktop: width >= 1024,
    width,
  };
}

// ===== useToast — Toast notifications =====
export interface Toast {
  id: string;
  message: string;
  type: "success" | "error" | "warning" | "info";
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const show = useCallback(
    (message: string, type: Toast["type"] = "success", duration = 2500) => {
      const id = Date.now().toString();
      setToasts((prev) => [...prev, { id, message, type }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    },
    []
  );

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return { toasts, show, dismiss };
}

// ===== useDebounce — Debounced value =====
export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

// ===== useLocalStorage =====
export function useLocalStorage<T>(key: string, initialValue: T) {
  // Always start with initialValue for SSR/hydration consistency
  const [value, setValue] = useState<T>(initialValue);
  const [hasHydrated, setHasHydrated] = useState(false);

  // Hydrate from localStorage after mount
  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) setValue(JSON.parse(item));
    } catch {}
    setHasHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Persist changes after hydration
  useEffect(() => {
    if (!hasHydrated) return;
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }, [key, value, hasHydrated]);

  return [value, setValue] as const;
}
