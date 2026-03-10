"use client";

import { useScreen } from "@/lib/hooks";

const STEPS = ["🛒 السلة", "📝 المعلومات", "💳 الدفع", "✅ تأكيد"];

export function StepBar({ current }: { current: number }) {
  const scr = useScreen();

  return (
    <div className="flex gap-0.5 mb-4 desktop:mb-6">
      {STEPS.map((s, i) => (
        <div key={i} className="flex-1 text-center">
          <div
            className="h-1 rounded-full mb-1 transition-all"
            style={{
              background:
                i <= current
                  ? "linear-gradient(90deg, var(--color-brand, #c41040), var(--color-brand-light, #ff3366))"
                  : "rgba(255,255,255,0.06)",
            }}
          />
          <span
            className="transition-colors"
            style={{
              fontSize: scr.mobile ? 9 : 11,
              color: i <= current ? "var(--color-brand, #c41040)" : "var(--color-muted, #71717a)",
              fontWeight: i === current ? 700 : 400,
            }}
          >
            {s}
          </span>
        </div>
      ))}
    </div>
  );
}
