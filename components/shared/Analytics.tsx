"use client";

// =====================================================
// Analytics — Google Analytics 4 + Meta Pixel
// Amendment 13 compliant: scripts load ONLY after explicit
// consent is granted. Listens for consent changes live.
//
// Categories:
//   • analytics  → loads GA4
//   • advertising → loads Meta Pixel
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
import { usePathname } from "next/navigation";
import Script from "next/script";
import { readConsent, type ConsentState } from "@/lib/consent";

export function Analytics() {
  const pathname = usePathname();
  const [gaId, setGaId] = useState("");
  const [pixelId, setPixelId] = useState("");
  const [analyticsConsent, setAnalyticsConsent] = useState(false);
  const [advertisingConsent, setAdvertisingConsent] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const shouldDisableTracking =
    pathname === "/login" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/change-password" ||
    pathname === "/command-center" ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/crm") ||
    pathname.startsWith("/sales-pwa") ||
    pathname.startsWith("/m/");

  // 1. Load tracking IDs from settings (does NOT activate scripts)
  useEffect(() => {
    if (shouldDisableTracking) {
      setSettingsLoaded(true);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/settings/public");
        const json = await res.json();
        const inner = json.data ?? json;
        const settings = inner.settings || {};
        if (cancelled) return;
        if (settings.ga_measurement_id) setGaId(settings.ga_measurement_id);
        if (settings.meta_pixel_id) setPixelId(settings.meta_pixel_id);
      } catch {
        /* ignore */
      } finally {
        if (!cancelled) setSettingsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shouldDisableTracking]);

  // 2. Subscribe to consent state. Scripts mount only when consent is true.
  useEffect(() => {
    const apply = (s: ConsentState | null) => {
      setAnalyticsConsent(!!s?.analytics);
      setAdvertisingConsent(!!s?.advertising);
    };
    apply(readConsent());
    const onChange = (e: Event) => {
      const detail = (e as CustomEvent<ConsentState>).detail;
      apply(detail || readConsent());
    };
    window.addEventListener("clal-consent-changed", onChange);
    // also listen for storage events from other tabs
    const onStorage = (e: StorageEvent) => {
      if (e.key === "clal_consent_v2") apply(readConsent());
    };
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("clal-consent-changed", onChange);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (shouldDisableTracking || !settingsLoaded) return null;

  return (
    <>
      {/* GA4 — gated on analytics consent */}
      {gaId && analyticsConsent && (
        <>
          <Script
            src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
            strategy="afterInteractive"
          />
          <Script id="ga4-init" strategy="afterInteractive">
            {`
              window.dataLayer = window.dataLayer || [];
              function gtag(){dataLayer.push(arguments);}
              window.gtag = gtag;
              gtag('js', new Date());
              gtag('consent', 'default', {
                'ad_storage': '${advertisingConsent ? "granted" : "denied"}',
                'analytics_storage': 'granted',
                'ad_user_data': '${advertisingConsent ? "granted" : "denied"}',
                'ad_personalization': '${advertisingConsent ? "granted" : "denied"}'
              });
              gtag('config', '${gaId}', {
                page_path: window.location.pathname,
                send_page_view: true,
                anonymize_ip: true
              });
            `}
          </Script>
        </>
      )}

      {/* Meta Pixel — gated on advertising consent */}
      {pixelId && advertisingConsent && (
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
// All helpers no-op when consent for that channel is not granted.

const GA4_TO_META: Record<string, string> = {
  view_item: "ViewContent",
  add_to_cart: "AddToCart",
  begin_checkout: "InitiateCheckout",
  purchase: "Purchase",
  search: "Search",
};

function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return !!readConsent()?.analytics;
}

function hasAdvertisingConsent(): boolean {
  if (typeof window === "undefined") return false;
  return !!readConsent()?.advertising;
}

export function trackEvent(eventName: string, params?: Record<string, unknown>) {
  if (hasAnalyticsConsent() && typeof window !== "undefined" && window.gtag) {
    window.gtag("event", eventName, params);
  }
  if (hasAdvertisingConsent() && typeof window !== "undefined" && window.fbq) {
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
  if (hasAdvertisingConsent() && typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Purchase", { value, currency });
  }
}

export function trackAddToCart(productName: string, price: number) {
  trackEvent("add_to_cart", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (hasAdvertisingConsent() && typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "AddToCart", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackViewProduct(productName: string, price: number) {
  trackEvent("view_item", { items: [{ item_name: productName, price }], currency: "ILS", value: price });
  if (hasAdvertisingConsent() && typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "ViewContent", { content_name: productName, value: price, currency: "ILS" });
  }
}

export function trackBeginCheckout(
  value: number,
  items: { item_name: string; price: number; quantity: number }[],
) {
  trackEvent("begin_checkout", { value, currency: "ILS", items });
  if (hasAdvertisingConsent() && typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "InitiateCheckout", { value, currency: "ILS" });
  }
}

export function trackPurchaseWithItems(
  orderId: string,
  value: number,
  items: { item_name: string; price: number; quantity: number }[],
) {
  trackPurchase(value, "ILS", orderId);
  if (hasAnalyticsConsent() && typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "purchase", {
      transaction_id: orderId,
      value,
      currency: "ILS",
      items: items.map((i) => ({ item_name: i.item_name, price: i.price, quantity: i.quantity })),
    });
  }
}

export function trackSearch(searchTerm: string, resultsCount: number) {
  if (hasAnalyticsConsent() && typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "search", { search_term: searchTerm, results_count: resultsCount });
  }
  if (hasAdvertisingConsent() && typeof window !== "undefined" && window.fbq) {
    window.fbq("track", "Search", { search_string: searchTerm, content_category: "store" });
  }
}

export function trackRemoveFromCart(productName: string, price: number) {
  if (hasAnalyticsConsent() && typeof window !== "undefined" && window.gtag) {
    window.gtag("event", "remove_from_cart", {
      items: [{ item_name: productName, price, currency: "ILS" }],
      value: price,
      currency: "ILS",
    });
  }
}
