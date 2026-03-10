"use client";

import type { Toast as ToastType } from "@/lib/hooks";

const typeStyles: Record<ToastType["type"], string> = {
  success: "border-state-success/40 text-state-success",
  error: "border-state-error/40 text-state-error",
  warning: "border-state-warning/40 text-state-warning",
  info: "border-state-info/40 text-state-info",
};

export function ToastContainer({ toasts }: { toasts: ToastType[] }) {
  if (toasts.length === 0) return null;

  return (
    <div
      className="fixed bottom-5 z-toast flex flex-col gap-2 items-center pointer-events-none"
      style={{ left: "50%", transform: "translateX(-50%)" }}
      role="status"
      aria-live="polite"
    >
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass-card-static font-bold shadow-glass-lg pointer-events-auto animate-slide-up px-6 py-3 text-sm ${typeStyles[t.type]}`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
