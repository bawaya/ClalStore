"use client";

import { useState, useMemo } from "react";

interface BarChartDatum {
  label: string;
  value: number;
}

interface Props {
  data: BarChartDatum[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
}

export function BarChart({ data, color = "#c41040", height = 180, formatValue }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const max = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data]);

  if (data.length === 0) {
    return <p className="text-xs text-dim py-6 text-center">لا توجد بيانات</p>;
  }

  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  const barGap = data.length > 20 ? 1 : 2;
  const showEveryNthLabel = data.length > 15 ? Math.ceil(data.length / 6) : data.length > 8 ? 2 : 1;

  return (
    <div className="relative select-none">
      <div className="flex items-end gap-px" style={{ height, gap: barGap }}>
        {data.map((d, i) => {
          const pct = Math.max((d.value / max) * 100, 1.5);
          const isHovered = hovered === i;
          return (
            <div
              key={i}
              className="flex-1 relative group"
              style={{ minWidth: 3 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="w-full rounded-t-sm transition-all duration-300 ease-out"
                style={{
                  height: `${pct}%`,
                  background: isHovered ? `${color}dd` : `${color}99`,
                  boxShadow: isHovered ? `0 0 12px ${color}40` : "none",
                  transform: isHovered ? "scaleY(1.03)" : "scaleY(1)",
                  transformOrigin: "bottom",
                }}
              />
              {isHovered && (
                <div
                  className="absolute bottom-full mb-2 z-10 pointer-events-none"
                  style={{ left: "50%", transform: "translateX(-50%)" }}
                >
                  <div className="bg-surface-elevated border border-surface-border rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
                    <p className="text-[10px] text-muted">{d.label}</p>
                    <p className="text-xs font-bold" style={{ color }}>{fmt(d.value)}</p>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between mt-2 overflow-hidden">
        {data.map((d, i) => (
          <span
            key={i}
            className="text-[8px] text-dim flex-1 text-center truncate"
            style={{ visibility: i % showEveryNthLabel === 0 ? "visible" : "hidden" }}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}
