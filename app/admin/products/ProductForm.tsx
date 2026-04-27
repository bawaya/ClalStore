"use client";

import { useRef } from "react";
import { useScreen } from "@/lib/hooks";
import { Modal, FormField, Toggle } from "@/components/admin/shared";
import { IMAGE_DIMS } from "@/components/admin/ImageUpload";
import { PRODUCT_TYPES } from "@/lib/constants";
import type { Product, ProductColor, ProductVariant } from "@/types/database";

interface ProductFormProps {
  // Modal state
  modal: boolean;
  setModal: (v: boolean) => void;
  editId: string | null;
  // Form data
  form: Partial<Product>;
  setForm: React.Dispatch<React.SetStateAction<Partial<Product>>>;
  nameEn: string;
  handleNameEnChange: (value: string) => void;
  duplicateWarning: { name: string; confidence: string }[];
  // Save
  handleSave: () => Promise<void>;
  aiProcessing: boolean;
  // Image handling
  uploading: boolean;
  handleMainImage: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleGalleryImages: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeGalleryImage: (idx: number) => void;
  // Image enhancement
  enhancingImage: boolean;
  enhanceMenu: boolean;
  setEnhanceMenu: (v: boolean) => void;
  enhanceLabel: string;
  handleEnhanceImage: (mode: "removebg" | "optimize" | "both") => Promise<void>;
  // Zoom
  zoomImage: string | null;
  setZoomImage: (v: string | null) => void;
  // Colors
  addColor: () => void;
  updateColor: (idx: number, field: keyof ProductColor, value: string) => void;
  removeColor: (idx: number) => void;
  handleColorImage: (e: React.ChangeEvent<HTMLInputElement>, idx: number) => void;
  uploadingColor: number | null;
  suggestedColorImages: Record<number, string>;
  // Color image imports
  importPaynGoColorImage: (colorIndex: number) => Promise<void>;
  payngoColorLoading: number | null;
  importGsmaColorImage: (colorIndex: number) => Promise<void>;
  gsmaColorLoading: number | null;
  openPexelsForColor: (colorIndex: number) => Promise<void>;
  pexelsOpen: number | null;
  pexelsResults: { id: number; alt: string; src: string; thumb: string }[];
  pexelsLoading: boolean;
  selectPexelsImage: (colorIndex: number, imageUrl: string) => void;
  setPexelsOpen: (v: number | null) => void;
  setPexelsResults: (v: { id: number; alt: string; src: string; thumb: string }[]) => void;
  // Bulk color images
  fetchAllColorImages: () => Promise<void>;
  bulkColorLoading: boolean;
  // Variants
  addVariant: () => void;
  updateVariant: (idx: number, field: keyof ProductVariant, value: string | number | undefined) => void;
  removeVariant: (idx: number) => void;
  // Auto-fill
  autoFilling: boolean;
  showProviderPicker: boolean;
  setShowProviderPicker: (v: boolean) => void;
  handleAutoFill: (provider: "mobileapi" | "gsmarena" | "combined") => Promise<void>;
  // PaynGo image import
  payngoOpen: boolean;
  setPayngoOpen: (v: boolean) => void;
  payngoQuery: string;
  setPayngoQuery: (v: string) => void;
  payngoResults: { name: string; image_url: string }[];
  payngoLoading: boolean;
  searchPaynGo: () => Promise<void>;
  selectPaynGoImage: (imageUrl: string) => void;
  // Toast
  show: (msg: string, type?: "success" | "error") => void;
}

