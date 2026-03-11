"use client";

// =====================================================
// ClalMobile — Analytics Script Injection
// Google Analytics 4 + Meta (Facebook) Pixel
// Reads settings from DB — no hardcoded IDs
// =====================================================

import { useEffect, useState } from "react";
import Script from "next/script";

export function Analytics() {
  const [gaId, setGaId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("clal_cookie_consent");
    if (consent !== "accepted") return;

    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        const settings = json.settings || {};

        if (settings.feature_analytics !== "true") return;

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
export function trackEvent(eventName: string, params?: Record<string, any>) {
  // GA4
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, params);
  }
  // Meta Pixel
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", eventName, params);
  }
}

export function trackPurchase(value: number, currency: string = "ILS", orderId?: string) {
  trackEvent("purchase", { value, currency, transaction_id: orderId });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "Purchase", { value, currency });
  }
}

export function trackAddToCart(productName: string, price: number) {
  trackEvent("add_to_cart", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "AddToCart", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackViewProduct(productName: string, price: number) {
  trackEvent("view_item", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "ViewContent", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackBeginCheckout(value: number, items: { item_name: string; price: number; quantity: number }[]) {
  trackEvent("begin_checkout", { value, currency: "ILS", items });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "InitiateCheckout", { value, currency: "ILS" });
  }
}

export function trackPurchaseWithItems(orderId: string, value: number, items: { item_name: string; price: number; quantity: number }[]) {
  trackPurchase(value, "ILS", orderId);
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "purchase", {
      transaction_id: orderId,
      value,
      currency: "ILS",
      items: items.map((i) => ({ item_name: i.item_name, price: i.price, quantity: i.quantity })),
    });
  }
}

export function trackSearch(searchTerm: string, resultsCount: number) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "search", { search_term: searchTerm, results_count: resultsCount });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "Search", { search_string: searchTerm, content_category: "store" });
  }
}

export function trackSelectItem(productName: string, price: number, listName?: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "select_item", {
      item_list_name: listName,
      items: [{ item_name: productName, price, currency: "ILS" }],
    });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "ViewContent", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackViewItemList(listName: string, items: { item_name: string; price: number }[]) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "view_item_list", {
      item_list_name: listName,
      items: items.map((i) => ({ item_name: i.item_name, price: i.price, currency: "ILS" })),
    });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "ViewContent", { content_category: listName, content_type: "product_group" });
  }
}

export function trackRemoveFromCart(productName: string, price: number) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "remove_from_cart", {
      items: [{ item_name: productName, price, currency: "ILS" }],
      value: price,
      currency: "ILS",
    });
  }
}

export function trackLogin(method: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "login", { method });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("trackCustom", "Login", { method });
  }
}

export function trackSignUp(method: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "sign_up", { method });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "CompleteRegistration", { method });
  }
}

export function trackShare(method: string, contentType: string, itemId: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "share", { method, content_type: contentType, item_id: itemId });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("trackCustom", "Share", { method, content_type: contentType, item_id: itemId });
  }
}

export function trackException(description: string, fatal: boolean = false) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "exception", { description, fatal });
  }
}
