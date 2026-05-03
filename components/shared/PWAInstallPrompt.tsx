"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useLang } from "@/lib/i18n";
import { csrfHeaders } from "@/lib/csrf-client";

// =====================================================
// ClalMobile — PWA Install Prompt + SW Registration
//
// The install banner is intentionally narrow in scope:
//   - Only on the homepage `/` or the main storefront `/store`
//   - At most ONCE per browser session (any path that triggers it
//     marks it as shown; subsequent visits in the same session are
//     skipped silently — even if the user didn't click the X)
//   - If the user explicitly dismisses (X), it stays hidden for the
//     rest of the session via a separate flag
//   - If the app is already installed, hidden forever (localStorage)
//
// The Service Worker registration runs on EVERY page (not gated),
// since push notifications + offline cache rely on it being installed
// regardless of which route the user lands on.
// =====================================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const ALLOWED_PROMPT_PATHS = ["/", "/store"] as const;
const SHOWN_SESSION_KEY = "pwa_shown_session";
const DISMISSED_SESSION_KEY = "pwa_dismissed";
const INSTALLED_KEY = "pwa_installed";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function subscribeToPush(reg: ServiceWorkerRegistration) {
  try {
    const res = await fetch("/api/push/vapid");
    if (!res.ok) return;
    const vapidJson = await res.json();
    const publicKey = vapidJson.data?.publicKey ?? vapidJson.publicKey;
    if (!publicKey) return;

    const existing = await reg.pushManager.getSubscription();
    if (existing) return; // already subscribed

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
    });

    await fetch("/api/push/subscribe", {
      method: "POST",
      headers: csrfHeaders(),
      body: JSON.stringify({
        endpoint: sub.endpoint,
        keys: {
          p256dh: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("p256dh")!))),
          auth: btoa(String.fromCharCode(...new Uint8Array(sub.getKey("auth")!))),
        },
      }),
    });
  } catch {
    // Push subscription is optional — fail silently
  }
}

