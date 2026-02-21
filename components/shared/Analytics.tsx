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
