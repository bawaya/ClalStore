"use client";

// =====================================================
// ClalMobile — Analytics Script Injection
// Google Analytics 4 + Meta Pixel + Mixpanel
// =====================================================

import { useEffect, useState, useRef } from "react";
import Script from "next/script";
import mixpanel from "mixpanel-browser";

const GA_FALLBACK = "G-TEHBT6D11N";
const MIXPANEL_TOKEN = "af2deab5f9f5b17175d0c6b69b1f59";

let mixpanelReady = false;

function initMixpanel() {
  if (mixpanelReady) return;
  try {
    mixpanel.init(MIXPANEL_TOKEN, {
      autocapture: true,
      record_sessions_percent: 100,
      track_pageview: true,
      persistence: "localStorage",
    });
    mixpanelReady = true;
  } catch {}
}

export function Analytics() {
  const [gaId, setGaId] = useState(GA_FALLBACK);
  const [pixelId, setPixelId] = useState("");
  const mixpanelInit = useRef(false);

  useEffect(() => {
    if (!mixpanelInit.current) {
      initMixpanel();
      mixpanelInit.current = true;
    }

    async function loadSettings() {
      try {
        const res = await fetch("/api/admin/settings");
        const json = await res.json();
        const settings = json.settings || {};

        if (settings.ga_measurement_id) setGaId(settings.ga_measurement_id);
        if (settings.meta_pixel_id) setPixelId(settings.meta_pixel_id);
      } catch {}
    }
    loadSettings();
  }, []);

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

// ===== Mixpanel helper =====
function mp(eventName: string, props?: Record<string, any>) {
  if (mixpanelReady) {
    try { mixpanel.track(eventName, props); } catch {}
  }
}

// ===== Analytics Event Helpers =====
export function trackEvent(eventName: string, params?: Record<string, any>) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", eventName, params);
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", eventName, params);
  }
  mp(eventName, params);
}

export function trackPurchase(value: number, currency: string = "ILS", orderId?: string) {
  trackEvent("purchase", { value, currency, transaction_id: orderId });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "Purchase", { value, currency });
  }
  mp("Purchase", { value, currency, order_id: orderId });
}

export function trackAddToCart(productName: string, price: number) {
  trackEvent("add_to_cart", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "AddToCart", { content_name: productName, value: price, currency: "ILS" });
  }
  mp("Add to Cart", { product: productName, price, currency: "ILS" });
}

export function trackViewProduct(productName: string, price: number) {
  trackEvent("view_item", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "ViewContent", { content_name: productName, value: price, currency: "ILS" });
  }
  mp("View Product", { product: productName, price, currency: "ILS" });
}

export function trackBeginCheckout(value: number, items: { item_name: string; price: number; quantity: number }[]) {
  trackEvent("begin_checkout", { value, currency: "ILS", items });
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "InitiateCheckout", { value, currency: "ILS" });
  }
  mp("Begin Checkout", { value, currency: "ILS", item_count: items.length });
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
  mp("Purchase Complete", { order_id: orderId, value, currency: "ILS", items: items.map((i) => i.item_name) });
}

export function trackSearch(searchTerm: string, resultsCount: number) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "search", { search_term: searchTerm, results_count: resultsCount });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "Search", { search_string: searchTerm, content_category: "store" });
  }
  mp("Search", { query: searchTerm, results_count: resultsCount });
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
  mp("Select Item", { product: productName, price, list: listName });
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
  mp("View Item List", { list: listName, item_count: items.length });
}

export function trackRemoveFromCart(productName: string, price: number) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "remove_from_cart", {
      items: [{ item_name: productName, price, currency: "ILS" }],
      value: price,
      currency: "ILS",
    });
  }
  mp("Remove from Cart", { product: productName, price });
}

export function trackLogin(method: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "login", { method });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("trackCustom", "Login", { method });
  }
  mp("Login", { method });
}

export function trackSignUp(method: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "sign_up", { method });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("track", "CompleteRegistration", { method });
  }
  mp("Sign Up", { method });
}

export function trackShare(method: string, contentType: string, itemId: string) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "share", { method, content_type: contentType, item_id: itemId });
  }
  if (typeof window !== "undefined" && (window as any).fbq) {
    (window as any).fbq("trackCustom", "Share", { method, content_type: contentType, item_id: itemId });
  }
  mp("Share", { method, content_type: contentType, item_id: itemId });
}

export function trackException(description: string, fatal: boolean = false) {
  if (typeof window !== "undefined" && (window as any).gtag) {
    (window as any).gtag("event", "exception", { description, fatal });
  }
  mp("Exception", { description, fatal });
}