export function ProductForm({
  modal, setModal, editId,
  form, setForm, nameEn, handleNameEnChange, duplicateWarning,
  handleSave, aiProcessing,
  uploading, handleMainImage, handleGalleryImages, removeGalleryImage,
  enhancingImage, enhanceMenu, setEnhanceMenu, enhanceLabel, handleEnhanceImage,
  zoomImage, setZoomImage,
  addColor, updateColor, removeColor, handleColorImage, uploadingColor,
  suggestedColorImages,
  importPaynGoColorImage, payngoColorLoading,
  importGsmaColorImage, gsmaColorLoading,
  openPexelsForColor, pexelsOpen, pexelsResults, pexelsLoading, selectPexelsImage, setPexelsOpen, setPexelsResults,
  fetchAllColorImages, bulkColorLoading,
  addVariant, updateVariant, removeVariant,
  autoFilling, showProviderPicker, setShowProviderPicker, handleAutoFill,
  payngoOpen, setPayngoOpen, payngoQuery, setPayngoQuery, payngoResults, payngoLoading, searchPaynGo, selectPaynGoImage,
  show,
}: ProductFormProps) {
  const scr = useScreen();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const colorInputRefs = useRef<Record<number, HTMLInputElement | null>>({});


  return (
    <>
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل منتج" : "منتج جديد"} wide
        footer={<button onClick={handleSave} disabled={aiProcessing} className="btn-primary w-full disabled:opacity-60">{aiProcessing ? "🤖 جاري المعالجة الذكية..." : editId ? "💾 حفظ التعديلات" : "✅ إضافة المنتج"}</button>}>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 14 }}>
          <div className="flex-1">
            <FormField label="النوع" required>
              <div className="flex gap-1.5">
                {(["device", "accessory"] as const).map((t) => (
                  <button key={t} onClick={() => setForm(prev => ({ ...prev, type: t }))}
                    className={`chip flex-1 ${form.type === t ? "chip-active" : ""}`}>
                    {PRODUCT_TYPES[t].icon} {PRODUCT_TYPES[t].label}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="الماركة" required>
              <input className="input" value={form.brand || ""} onChange={(e) => { setForm(prev => ({ ...prev, brand: e.target.value })); if (nameEn) handleNameEnChange(nameEn); }} placeholder="Samsung, Apple..." />
            </FormField>

            {/* === AI: English name input (primary) === */}
            <FormField label="🤖 اسم المنتج (بالإنجليزية)">
              <input
                className="input font-bold"
                value={nameEn}
                onChange={(e) => handleNameEnChange(e.target.value)}
                placeholder="iPhone 17 Pro Max"
                dir="ltr"
                style={{ borderColor: nameEn ? "rgba(16,185,129,0.4)" : undefined, background: nameEn ? "rgba(16,185,129,0.04)" : undefined }}
              />
              <div className="text-[9px] text-muted mt-0.5 text-right">اكتب الاسم بالإنجليزية — يُترجم تلقائياً عند الحفظ 🔄</div>
            </FormField>

            {/* Duplicate Warning */}
            {duplicateWarning.length > 0 && (
              <div className="rounded-xl p-2.5 mb-2" style={{ background: "rgba(234,179,8,0.08)", border: "1px solid rgba(234,179,8,0.3)" }}>
                <div className="font-bold text-[11px] text-state-warning mb-1">⚠️ منتج مشابه موجود:</div>
                {duplicateWarning.map((d, i) => (
                  <div key={i} className="text-[10px] text-muted">
                    • {d.name} {d.confidence === "exact" ? "(مطابق تماماً ❌)" : "(مشابه ⚠️)"}
                  </div>
                ))}
              </div>
            )}

            <FormField label="الاسم (عربي)" required>
              <input className="input" value={form.name_ar || ""} onChange={(e) => setForm(prev => ({ ...prev, name_ar: e.target.value }))} placeholder="آيفون 17 برو ماكس" />
            </FormField>
            <FormField label="الاسم (عبري)">
              <input className="input" value={form.name_he || ""} onChange={(e) => setForm(prev => ({ ...prev, name_he: e.target.value }))} dir="rtl" placeholder="אייפון 17 פרו מקס" />
            </FormField>
            <FormField label="الوصف (عربي)">
              <textarea className="input min-h-[60px] resize-y" value={form.description_ar || ""} onChange={(e) => setForm(prev => ({ ...prev, description_ar: e.target.value }))} placeholder="يُولّد تلقائياً من المواصفات عند الحفظ..." />
            </FormField>
            <FormField label="الوصف (عبري)">
              <textarea className="input min-h-[60px] resize-y" value={form.description_he || ""} onChange={(e) => setForm(prev => ({ ...prev, description_he: e.target.value }))} dir="rtl" placeholder="נוצר אוטומטית מהמפרט בעת השמירה..." />
            </FormField>

            {/* ===== Auto-Fill (MobileAPI / GSMArena) ===== */}
            {form.type === "device" && (
              <div className="relative mb-3">
                {/* Main auto-fill button */}
                <button
                  onClick={() => {
                    if (autoFilling) return;
                    if (!form.brand || (!form.name_ar && !nameEn)) {
                      show("❌ أدخل اسم المنتج والشركة أولاً", "error");
                      return;
                    }
                    setShowProviderPicker(!showProviderPicker);
                  }}
                  disabled={autoFilling}
                  className="w-full py-2.5 rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #10b981 100%)",
                    color: "white",
                    border: "none",
                    fontSize: scr.mobile ? 12 : 14,
                  }}
                >
                  {autoFilling ? (
                    <>
                      <span className="animate-spin">⏳</span>
                      جاري جلب البيانات...
                    </>
                  ) : (
                    <>
                      🤖 جلب المواصفات والألوان والصور تلقائياً
                    </>
                  )}
                </button>

                {/* Provider picker dropdown */}
                {showProviderPicker && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProviderPicker(false)} />
                    <div className="absolute left-0 right-0 top-full mt-1 z-50 rounded-xl overflow-hidden shadow-xl border border-white/10" style={{ background: "var(--surface-elevated, #1e293b)" }}>
                      <div className="text-[10px] text-center py-1.5 font-bold opacity-60 border-b border-white/10">اختر مزود البيانات</div>
                      <button
                        onClick={() => handleAutoFill("combined")}
                        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-0 border-b border-white/5 transition-all hover:brightness-125"
                        style={{ background: "linear-gradient(90deg, rgba(139,92,246,0.15) 0%, transparent 100%)" }}
                      >
                        <span className="text-xl">🔗</span>
                        <div className="text-right flex-1">
                          <div className="font-extrabold text-[13px]" style={{ color: "#8b5cf6" }}>مدمج (MobileAPI + GSMArena)</div>
                          <div className="text-[9px] opacity-60">بيانات API + صور ألوان GSMArena — الأدق 🎯</div>
                        </div>
                        <span className="text-[10px] px-1.5 py-0.5 rounded-md font-bold" style={{ background: "#7c3aed", color: "white" }}>موصى</span>
                      </button>
                      <button
                        onClick={() => handleAutoFill("mobileapi")}
                        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-0 border-b border-white/5 transition-all hover:brightness-125"
                        style={{ background: "linear-gradient(90deg, rgba(5,150,105,0.15) 0%, transparent 100%)" }}
                      >
                        <span className="text-xl">📡</span>
                        <div className="text-right flex-1">
                          <div className="font-extrabold text-[13px]" style={{ color: "#10b981" }}>MobileAPI</div>
                          <div className="text-[9px] opacity-60">API رسمي — سريع ودقيق ✅</div>
                        </div>
                      </button>
                      <button
                        onClick={() => handleAutoFill("gsmarena")}
                        className="w-full flex items-center gap-3 px-4 py-3 cursor-pointer border-0 transition-all hover:brightness-125"
                        style={{ background: "linear-gradient(90deg, rgba(230,126,34,0.1) 0%, transparent 100%)" }}
                      >
                        <span className="text-xl">🌐</span>
                        <div className="text-right flex-1">
                          <div className="font-extrabold text-[13px]" style={{ color: "#f39c12" }}>GSMArena</div>
                          <div className="text-[9px] opacity-60">Scraping — صور ألوان فقط 📸</div>
                        </div>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ===== Image Upload Section ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(6,182,212,0.04)", borderColor: "rgba(6,182,212,0.15)" }}>
              <div className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>📸 صورة المنتج</div>

              {/* Main image preview */}
              {form.image_url && (
                <div className="relative mb-2 bg-surface-elevated rounded-xl flex items-center justify-center cursor-pointer" style={{ height: 120 }} onClick={() => !enhancingImage && setZoomImage(form.image_url!)}>
                  <img src={form.image_url} alt="صورة" className="max-h-[90%] max-w-[90%] object-contain rounded-lg" />
                  <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">🔍</div>
                  <button
                    onClick={(e) => { e.stopPropagation(); setForm(prev => ({ ...prev, image_url: undefined })); }}
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-state-error/80 text-white text-xs flex items-center justify-center cursor-pointer border-0"
                  >✕</button>
                  {enhancingImage && (
                    <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center rounded-xl z-10">
                      <div className="text-2xl animate-pulse mb-1">✨</div>
                      <div className="text-white text-[11px] font-bold">{enhanceLabel || "جاري التحسين..."}</div>
                      <div className="text-white/50 text-[9px] mt-0.5">AI Enhancement</div>
                    </div>
                  )}
                </div>
              )}

              {/* Upload / URL input */}
              <div className="flex gap-1.5 mb-1.5">
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleMainImage} />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex-1 py-2 rounded-lg border border-brand/30 bg-brand/5 text-brand text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                >
                  {uploading ? "⏳ جاري الرفع..." : "📷 رفع من الجهاز"}
                </button>
                <button
                  onClick={() => { setPayngoOpen(!payngoOpen); setPayngoQuery(form.name_en || form.name_ar || ""); }}
                  className="py-2 px-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold cursor-pointer flex items-center justify-center gap-1"
                >
                  🛒 PaynGo
                </button>
                {form.image_url && (
                  <div className="relative">
                    <button
                      onClick={() => !enhancingImage && setEnhanceMenu(!enhanceMenu)}
                      disabled={enhancingImage}
                      className="py-2 px-3 rounded-lg border border-purple-500/30 bg-purple-500/10 text-purple-400 text-xs font-bold cursor-pointer flex items-center justify-center gap-1 disabled:opacity-40"
                    >
                      {enhancingImage ? "⏳ جاري..." : `✨ تحسين (${[form.image_url ? 1 : 0, ...(form.gallery || []).map(() => 1), ...(form.colors || []).filter(c => c.image).map(() => 1)].reduce((a, b) => a + b, 0)} صورة)`}
                    </button>
                    {enhanceMenu && (
                      <div className="absolute top-full left-0 mt-1 z-50 bg-surface-bg border border-surface-border rounded-xl shadow-xl overflow-hidden" style={{ minWidth: 200 }}>
                        <div className="px-3 py-1.5 text-[9px] text-muted border-b border-surface-border bg-surface-elevated/50">
                          سيتم تطبيقه على جميع الصور (الرئيسية + المعرض + الألوان)
                        </div>
                        <button onClick={() => handleEnhanceImage("removebg")} className="w-full px-3 py-2.5 text-right text-xs font-semibold text-purple-400 hover:bg-purple-500/10 border-0 cursor-pointer flex items-center gap-2 bg-transparent">
                          🔲 إزالة الخلفية
                        </button>
                        <button onClick={() => handleEnhanceImage("optimize")} className="w-full px-3 py-2.5 text-right text-xs font-semibold text-cyan-400 hover:bg-cyan-500/10 border-0 cursor-pointer flex items-center gap-2 bg-transparent">
                          📐 تحسين الحجم والجودة
                        </button>
                        <button onClick={() => handleEnhanceImage("both")} className="w-full px-3 py-2.5 text-right text-xs font-semibold text-emerald-400 hover:bg-emerald-500/10 border-0 cursor-pointer flex items-center gap-2 bg-transparent">
                          ✨ الكل (إزالة + تحسين)
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <FormField label="أو رابط صورة مباشر">
                <input className="input text-xs" dir="ltr" value={form.image_url || ""} onChange={(e) => setForm(prev => ({ ...prev, image_url: e.target.value || undefined }))} placeholder="https://..." />
              </FormField>
              <div className="text-[9px] text-muted text-right mt-0.5">📐 المقاس المفضّل: {IMAGE_DIMS.product}</div>

              {/* PaynGo Image Import */}
              {payngoOpen && (
                <div className="card mt-2 mb-2 p-2.5 border-emerald-500/20">
                  <div className="flex gap-1.5 mb-2">
                    <input
                      className="input text-xs flex-1"
                      dir="ltr"
                      value={payngoQuery}
                      onChange={(e) => setPayngoQuery(e.target.value)}
                      placeholder="Search PaynGo... e.g. Galaxy S25 Ultra"
                      onKeyDown={(e) => e.key === "Enter" && searchPaynGo()}
                    />
                    <button
                      onClick={searchPaynGo}
                      disabled={payngoLoading}
                      className="py-1.5 px-3 rounded-lg bg-emerald-500/20 text-emerald-400 text-xs font-bold cursor-pointer border border-emerald-500/30"
                    >
                      {payngoLoading ? "⏳" : "🔍 بحث"}
                    </button>
                  </div>
                  {payngoResults.length > 0 && (
                    <div className="grid grid-cols-3 gap-1.5 max-h-48 overflow-y-auto">
                      {payngoResults.map((r, i) => (
                        <div
                          key={i}
                          onClick={() => selectPaynGoImage(r.image_url)}
                          className="bg-surface-elevated rounded-lg p-1.5 cursor-pointer hover:border-emerald-500/50 border border-transparent transition-all"
                        >
                          <img src={r.image_url} alt={r.name} className="w-full h-16 object-contain mb-1" />
                          <div className="text-[8px] text-muted text-center leading-tight line-clamp-2">{r.name}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Gallery */}
              <div className="font-bold text-right mt-3 mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>🖼️ معرض صور إضافية</div>
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {(form.gallery || []).map((url, i) => (
                  <div key={url} className="relative w-16 h-16 bg-surface-elevated rounded-lg overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => setZoomImage(url)}>
                    <img src={url} alt="" className="max-h-full max-w-full object-contain" />
                    <button
                      onClick={() => removeGalleryImage(i)}
                      className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-state-error/80 text-white text-[8px] flex items-center justify-center cursor-pointer border-0"
                    >✕</button>
                  </div>
                ))}
              </div>
              <input type="file" ref={galleryInputRef} className="hidden" accept="image/*" multiple onChange={handleGalleryImages} />
              <button
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploading}
                className="w-full py-1.5 rounded-lg border border-dashed border-surface-border text-muted text-[10px] cursor-pointer bg-transparent"
              >
                {uploading ? "⏳ جاري الرفع..." : "+ إضافة صور للمعرض (يمكن اختيار عدة صور)"}
              </button>
            </div>

            {/* ===== Colors Section ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(168,85,247,0.04)", borderColor: "rgba(168,85,247,0.15)" }}>
              <div className="flex justify-between items-center mb-2">
                <button onClick={addColor} className="text-[10px] px-2 py-1 rounded-lg bg-state-purple/10 text-state-purple border border-state-purple/30 cursor-pointer font-bold">+ لون</button>
                <div className="font-bold text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>🎨 الألوان</div>
              </div>
              {/* Apply all suggested color images */}
              {Object.keys(suggestedColorImages).length > 0 && (form.colors || []).some((c, i) => !c.image && suggestedColorImages[i]) && (
                <button
                  onClick={() => {
                    const updated = [...(form.colors || [])];
                    for (const [idx, url] of Object.entries(suggestedColorImages)) {
                      const i = Number(idx);
                      if (updated[i] && !updated[i].image) {
                        updated[i] = { ...updated[i], image: url };
                      }
                    }
                    setForm(prev => ({ ...prev, colors: updated }));
                    show("✅ تم تطبيق جميع صور الألوان المقترحة");
                  }}
                  className="w-full py-1.5 rounded-lg bg-brand/10 text-brand text-[10px] cursor-pointer border border-brand/30 font-bold mb-2"
                >
                  ✨ تطبيق جميع صور الألوان المقترحة ({Object.keys(suggestedColorImages).filter(i => !(form.colors || [])[Number(i)]?.image).length})
                </button>
              )}
              {/* Bulk fetch all color images */}
              {(form.colors || []).length > 0 && (form.colors || []).some(c => !c.image) && (
                <button
                  onClick={fetchAllColorImages}
                  disabled={bulkColorLoading}
                  className="w-full py-2 rounded-lg bg-gradient-to-r from-emerald-500/10 via-orange-500/10 to-sky-500/10 text-[11px] cursor-pointer border border-emerald-500/30 font-bold mb-2 flex items-center justify-center gap-2"
                >
                  {bulkColorLoading
                    ? <><span className="animate-spin">⏳</span> جاري البحث في PaynGo + GSMArena...</>
                    : <>🎨 جلب صور جميع الألوان تلقائياً ({(form.colors || []).filter(c => !c.image).length} ألوان بدون صور)</>
                  }
                </button>
              )}
              {(form.colors || []).length === 0 && (
                <div className="text-center text-dim text-[10px] py-2">لم تتم إضافة ألوان</div>
              )}
              {(form.colors || []).map((c, i) => (
                <div key={`${c.hex}-${c.name_ar}`} className="bg-surface-elevated rounded-lg p-2 mb-2">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <button onClick={() => removeColor(i)} className="w-5 h-5 rounded-md border border-state-error/30 bg-transparent text-state-error text-[8px] cursor-pointer flex items-center justify-center flex-shrink-0">✕</button>
                    <input className="input text-xs flex-1" value={c.name_ar} onChange={(e) => updateColor(i, "name_ar", e.target.value)} placeholder="أسود" />
                    <input className="input text-xs flex-1" value={c.name_he} onChange={(e) => updateColor(i, "name_he", e.target.value)} placeholder="שחור" />
                    <div className="relative flex-shrink-0">
                      <input type="color" value={c.hex} onChange={(e) => updateColor(i, "hex", e.target.value)}
                        className="w-8 h-8 rounded-lg border border-surface-border cursor-pointer" style={{ padding: 1 }} />
                    </div>
                  </div>
                  {/* Color-specific image */}
                  <div className="flex items-center gap-1.5">
                    {c.image && (
                      <div className="relative w-12 h-12 bg-surface-bg rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer" onClick={() => setZoomImage(c.image!)}>
                        <img src={c.image} alt="" className="max-h-full max-w-full object-contain" />
                        <button
                          onClick={(e) => { e.stopPropagation(); setForm(prev => { const updated = [...(prev.colors || [])]; updated[i] = { ...updated[i], image: undefined }; return { ...prev, colors: updated }; }); }}
                          className="absolute top-0 left-0 w-3.5 h-3.5 rounded-full bg-state-error/80 text-white text-[7px] flex items-center justify-center cursor-pointer border-0"
                        >✕</button>
                      </div>
                    )}
                    {/* Show suggested image if available and not already set */}
                    {!c.image && suggestedColorImages[i] && (
                      <div
                        className="relative w-12 h-12 bg-surface-bg rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer border-2 border-dashed border-brand/40 hover:border-brand"
                        title="اضغط لاستخدام هذه الصورة"
                        onClick={() => {
                          setForm(prev => { const updated = [...(prev.colors || [])]; updated[i] = { ...updated[i], image: suggestedColorImages[i] }; return { ...prev, colors: updated }; });
                          show("✅ تم تطبيق صورة اللون");
                        }}
                      >
                        <img src={suggestedColorImages[i]} alt="" className="max-h-full max-w-full object-contain opacity-70" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/30 text-white text-[8px] font-bold">✨ اقتراح</div>
                      </div>
                    )}
                    <input
                      type="file"
                      className="hidden"
                      accept="image/*"
                      ref={(el) => { colorInputRefs.current[i] = el; }}
                      onChange={(e) => handleColorImage(e, i)}
                    />
                    <button
                      onClick={() => colorInputRefs.current[i]?.click()}
                      disabled={uploadingColor === i}
                      className="flex-1 py-1.5 rounded-lg border border-dashed border-state-purple/30 text-state-purple text-[9px] cursor-pointer bg-transparent"
                    >
                      {uploadingColor === i ? "⏳ جاري..." : c.image ? "📷 تغيير صورة اللون" : "📷 رفع صورة لهذا اللون"}
                    </button>
                    <button
                      onClick={() => importPaynGoColorImage(i)}
                      disabled={payngoColorLoading === i}
                      className="py-1.5 px-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-[9px] cursor-pointer flex-shrink-0"
                      title="PaynGo"
                    >
                      {payngoColorLoading === i ? "⏳" : "🛒"}
                    </button>
                    <button
                      onClick={() => importGsmaColorImage(i)}
                      disabled={gsmaColorLoading === i}
                      className="py-1.5 px-2 rounded-lg border border-orange-500/30 bg-orange-500/10 text-orange-400 text-[9px] cursor-pointer flex-shrink-0"
                      title="GSMArena"
                    >
                      {gsmaColorLoading === i ? "⏳" : "📱"}
                    </button>
                    <button
                      onClick={() => openPexelsForColor(i)}
                      disabled={pexelsOpen === i && pexelsLoading}
                      className="py-1.5 px-2 rounded-lg border border-sky-500/30 bg-sky-500/10 text-sky-400 text-[9px] cursor-pointer flex-shrink-0"
                      title="Pexels"
                    >
                      {pexelsOpen === i && pexelsLoading ? "⏳" : "🔍"}
                    </button>
                  </div>
                  {/* Pexels results picker */}
                  {pexelsOpen === i && pexelsResults.length > 0 && (
                    <div className="mt-1.5 p-2 bg-surface-bg rounded-lg border border-sky-500/20">
                      <div className="flex justify-between items-center mb-1.5">
                        <button onClick={() => { setPexelsOpen(null); setPexelsResults([]); }} className="text-[8px] text-dim cursor-pointer bg-transparent border-0">✕ إغلاق</button>
                        <span className="text-[9px] text-sky-400 font-bold">🔍 Pexels — اختر صورة</span>
                      </div>
                      <div className="grid grid-cols-4 gap-1.5">
                        {pexelsResults.map((photo) => (
                          <div
                            key={photo.id}
                            className="relative aspect-square rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-sky-500 transition-all"
                            onClick={() => selectPexelsImage(i, photo.src)}
                          >
                            <img src={photo.thumb} alt={photo.alt} className="w-full h-full object-cover" loading="lazy" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {/* Apply all suggested images button */}
                  {!c.image && suggestedColorImages[i] && (
                    <div className="text-[8px] text-brand text-right mt-0.5 opacity-70">
                      ✨ صورة مقترحة — اضغط عليها لتطبيقها
                    </div>
                  )}
                  {/* Manual URL paste */}
                  {!c.image && (
                    <div className="flex gap-1 mt-1">
                      <input
                        className="input text-[9px] flex-1"
                        placeholder="🔗 الصق رابط صورة..."
                        dir="ltr"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            const url = (e.target as HTMLInputElement).value.trim();
                            if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                              setForm(prev => {
                                const updated = [...(prev.colors || [])];
                                updated[i] = { ...updated[i], image: url };
                                return { ...prev, colors: updated };
                              });
                              (e.target as HTMLInputElement).value = "";
                              show("✅ تم تطبيق الصورة");
                            }
                          }
                        }}
                      />
                      <button
                        className="text-[8px] px-2 py-1 rounded bg-surface-bg border border-surface-border text-muted cursor-pointer"
                        onClick={(e) => {
                          const input = (e.target as HTMLElement).previousElementSibling as HTMLInputElement;
                          const url = input?.value?.trim();
                          if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
                            setForm(prev => {
                              const updated = [...(prev.colors || [])];
                              updated[i] = { ...updated[i], image: url };
                              return { ...prev, colors: updated };
                            });
                            input.value = "";
                            show("✅ تم تطبيق الصورة");
                          }
                        }}
                      >تطبيق</button>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* ===== Variants Section (per-storage pricing) ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(34,197,94,0.04)", borderColor: "rgba(34,197,94,0.15)" }}>
              <div className="flex justify-between items-center mb-2">
                <button onClick={addVariant} className="text-[10px] px-2 py-1 rounded-lg bg-state-success/10 text-state-success border border-state-success/30 cursor-pointer font-bold">+ سعة</button>
                <div className="font-bold text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>💾 تسعير حسب السعة</div>
              </div>
              {(form.variants || []).length === 0 ? (
                <div className="text-center text-dim text-[10px] py-2">
                  لا يوجد — سيتم استخدام السعر الأساسي لجميع الخيارات
                </div>
              ) : (
                <>
                  <div className="text-muted text-[9px] text-right mb-2">كل سعة بسعر ومخزون مختلف. الخيارات ستظهر في كرت المنتج.</div>
                  {(form.variants || []).map((v, i) => (
                    <div key={`variant-${v.storage}`} className="bg-surface-elevated rounded-lg p-2 mb-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <button onClick={() => removeVariant(i)} className="w-5 h-5 rounded-md border border-state-error/30 bg-transparent text-state-error text-[8px] cursor-pointer flex items-center justify-center flex-shrink-0">✕</button>
                        <input className="input text-xs flex-1" value={v.storage} onChange={(e) => { updateVariant(i, "storage", e.target.value); }} placeholder="256GB" dir="ltr" />
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">سعر البيع ₪</div>
                          <input className="input text-xs" type="number" value={v.price || ""} onChange={(e) => updateVariant(i, "price", Number(e.target.value))} dir="ltr" />
                        </div>
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">سعر قبل الخصم ₪</div>
                          <input className="input text-xs" type="number" value={v.old_price || ""} onChange={(e) => updateVariant(i, "old_price", Number(e.target.value) || undefined)} dir="ltr" />
                        </div>
                        <div>
                          <div className="text-muted text-[8px] text-right mb-0.5">المخزون</div>
                          <input className="input text-xs" type="number" value={v.stock ?? ""} onChange={(e) => updateVariant(i, "stock", Number(e.target.value))} dir="ltr" />
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </div>
          </div>

          <div className="flex-1">
            {/* Price fields */}
            {(form.type === "device" || form.type === "accessory") && (
              <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14 }}>
                <FormField label="سعر البيع ₪" required>
                  <input className="input" type="number" value={form.price || ""} onChange={(e) => setForm(prev => ({ ...prev, price: Number(e.target.value) }))} dir="ltr" />
                </FormField>
                <FormField label="سعر قبل الخصم ₪ (اختياري)">
                  <input className="input" type="number" value={form.old_price || ""} onChange={(e) => setForm(prev => ({ ...prev, old_price: Number(e.target.value) || undefined }))} dir="ltr" />
                </FormField>
              </div>
            )}

            <FormField label="المخزون">
              <input className="input" type="number" value={form.stock || 0} onChange={(e) => setForm(prev => ({ ...prev, stock: Number(e.target.value) }))} dir="ltr" />
            </FormField>

            <div className="flex gap-3 mt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={form.active !== false} onChange={(v) => setForm(prev => ({ ...prev, active: v }))} />
                <span className="text-xs text-muted">مفعّل</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={!!form.featured} onChange={(v) => setForm(prev => ({ ...prev, featured: v }))} />
                <span className="text-xs text-muted">🔥 مميز</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      {/* Image Zoom Lightbox */}
      {zoomImage && (
        <div
          className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/80 backdrop-blur-sm"
          onClick={() => setZoomImage(null)}
        >
          <button
            onClick={() => setZoomImage(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/20 text-white text-xl flex items-center justify-center cursor-pointer border-0 hover:bg-white/30 transition-colors"
          >✕</button>
          <img
            src={zoomImage}
            alt="تكبير"
            className="max-h-[85vh] max-w-[90vw] object-contain rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
