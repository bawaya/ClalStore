"use client";

import dynamic from "next/dynamic";

// Client-side chrome mounts. Lives in a client component so we can use
// `dynamic({ ssr: false })` — required because TopPromoBar/StickyCartBar
// touch document.body via ResizeObserver and PublicChrome reads usePathname.
//
// Next.js 15 forbids `ssr: false` inside Server Components, so we collect
// these mounts here and call them from app/layout.tsx (a Server Component)
// as a single client island.

const PublicChrome = dynamic(() => import("@/components/shared/PublicChrome"), { ssr: false });
const TopPromoBar = dynamic(() => import("@/components/website/TopPromoBar"), { ssr: false });
const StickyCartBar = dynamic(
  () => import("@/components/store/StickyCartBar").then((m) => ({ default: m.StickyCartBar })),
  { ssr: false }
);
const WebChatWidget = dynamic(
  () => import("@/components/chat/WebChatWidget").then((m) => ({ default: m.WebChatWidget })),
  { ssr: false }
);

// DOM order matters: TopPromoBar mounts BEFORE StickyCartBar so --top-promo-h
// is set first, minimizing initial-load layout flash.
export function ChromeMountsTop() {
  return (
    <PublicChrome>
      <TopPromoBar />
      <StickyCartBar variant="top" />
    </PublicChrome>
  );
}

export function ChromeMountsBottom() {
  return (
    <PublicChrome>
      <WebChatWidget />
    </PublicChrome>
  );
}
