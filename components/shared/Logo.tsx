"use client";

import { useEffect, useState, useCallback } from "react";

// =====================================================
// ClalMobile — Shared Logo Component
// Fetches logo from settings, caches in localStorage
// Falls back to gradient "C" icon + text
// =====================================================

const CACHE_KEY = "clal_logo";
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const LOGO_CHANGE_EVENT = "clal_logo_change";

interface CachedLogo {
  url: string;
  size: number;
  ts: number;
}

interface LogoProps {
  /** Icon size in px (default 36) */
  size?: number;
  /** Show "ClalMobile" text next to icon */
  showText?: boolean;
  /** Additional CSS classes on wrapper */
  className?: string;
  /** Override text displayed (e.g. "ClalCRM") */
  label?: string;
  /** Subtitle text under the brand name */
  subtitle?: string;
}

function getCached(): CachedLogo | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed: CachedLogo = JSON.parse(raw);
    // Only use cache if it has a non-empty URL and hasn't expired
    if (!parsed.url || Date.now() - parsed.ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function setCache(url: string, size: number) {
  // Only cache when there's an actual logo URL
  if (!url) return;
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ url, size, ts: Date.now() }));
  } catch {}
}

/** Invalidate the logo cache and notify all Logo components (call after upload/delete) */
export function invalidateLogoCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
    // Dispatch custom event so all Logo components in the same tab re-fetch
    window.dispatchEvent(new Event(LOGO_CHANGE_EVENT));
  } catch {}
}

export function Logo({ size = 36, showText = false, className = "", label, subtitle }: LogoProps) {
  const [logoUrl, setLogoUrl] = useState<string>("");
  const [logoSize, setLogoSize] = useState<number>(size);
  const [loaded, setLoaded] = useState(false);

  const fetchLogo = useCallback(() => {
    const cached = getCached();
    if (cached) {
      setLogoUrl(cached.url);
      setLogoSize(cached.size || size);
      setLoaded(true);
      return;
    }

    // Fetch from settings API
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        const url = data.settings?.logo_url || "";
        const sz = parseInt(data.settings?.logo_size || String(size), 10);
        setLogoUrl(url);
        setLogoSize(sz);
        setCache(url, sz);
      })
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [size]);

  useEffect(() => {
    fetchLogo();

    // Listen for logo changes from the same tab (settings page upload/delete)
    const handleLogoChange = () => fetchLogo();
    window.addEventListener(LOGO_CHANGE_EVENT, handleLogoChange);

    // Listen for storage changes from other tabs
    const handleStorage = (e: StorageEvent) => {
      if (e.key === CACHE_KEY) fetchLogo();
    };
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(LOGO_CHANGE_EVENT, handleLogoChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [fetchLogo]);

  // When a custom logo is uploaded, use the settings size (slider).
  // For the fallback icon, use the component's size prop (layout-specific).
  const renderSize = logoUrl ? logoSize : size;

  // Fallback gradient "C" icon
  const fallback = (
    <div
      className="rounded-xl bg-gradient-to-br from-brand to-[#ff6b6b] flex items-center justify-center font-black text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.max(size * 0.38, 10),
        borderRadius: size < 32 ? 8 : size < 48 ? 10 : 14,
      }}
    >
      C
    </div>
  );

  const brandText = label || "ClalMobile";
  const textParts = brandText.startsWith("Clal")
    ? { highlight: "Clal", rest: brandText.slice(4) }
    : { highlight: "", rest: brandText };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Icon */}
      {logoUrl ? (
        <img
          src={logoUrl}
          alt="Logo"
          className="object-contain shrink-0"
          style={{ width: renderSize, height: renderSize, borderRadius: renderSize < 32 ? 8 : renderSize < 48 ? 10 : 14 }}
          onError={() => setLogoUrl("")}
        />
      ) : (
        fallback
      )}

      {/* Text */}
      {showText && (
        <div>
          <div className="font-black" style={{ fontSize: Math.max(renderSize * 0.38, 12), lineHeight: 1.2 }}>
            {textParts.highlight && <span className="text-brand">{textParts.highlight}</span>}
            {textParts.rest}
          </div>
          {subtitle && (
            <div className="text-muted" style={{ fontSize: Math.max(renderSize * 0.22, 8) }}>{subtitle}</div>
          )}
        </div>
      )}
    </div>
  );
}
