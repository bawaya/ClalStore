"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/lib/i18n";

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

    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;

    if (isStandalone) return;

    const dismissed = localStorage.getItem("pwa_dismissed");
    if (dismissed) {
      const ts = parseInt(dismissed, 10);
      if (Date.now() - ts < 3 * 24 * 60 * 60 * 1000) return;
    }

    const iosCheck = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    setIsIOS(iosCheck);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowBanner(true);
    };

    window.addEventListener("beforeinstallprompt", handler);

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
        className="fixed bottom-0 left-0 right-0 z-pwa glass-bottom-bar animate-slide-up"
        style={{ padding: "14px 16px" }}
      >
        <div className="max-w-[600px] mx-auto flex items-center gap-3">
          {/* App Icon */}
          <div
            className="flex-shrink-0 rounded-xl flex items-center justify-center"
            style={{
              width: 48,
              height: 48,
              background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)",
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
                background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)",
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
          className="fixed inset-0 z-[810] flex items-end justify-center"
          style={{ background: "rgba(0,0,0,0.7)" }}
          onClick={handleDismiss}
        >
          <div
            className="w-full max-w-[500px] rounded-t-2xl glass-card-static"
            style={{ padding: "24px 20px 32px" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="text-center mb-4">
              <div
                className="inline-flex rounded-xl items-center justify-center mb-3"
                style={{
                  width: 56,
                  height: 56,
                  background: "linear-gradient(135deg, var(--color-brand) 0%, var(--color-brand-light) 100%)",
                }}
              >
                <span className="text-white font-black text-2xl">C</span>
              </div>
              <div className="text-white font-extrabold text-lg">
                {t("pwa.iosTitle")}
              </div>
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-3 glass-elevated rounded-xl p-3">
                <span className="text-2xl">📤</span>
                <div>
                  <span className="text-white font-bold">{t("pwa.iosStep1")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 glass-elevated rounded-xl p-3">
                <span className="text-2xl">➕</span>
                <div>
                  <span className="text-white font-bold">{t("pwa.iosStep2")}</span>
                </div>
              </div>
              <div className="flex items-center gap-3 glass-elevated rounded-xl p-3">
                <span className="text-2xl">✅</span>
                <div>
                  <span className="text-white font-bold">{t("pwa.iosStep3")}</span>
                </div>
              </div>
            </div>

            <button
              onClick={handleDismiss}
              className="w-full mt-4 py-2.5 rounded-xl text-[#71717a] font-bold text-sm cursor-pointer border border-surface-border"
            >
              {t("pwa.later")}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
