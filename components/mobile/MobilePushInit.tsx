// =====================================================
// ClalMobile — Mobile Push Notification Init
// Registers SW + subscribes to push on /m/ pages
// =====================================================

"use client";

import { useEffect, useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

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
    if (existing) return;

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
    // Push subscription is optional
  }
}

export function MobilePushInit() {
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!("serviceWorker" in navigator) || !("Notification" in window)) return;

    navigator.serviceWorker.register("/sw.js").then(async (reg) => {
      if (Notification.permission === "granted") {
        subscribeToPush(reg);
      } else if (Notification.permission === "default") {
        // Show prompt after 2 seconds
        setTimeout(() => setShowPrompt(true), 2000);
      }
    }).catch(() => {});
  }, []);

  const handleAllow = async () => {
    setShowPrompt(false);
    const perm = await Notification.requestPermission();
    if (perm === "granted" && "serviceWorker" in navigator) {
      const reg = await navigator.serviceWorker.ready;
      subscribeToPush(reg);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    sessionStorage.setItem("push_dismissed", "1");
  };

  if (!showPrompt || sessionStorage.getItem("push_dismissed")) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] p-3 animate-slide-down">
      <div className="bg-surface-elevated border border-zinc-700 rounded-xl p-4 shadow-2xl max-w-md mx-auto">
        <div className="flex items-start gap-3">
          <div className="text-2xl flex-shrink-0">🔔</div>
          <div className="flex-1 min-w-0">
            <div className="text-white font-bold text-sm">تفعيل الإشعارات</div>
            <div className="text-muted text-xs mt-0.5">
              احصل على إشعار فوري عند وصول رسالة جديدة
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-3">
          <button
            onClick={handleAllow}
            className="flex-1 py-2 rounded-lg bg-brand text-white font-bold text-xs cursor-pointer active:scale-95 transition-transform"
          >
            تفعيل
          </button>
          <button
            onClick={handleDismiss}
            className="px-4 py-2 rounded-lg border border-zinc-700 text-muted font-bold text-xs cursor-pointer active:scale-95 transition-transform"
          >
            لاحقاً
          </button>
        </div>
      </div>
    </div>
  );
}
