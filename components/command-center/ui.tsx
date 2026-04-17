"use client";

import { useState, useEffect } from "react";
import { CARD, CARD2, BORDER, TEXT, MUTED, GOLD } from "./data";

export function GlowCard({ children, style, glow, onClick }: {
  children: React.ReactNode; style?: React.CSSProperties; glow?: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      background: CARD, borderRadius: 16, border: `1px solid ${BORDER}`, padding: 16,
      position: "relative", overflow: "hidden",
      cursor: onClick ? "pointer" : "default",
      boxShadow: glow ? `0 0 24px ${glow}18` : `0 4px 20px #00000030`,
      transition: "all 0.3s ease", ...style,
    }}>
      {glow && <div style={{ position: "absolute", top: -30, right: -30, width: 90, height: 90, borderRadius: "50%", background: `radial-gradient(circle, ${glow}12 0%, transparent 70%)` }} />}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
    </div>
  );
}

export function Badge({ text, color }: { text: string; color: string }) {
  return <span style={{ background: `${color}22`, color, padding: "3px 10px", borderRadius: 20, fontSize: 10, fontWeight: 700, border: `1px solid ${color}33`, whiteSpace: "nowrap" }}>{text}</span>;
}

export function Dot({ color, size = 8 }: { color: string; size?: number }) {
  return <div style={{ width: size, height: size, borderRadius: "50%", background: color, flexShrink: 0 }} />;
}

export function CTooltip({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 14px", boxShadow: `0 8px 32px #00000060` }}>
      <p style={{ color: TEXT, margin: 0, fontSize: 12, fontWeight: 700 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "4px 0 0", fontSize: 11, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" ? `₪${p.value.toLocaleString()}` : p.value}
        </p>
      ))}
    </div>
  );
}

export function CTooltipPlain({ active, payload, label }: { active?: boolean; payload?: { color: string; name: string; value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: 10, padding: "8px 14px", boxShadow: `0 8px 32px #00000060` }}>
      <p style={{ color: TEXT, margin: 0, fontSize: 12, fontWeight: 700 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: "4px 0 0", fontSize: 11, fontWeight: 600 }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
}

export function AnimNum({ value, prefix, suffix }: { value: number; prefix?: string; suffix?: string }) {
  const [d, setD] = useState(0);
  useEffect(() => {
    if (!value || value <= 0) { setD(value || 0); return; }
    let s = 0;
    const step = Math.max(1, Math.ceil(value / 25));
    const iv = setInterval(() => {
      s += step;
      if (s >= value) { setD(value); clearInterval(iv); } else setD(s);
    }, 30);
    return () => clearInterval(iv);
  }, [value]);
  return <span>{prefix || ""}{d.toLocaleString()}{suffix || ""}</span>;
}

export function SectionHeader({ title, icon, color, badge }: {
  title: string; icon: string; color?: string; badge?: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
      {badge || <div />}
      <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: color || GOLD, display: "flex", alignItems: "center", gap: 6 }}>
        {icon} {title}
      </h2>
    </div>
  );
}
