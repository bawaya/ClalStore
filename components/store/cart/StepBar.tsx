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
            className="h-1 rounded-sm mb-1 transition-all"
            style={{ background: i <= current ? "#c41040" : "#3f3f46" }}
          />
          <span
            style={{
              fontSize: scr.mobile ? 8 : 10,
              color: i <= current ? "#c41040" : "#3f3f46",
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
