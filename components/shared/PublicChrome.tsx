"use client";

import { usePathname } from "next/navigation";

// Routes where we DO NOT want public chrome (TopPromoBar / StickyCartBar / WebChatWidget):
// - Internal staff areas (admin, CRM, sales-pwa, mobile inbox)
// - Auth flow (focused login experience)
const HIDE_PREFIXES = [
  "/admin",
  "/crm",
  "/sales-pwa",
  "/m",
  "/login",
  "/forgot-password",
  "/reset-password",
];

export default function PublicChrome({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  // SSR-safe: pathname is null on first render. Treat null as "show" so customer-facing
  // pages don't blank out during hydration; staff pages briefly show chrome then hide it
  // — acceptable because staff sessions don't typically land on cold renders.
  const hide = path ? HIDE_PREFIXES.some((p) => path.startsWith(p)) : false;
  if (hide) return null;
  return <>{children}</>;
}
