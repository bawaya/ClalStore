// =====================================================
// ClalMobile — Utilities
// General helper functions
// =====================================================

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// ===== Tailwind class merger =====
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ===== Currency formatter =====
export function formatCurrency(amount: number): string {
  return `₪${amount.toLocaleString()}`;
}

export function formatCurrencyCompact(amount: number): string {
  if (amount >= 1000000) return `₪${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `₪${(amount / 1000).toFixed(0)}K`;
  return `₪${amount}`;
}

// ===== Date formatters =====
export function formatDate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleDateString("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return d.toLocaleTimeString("ar-EG", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(date: string | Date): string {
  return `${formatDate(date)} ${formatTime(date)}`;
}

export function timeAgo(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "الآن";
  if (mins < 60) return `${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} يوم`;
  return formatDate(d);
}

// ===== Percentage =====
export function calcMargin(price: number, cost: number): number {
  if (price <= 0) return 0;
  return Math.round(((price - cost) / price) * 100);
}

export function calcDiscount(price: number, oldPrice: number): number {
  if (oldPrice <= 0) return 0;
  return Math.round(((oldPrice - price) / oldPrice) * 100);
}

// ===== String helpers =====
export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "...";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("");
}

// ===== Array helpers =====
export function groupBy<T>(arr: T[], key: keyof T): Record<string, T[]> {
  return arr.reduce(
    (groups, item) => {
      const k = String(item[key]);
      (groups[k] = groups[k] || []).push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

// ===== Sleep =====
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ===== Bilingual product helpers =====
type Lang = "ar" | "he";

/** Get product name based on language. Fallback: name_ar (English device names) */
export function getProductName(p: { name_ar: string; name_he?: string }, lang: Lang): string {
  if (lang === "he" && p.name_he) return p.name_he;
  return p.name_ar;
}

/** Get color name based on language */
export function getColorName(c: { name_ar: string; name_he?: string }, lang: Lang): string {
  if (lang === "he" && c.name_he) return c.name_he;
  return c.name_ar;
}

/** Get description based on language */
export function getDescription(p: { description_ar?: string; description_he?: string }, lang: Lang): string {
  if (lang === "he" && p.description_he) return p.description_he;
  return p.description_ar || "";
}
