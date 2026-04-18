"use client";

import { useEffect } from "react";
import { WifiOff } from "lucide-react";
import { useOfflineStore } from "@/stores/offline-store";

export function ConnectionBanner() {
  const online = useOfflineStore((s) => s.online);
  const pendingCount = useOfflineStore((s) => s.pendingDocs.length);
  const setOnline = useOfflineStore((s) => s.setOnline);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Initial sync in case the flag drifted while store was initializing
    setOnline(navigator.onLine);
    const onUp = () => setOnline(true);
    const onDown = () => setOnline(false);
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, [setOnline]);

  if (online) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-50 border-b border-amber-500/40 bg-amber-500/15 px-4 py-2 text-center text-xs font-bold text-amber-200 backdrop-blur"
    >
      <span className="inline-flex items-center gap-2">
        <WifiOff className="h-4 w-4" aria-hidden />
        <span>
          أنت أوفلاين — البيانات اللي تسجلها رح تتزامن لما ترجع أونلاين
          {pendingCount > 0 ? ` · (${pendingCount} في الانتظار)` : ""}
        </span>
      </span>
    </div>
  );
}
