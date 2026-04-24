"use client";

// =====================================================
// ClalMobile — Reusable Image Upload Component
// Replaces URL text inputs with file upload from device
// Shows image dimension guidelines + preview
// =====================================================

import { useState, useRef } from "react";
import { useScreen } from "@/lib/hooks";
import { csrfHeaders, getCsrfToken } from "@/lib/csrf-client";

interface ImageUploadProps {
  value: string;
  onChange: (url: string) => void;
  /** e.g. "1200×400 بكسل" */
  dimensions?: string;
  /** e.g. "بنر الكاروسيل" */
  label?: string;
  /** height of the preview area, default 120 */
  previewHeight?: number;
  /** accepted mime types */
  accept?: string;
  /** max file size in MB, default 5 */
  maxSizeMB?: number;
  /** rounded style for logos etc */
  rounded?: boolean;
  /** show AI enhance button (remove bg) */
  enableEnhance?: boolean;
}

export function ImageUpload({
  value,
  onChange,
  dimensions,
  label,
  previewHeight = 120,
  accept = "image/jpeg,image/png,image/webp,image/avif",
  maxSizeMB = 5,
  rounded = false,
  enableEnhance = false,
}: ImageUploadProps) {
  const _scr = useScreen();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [dragOver, setDragOver] = useState(false);

  const upload = async (file: File) => {
    setError("");
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(`الملف أكبر من ${maxSizeMB}MB`);
      return;
    }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      // CSRF: only the token header — let the browser set the multipart boundary automatically.
      const res = await fetch("/api/admin/upload", {
        method: "POST",
        headers: { "x-csrf-token": getCsrfToken() },
        body: formData,
      });
      const data = await res.json();
      if (data.success && data.url) {
        onChange(data.url);
        setError("");
      } else {
        setError(data.error || "فشل رفع الصورة");
      }
    } catch {
      setError("فشل الاتصال بالسيرفر");
    } finally {
      setUploading(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) await upload(file);
    e.target.value = "";
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) {
      await upload(file);
    }
  };

  const handleRemove = () => {
    onChange("");
  };

  const handleEnhance = async () => {
    if (!value || enhancing) return;
    setEnhancing(true);
    setError("");
    try {
      const res = await fetch("/api/admin/image-enhance", {
        method: "POST",
        headers: csrfHeaders(),
        body: JSON.stringify({ image_url: value }),
      });
      const data = await res.json();
      if (data.success && data.url) {
        onChange(data.url);
        setError("");
      } else {
        setError(data.error || "فشل تحسين الصورة");
      }
    } catch {
      setError("فشل الاتصال بالسيرفر");
    } finally {
      setEnhancing(false);
    }
  };

  return (
    <div className="mb-3">
      {/* Label & dimensions hint */}
      {(label || dimensions) && (
        <div className="flex items-center justify-between mb-1.5">
          {label && <span className="text-muted text-[10px] desktop:text-xs font-semibold">{label}</span>}
          {dimensions && (
            <span className="text-[9px] text-dim bg-surface-elevated px-2 py-0.5 rounded-full">
              📐 {dimensions}
            </span>
          )}
        </div>
      )}

      {/* Upload zone or preview */}
      {value ? (
        <div className="relative group">
          <div
            className={`w-full bg-surface-elevated border border-surface-border overflow-hidden ${rounded ? "rounded-full" : "rounded-xl"}`}
            style={{ height: previewHeight }}
          >
            <img
              src={value}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
          {/* Overlay actions */}
          <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 rounded-xl">
            {enableEnhance && (
              <button
                onClick={handleEnhance}
                disabled={enhancing}
                className="px-3 py-1.5 text-white text-[11px] font-bold rounded-lg border-0 cursor-pointer backdrop-blur-sm disabled:opacity-50"
                style={{ background: enhancing ? "rgba(124,58,237,0.6)" : "rgba(124,58,237,0.5)" }}
              >
                {enhancing ? "⏳ جاري التحسين..." : "✨ إزالة الخلفية"}
              </button>
            )}
            <button
              onClick={() => inputRef.current?.click()}
              className="px-3 py-1.5 bg-white/20 text-white text-[11px] font-bold rounded-lg border-0 cursor-pointer hover:bg-white/30 backdrop-blur-sm"
            >
              📷 تغيير
            </button>
            <button
              onClick={handleRemove}
              className="px-3 py-1.5 bg-red-500/40 text-white text-[11px] font-bold rounded-lg border-0 cursor-pointer hover:bg-red-500/60 backdrop-blur-sm"
            >
              🗑 حذف
            </button>
          </div>
          {/* Enhancing overlay */}
          {enhancing && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-xl z-10">
              <div className="text-2xl animate-pulse mb-1">✨</div>
              <div className="text-white text-[11px] font-bold">جاري إزالة الخلفية...</div>
              <div className="text-white/60 text-[9px] mt-0.5">Remove.bg AI</div>
            </div>
          )}
        </div>
      ) : (
        <div
          className={`w-full border-2 border-dashed transition-colors flex flex-col items-center justify-center cursor-pointer rounded-xl ${
            dragOver ? "border-brand bg-brand/5" : "border-surface-border bg-surface-elevated/30 hover:border-brand/50"
          }`}
          style={{ height: previewHeight, minHeight: 80 }}
          onClick={() => !uploading && inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {uploading ? (
            <div className="text-brand text-sm animate-pulse">⏳ جاري الرفع...</div>
          ) : (
            <>
              <div className="text-2xl mb-1 opacity-40">📷</div>
              <div className="text-muted text-[11px] font-bold">اضغط أو اسحب صورة هنا</div>
              <div className="text-dim text-[9px] mt-0.5">JPG, PNG, WebP — حتى {maxSizeMB}MB</div>
              {dimensions && (
                <div className="text-dim text-[9px] mt-0.5">المقاس المثالي: {dimensions}</div>
              )}
            </>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleFile}
      />

      {/* Error */}
      {error && (
        <div className="text-[9px] text-state-error mt-1">⚠️ {error}</div>
      )}
    </div>
  );
}

// ===== Image Dimension Constants =====
// Centralized recommended dimensions for all image upload areas
export const IMAGE_DIMS = {
  heroBg:      "1920×800 بكسل",
  banner:      "1200×400 بكسل",
  logo:        "200×200 بكسل",
  favicon:     "512×512 بكسل",
  product:     "800×800 بكسل",
  productGallery: "800×800 بكسل",
  deal:        "600×400 بكسل",
  ogImage:     "1200×630 بكسل",
  subPage:     "1200×500 بكسل",
  featureIcon: "128×128 بكسل",
} as const;
