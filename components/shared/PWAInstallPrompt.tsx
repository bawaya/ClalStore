"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

// =====================================================
// ClalMobile — PWA Install Prompt + SW Registration
// Shows install banner on mobile/desktop if not installed
// =====================================================

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function PWAInstallPrompt() {
  const { t } = useLang();
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showBanner, setShowBanner] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  useEffect(() => {
    // Register service worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("SW registered:", reg.scope);
        })
        .catch((err) => {
          console.log("SW registration failed:", err);
        });
    }

    // Check if already installed
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    // Check if dismissed recently
    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < 3 * 24 * 60 * 60 * 1000) return; // 3 days
    }

    // Detect iOS
    const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosCheck);

    // Listen for beforeinstallprompt (Chrome/Edge/Samsung)
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

    // Show iOS banner after 5 seconds
    if (iosCheck) {
      const timer = setTimeout(() => setShowBanner(true), 5000);
      return () => {
        clearTimeout(timer);
        window.removeEventListener("beforeinstallprompt", handler);
      };
    }

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === "accepted") {
        setShowBanner(false);
      }
      setDeferredPrompt(null);
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleDismiss = () => {
    setShowBanner(false);
    setShowIOSGuide(false);
    localStorage.setItem("pwa_dismissed", Date.now().toString());
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
