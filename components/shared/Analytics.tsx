"use client";

// =====================================================
// ClalMobile — Analytics Script Injection
// Google Analytics 4 + Meta (Facebook) Pixel
// Reads settings from DB — no hardcoded IDs
// =====================================================

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    fbq?: (...args: unknown[]) => void;
    dataLayer?: unknown[];
    _fbq?: unknown;
  }
}

import { useEffect, useState } from "react";
import Script from "next/script";

export function Analytics() {
  const [gaId, setGaId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/public");
        const json = await res.json();
        const inner = json.data ?? json;
        const settings = inner.settings || {};

        setEnabled(true);
        if (settings.ga_measurement_id) setGaId(settings.ga_measurement_id);
        if (settings.meta_pixel_id) setPixelId(settings.meta_pixel_id);
      } catch {}
    }
    loadSettings();
  }, []);

  if (!enabled) return null;

  return (
    <>
      {/* Google Analytics 4 */}
      {gaId && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              gtag('js', new Date());
              gtag('config', '${gaId}', {
                page_path: window.location.pathname,
                send_page_view: true,
              });
            `}
          </Script>
        </>
      )}

      {/* Meta (Facebook) Pixel */}
      {pixelId && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`
            !function(f,b,e,v,n,t,s)
            {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
            n.callMethod.apply(n,arguments):n.queue.push(arguments)};
            if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
            n.queue=[];t=b.createElement(e);t.async=!0;
            t.src=v;s=b.getElementsByTagName(e)[0];
            s.parentNode.insertBefore(t,s)}(window, document,'script',
            'https://connect.facebook.net/en_US/fbevents.js');
            fbq('init', '${pixelId}');
            fbq('track', 'PageView');
          `}
        </Script>
      )}
    </>
  );
}

// ===== Analytics Event Helpers =====
// Map GA4 event names to Meta Pixel standard events
const GA4_TO_META: Record<string, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  search: "Search",
};

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  // GA4
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
  // Meta Pixel — use standard event name
  if (typeof window !== "undefined" && window.fbq) {
    const metaEvent = GA4_TO_META[eventName];
    if (metaEvent) {
      window.fbq("track", metaEvent, params);
    } else {
      window.fbq("trackCustom", eventName, params);
    }
  }
}

export function trackPurchase(value: number, currency: string = "ILS", orderId?: string) {
  trackEvent("purchase", { value, currency, transaction_id: orderId });
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Purchase", { value, currency });
  }
}

export function trackAddToCart(productName: string, price: number) {
  trackEvent("add_to_cart", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "AddToCart", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackViewProduct(productName: string, price: number) {
  trackEvent("view_item", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "ViewContent", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackBeginCheckout(
  value: number,
  items: { item_name: string; price: number; quantity: number }[],
) {
  trackEvent("begin_checkout", { value, currency: "ILS", items });
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "InitiateCheckout", { value, currency: "ILS" });
  }
}

export function trackPurchaseWithItems(
  orderId: string,
  value: number,
  items: { item_name: string; price: number; quantity: number }[],
) {
  trackPurchase(value, "ILS", orderId);
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: orderId,
      value,
      currency: "ILS",
      items: items.map((i) => ({ item_name: i.item_name, price: i.price, quantity: i.quantity })),
    });
  }
}

export function trackSearch(searchTerm: string, resultsCount: number) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "search", { search_term: searchTerm, results_count: resultsCount });
  }
  if (typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Search", { search_string: searchTerm, content_category: "store" });
  }
}

export function trackRemoveFromCart(productName: string, price: number) {
  if (typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "remove_from_cart", {
      items: [{ item_name: productName, price, currency: "ILS" }],
      value: price,
      currency: "ILS",
    });
  }
}
