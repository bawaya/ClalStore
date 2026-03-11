"use client";

import { useState, useMemo, useRef } from "react";

export interface LineChartDatum {
  label: string;
  value: number;
}

interface Props {
  data: LineChartDatum[];
  color?: string;
  height?: number;
  formatValue?: (v: number) => string;
  showArea?: boolean;
}

export function LineChart({ data, color = "#c41040", height = 180, formatValue, showArea = true }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { max, min } = useMemo(() => {
    const vals = data.map((d) => d.value);
    return { max: Math.max(...vals, 1), min: Math.min(...vals, 0) };
  }, [data]);

  if (data.length === 0) {
    return <p className="text-xs text-dim py-6 text-center">لا توجد بيانات</p>;
  }

  const fmt = formatValue ?? ((v: number) => v.toLocaleString());
  const showEveryNthLabel = data.length > 15 ? Math.ceil(data.length / 6) : data.length > 8 ? 2 : 1;

  const padding = { top: 8, bottom: 4, left: 0, right: 0 };
  const viewW = 500;
  const viewH = height;
  const plotW = viewW - padding.left - padding.right;
  const plotH = viewH - padding.top - padding.bottom;
  const range = max - min || 1;

  const points = data.map((d, i) => ({
    x: padding.left + (i / Math.max(data.length - 1, 1)) * plotW,
    y: padding.top + plotH - ((d.value - min) / range) * plotH,
  }));

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  const smoothPath = useMemo(() => {
    if (points.length < 2) return linePath;
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[Math.max(i - 1, 0)];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = points[Math.min(i + 2, points.length - 1)];
      const cp1x = p1.x + (p2.x - p0.x) / 6;
      const cp1y = p1.y + (p2.y - p0.y) / 6;
      const cp2x = p2.x - (p3.x - p1.x) / 6;
      const cp2y = p2.y - (p3.y - p1.y) / 6;
      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
    }
    return d;
  }, [points, linePath]);

  const areaPath = `${smoothPath} L ${points[points.length - 1].x} ${viewH} L ${points[0].x} ${viewH} Z`;

  const gradientId = `line-grad-${color.replace("#", "")}`;

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    const mx = ((e.clientX - rect.left) / rect.width) * viewW;
    let closest = 0;
    let minDist = Infinity;
    for (let i = 0; i < points.length; i++) {
      const dist = Math.abs(points[i].x - mx);
      if (dist < minDist) {
        minDist = dist;
        closest = i;
      }
    }
    setHovered(closest);
  };

  return (
    <div className="relative select-none">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${viewW} ${viewH}`}
        className="w-full"
        style={{ height }}
        preserveAspectRatio="none"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.25} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {showArea && (
          <path d={areaPath} fill={`url(#${gradientId})`} />
        )}

        <path
          d={smoothPath}
          fill="none"
          stroke={color}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {hovered !== null && points[hovered] && (
          <>
            <line
              x1={points[hovered].x}
              y1={padding.top}
              x2={points[hovered].x}
              y2={viewH - padding.bottom}
              stroke={color}
              strokeWidth={1}
              strokeDasharray="4 3"
              opacity={0.4}
            />
            <circle
              cx={points[hovered].x}
              cy={points[hovered].y}
              r={5}
              fill={color}
              stroke="#111114"
              strokeWidth={2}
            />
          </>
        )}
      </svg>

      {hovered !== null && data[hovered] && points[hovered] && (
        <div
          className="absolute z-10 pointer-events-none"
          style={{
            left: `${(points[hovered].x / viewW) * 100}%`,
            top: `${(points[hovered].y / viewH) * 100 - 16}%`,
            transform: "translateX(-50%)",
          }}
        >
          <div className="bg-surface-elevated border border-surface-border rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap">
            <p className="text-[10px] text-muted">{data[hovered].label}</p>
            <p className="text-xs font-bold" style={{ color }}>{fmt(data[hovered].value)}</p>
          </div>
        </div>
      )}

      <div className="flex justify-between mt-1 overflow-hidden">
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
