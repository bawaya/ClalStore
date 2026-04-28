"use client";

import { useState, useMemo } from "react";

interface DonutChartDatum {
  label: string;
  value: number;
  color: string;
}

interface Props {
  data: DonutChartDatum[];
  size?: number;
  formatValue?: (v: number) => string;
  showLegend?: boolean;
}

export function DonutChart({ data, size = 200, formatValue, showLegend = true }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  const total = useMemo(() => data.reduce((s, d) => s + d.value, 0), [data]);

  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 4;
  const innerR = outerR * 0.62;
  const gapAngle = data.length > 1 ? 0.02 : 0;

  const segments = useMemo(() => {
    let angle = -Math.PI / 2;
    const result: { startAngle: number; endAngle: number; color: string; index: number }[] = [];
    for (let i = 0; i < data.length; i++) {
      const sweep = (data[i].value / total) * Math.PI * 2 - gapAngle;
      result.push({
        startAngle: angle + gapAngle / 2,
        endAngle: angle + sweep + gapAngle / 2,
        color: data[i].color,
        index: i,
      });
      angle += sweep + gapAngle;
    }
    return result;
  }, [data, total, gapAngle]);

  if (total === 0 || data.length === 0) {
    return <p className="text-xs text-dim py-6 text-center">لا توجد بيانات</p>;
  }

  const fmt = formatValue ?? ((v: number) => v.toLocaleString());

  function arcPath(start: number, end: number, outer: number, inner: number) {
    const largeArc = end - start > Math.PI ? 1 : 0;
    const x1 = cx + outer * Math.cos(start);
    const y1 = cy + outer * Math.sin(start);
    const x2 = cx + outer * Math.cos(end);
    const y2 = cy + outer * Math.sin(end);
    const x3 = cx + inner * Math.cos(end);
    const y3 = cy + inner * Math.sin(end);
    const x4 = cx + inner * Math.cos(start);
    const y4 = cy + inner * Math.sin(start);
    return [
      `M ${x1} ${y1}`,
      `A ${outer} ${outer} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${x3} ${y3}`,
      `A ${inner} ${inner} 0 ${largeArc} 0 ${x4} ${y4}`,
      `Z`,
    ].join(" ");
  }

  const hoveredDatum = hovered !== null ? data[hovered] : null;
  const hoveredPct = hoveredDatum ? Math.round((hoveredDatum.value / total) * 100) : 0;

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
          className="transition-transform"
        >
          {segments.map((seg, i) => {
            const isHov = hovered === i;
            const scale = isHov ? 1.04 : 1;
            return (
              <path
                key={i}
                d={arcPath(seg.startAngle, seg.endAngle, outerR, innerR)}
                fill={seg.color}
                opacity={hovered === null || isHov ? 1 : 0.4}
                style={{
                  transform: `scale(${scale})`,
                  transformOrigin: `${cx}px ${cy}px`,
                  transition: "transform 200ms ease, opacity 200ms ease",
                  filter: isHov ? `drop-shadow(0 0 8px ${seg.color}60)` : "none",
                  cursor: "pointer",
                }}
                onMouseEnter={() => setHovered(i)}
                onMouseLeave={() => setHovered(null)}
              />
            );
          })}
        </svg>

        <div
          className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none"
        >
          {hoveredDatum ? (
            <>
              <span className="text-lg font-black" style={{ color: hoveredDatum.color }}>
                {hoveredPct}%
              </span>
              <span className="text-[10px] text-muted max-w-[60%] text-center truncate">
                {hoveredDatum.label}
              </span>
              <span className="text-[9px] text-dim">{fmt(hoveredDatum.value)}</span>
            </>
          ) : (
            <>
              <span className="text-lg font-black text-white">{fmt(total)}</span>
              <span className="text-[10px] text-muted">المجموع</span>
            </>
          )}
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-x-4 gap-y-1.5 justify-center">
          {data.map((d, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 cursor-pointer transition-opacity"
              style={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <div
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ background: d.color }}
              />
              <span className="text-[10px] text-muted">{d.label}</span>
              <span className="text-[10px] font-bold">{fmt(d.value)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