export function PWAInstallPrompt() {
  const { t } = useLang();
  const path = usePathname();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // ---------------------------------------------------------------
  // Effect 1 — Service Worker registration (runs once, all pages)
  // ---------------------------------------------------------------
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then(async (reg) => {
        if (Notification.permission === "granted") {
          subscribeToPush(reg);
        }
      })
      .catch(() => {
        // SW registration failed — ignore silently
      });
  }, []);

  // ---------------------------------------------------------------
  // Effect 2 — Install prompt (path-gated, once per session)
  // ---------------------------------------------------------------
  useEffect(() => {
    // 1. Path gate: only on / or /store. Re-runs on SPA route change so
    //    if the user lands on /about then navigates to /store, the
    //    prompt logic activates on /store (subject to all other gates).
    if (!path || !(ALLOWED_PROMPT_PATHS as readonly string[]).includes(path)) {
      return;
    }

    // 2. Already installed? Hide forever.
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isStandalone || localStorage.getItem(INSTALLED_KEY)) return;

    // 3. Explicitly dismissed in this session? Hide for the rest of session.
    const wasDismissed = () => sessionStorage.getItem(DISMISSED_SESSION_KEY) === "1";
    if (wasDismissed()) return;

    // 4. Already SHOWN once in this session? Skip — user-requested rate limit.
    //    This is what stops the prompt reappearing on every refresh.
    if (sessionStorage.getItem(SHOWN_SESSION_KEY) === "1") return;

    // Detect iOS
    const iosCheck =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as unknown as { MSStream?: unknown }).MSStream;
    setIsIOS(iosCheck);

    // Helper: mark as shown for the session BEFORE displaying. This way
    // any subsequent path change / refresh in the same session is
    // short-circuited by the gate at step 4.
    const markShownAndDisplay = () => {
      sessionStorage.setItem(SHOWN_SESSION_KEY, "1");
      setShowBanner(true);
    };

    // Listen for beforeinstallprompt (Chrome/Edge/Samsung)
    const handler = (e: Event) => {
      e.preventDefault();
      if (wasDismissed()) return;
      // Recheck shown gate in case another tab raced ahead
      if (sessionStorage.getItem(SHOWN_SESSION_KEY) === "1") return;
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      markShownAndDisplay();
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Mark as installed when the browser confirms installation
    const installedHandler = () => {
      localStorage.setItem(INSTALLED_KEY, "1");
      setShowBanner(false);
      setDeferredPrompt(null);
    };
    window.addEventListener("appinstalled", installedHandler);

    // Show iOS banner after 5s on the same page (no beforeinstallprompt on iOS Safari)
    let iosTimer: ReturnType<typeof setTimeout> | null = null;
    if (iosCheck) {
      iosTimer = setTimeout(() => {
        if (wasDismissed()) return;
        if (sessionStorage.getItem(SHOWN_SESSION_KEY) === "1") return;
        markShownAndDisplay();
      }, 5000);
    }

    return () => {
      if (iosTimer) clearTimeout(iosTimer);
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, [path]);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        localStorage.setItem(INSTALLED_KEY, "1");
        setShowBanner(false);
        // Request push permission after install
        if ("Notification" in window && Notification.permission === "default") {
          const perm = await Notification.requestPermission();
          if (perm === "granted" && "serviceWorker" in navigator) {
            const reg = await navigator.serviceWorker.ready;
            subscribeToPush(reg);
          }
        }
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    sessionStorage.setItem(DISMISSED_SESSION_KEY, "1");
  };

  if (!showBanner) return null;

  return (
    <>
      {/* Install Banner */}
      <div
        className="fixed bottom-0 left-0 right-0 z-[9999] animate-slide-up"
        style={{
          background: "linear-gradient(135deg, #111114 0%, #1a1a2e 100%)",
          borderTop: "2px solid #c41040",
          padding: "14px 16px",
          boxShadow: "0 -4px 20px rgba(0,0,0,0.5)",
        }}
      >
        <div className="max-w-[600px] mx-auto flex items-center gap-3">
          {/* App Icon */}
          <div
            className="flex-shrink-0 rounded-xl flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, #c41040 0%, #e91e63 100%)",
            }}
          >
            <span className="text-white font-black text-xl">C</span>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="text-white font-extrabold text-sm leading-tight">
              {t("pwa.installTitle")}
            </div>
            <div className="text-[#71717a] text-xs leading-tight mt-0.5">
              {t("pwa.installDesc")}
            </div>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={handleInstall}
              className="px-4 py-2 rounded-lg text-white font-bold text-xs cursor-pointer transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #c41040 0%, #e91e63 100%)",
                boxShadow: "0 2px 8px rgba(196,16,64,0.4)",
              }}
            >
              {t("pwa.install")}
            </button>
            <button
              onClick={handleDismiss}
              className="text-[#52525b] text-lg cursor-pointer hover:text-white transition-colors"
              aria-label="close"
            >
              ✕
            </button>
          </div>
        </div>
      </div>

      {/* iOS Guide Modal */}
      {showIOSGuide && (
        <div
          className="fixed inset-0 z-[10000] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={handleDismiss}
        >
          <div
            className="w-full max-w-[500px] rounded-t-2xl"
            style={{
              background: "#111114",
              border: "1px solid #27272a",
              padding: "24px 20px 32px",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div
                className="inline-flex rounded-xl items-center justify-center mb-3"
                style={{
                  width: 56,
                  height: 56,
                  background: "linear-gradient(135deg, #c41040 0%, #e91e63 100%)",
                }}
              >
                <span className="text-white font-black text-2xl">C</span>
              </div>
              <div className="text-white font-extrabold text-lg">
                {t("pwa.iosTitle")}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 bg-[#18181b] rounded-xl p-3">
                <span className="text-2xl">📤</span>
                <div>
                  <span className="text-white font-bold">{t("pwa.iosStep1")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#18181b] rounded-xl p-3">
                <span className="text-2xl">➕</span>
                <div>
                  <span className="text-white font-bold">{t("pwa.iosStep2")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#18181b] rounded-xl p-3">
                <span className="text-2xl">✅</span>
                <div>
                  <span className="text-white font-bold">{t("pwa.iosStep3")}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full mt-4 py-2.5 rounded-xl text-[#71717a] font-bold text-sm cursor-pointer"
              style={{ border: "1px solid #27272a" }}
            >
              {t("pwa.later")}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
