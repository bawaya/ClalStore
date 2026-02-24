"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef, useMemo } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import { IMAGE_DIMS } from "@/components/admin/ImageUpload";
import { PRODUCT_TYPES } from "@/lib/constants";
import { calcMargin, formatCurrency } from "@/lib/utils";
import { aiEnhanceProduct, translateProductName, detectProductType, findDuplicates } from "@/lib/admin/ai-tools";
import type { Product, ProductColor, ProductVariant } from "@/types/database";

const EMPTY: Partial<Product> = {
  type: "device", brand: "", name_ar: "", name_he: "", price: 0, old_price: undefined,
  cost: 0, stock: 0, description_ar: "", colors: [], storage_options: [], variants: [], specs: {},
  active: true, featured: false,
};

export default function ProductsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const { data: products, loading, create, update, remove } = useAdminApi<Product>({ endpoint: "/api/admin/products" });

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Product>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const colorInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [uploadingColor, setUploadingColor] = useState<number | null>(null);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [autoFilling, setAutoFilling] = useState(false);
  const [nameEn, setNameEn] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<{ name: string; confidence: string }[]>([]);
  const [aiProcessing, setAiProcessing] = useState(false);
  const [suggestedColorImages, setSuggestedColorImages] = useState<Record<number, string>>({}); // index → url from auto-fill

  // === Image Upload (single file) ===
  const uploadImage = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload", { method: "POST", body: formData });
      const data = await res.json();
      if (data.success) return data.url;
      show(`❌ ${data.error}`, "error");
      return null;
    } catch {
      show("❌ فشل رفع الصورة", "error");
      return null;
    }
  };

  const handleMainImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const url = await uploadImage(file);
    if (url) { setForm({ ...form, image_url: url }); show("✅ تم رفع الصورة"); }
    setUploading(false);
    e.target.value = "";
  };

  const handleGalleryImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const newUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadImage(files[i]);
      if (url) newUrls.push(url);
    }
    if (newUrls.length) {
      setForm((prev) => ({ ...prev, gallery: [...(prev.gallery || []), ...newUrls] }));
      show(`✅ تم رفع ${newUrls.length} صورة`);
    }
    setUploading(false);
    e.target.value = "";
  };

  const removeGalleryImage = (idx: number) => {
    setForm({ ...form, gallery: (form.gallery || []).filter((_, i) => i !== idx) });
  };

  // === Color Management ===
  const addColor = () => {
    setForm({ ...form, colors: [...(form.colors || []), { hex: "#000000", name_ar: "", name_he: "", image: undefined }] });
  };

  const updateColor = (idx: number, field: keyof ProductColor, value: string) => {
    const updated = [...(form.colors || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, colors: updated });
  };

  const removeColor = (idx: number) => {
    setForm({ ...form, colors: (form.colors || []).filter((_, i) => i !== idx) });
  };

  const handleColorImage = async (e: React.ChangeEvent<HTMLInputElement>, idx: number) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingColor(idx);
    const url = await uploadImage(file);
    if (url) {
      const updated = [...(form.colors || [])];
      updated[idx] = { ...updated[idx], image: url };
      setForm({ ...form, colors: updated });
      show("✅ تم رفع صورة اللون");
    }
    setUploadingColor(null);
    e.target.value = "";
  };

  // === GSMArena Auto-Fill ===
  const handleAutoFill = async () => {
    if (!form.brand || (!form.name_ar && !nameEn)) {
      show("❌ أدخل اسم المنتج والشركة أولاً", "error");
      return;
    }
    setAutoFilling(true);
    try {
      const searchName = nameEn || form.name_ar;
      const res = await fetch("/api/admin/products/autofill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: searchName, brand: form.brand }),
      });
      const json = await res.json();
      if (json.error) throw new Error(json.error);
      const d = json.data;
      setForm((prev) => ({
        ...prev,
        description_ar: d.description_ar || prev.description_ar,
        description_he: d.description_he || prev.description_he,
        specs: d.specs && Object.keys(d.specs).some((k: string) => d.specs[k]) ? d.specs : prev.specs,
        colors: d.colors?.length ? d.colors.map((c: any) => ({ hex: c.hex, name_ar: c.name_ar, name_he: c.name_he, image: c.image || undefined })) : prev.colors,
        storage_options: d.storage_options?.length ? d.storage_options : prev.storage_options,
        variants: d.storage_options?.length
          ? d.storage_options.map((s: string) => ({
              storage: s,
              price: prev.price || 0,
              old_price: undefined,
              cost: prev.cost || 0,
              stock: 0,
            }))
          : prev.variants,
        image_url: d.image_url || prev.image_url,
        gallery: d.gallery?.length ? [...new Set([...(prev.gallery || []), ...d.gallery])] : prev.gallery,
      }));
      // Track suggested color images for "use suggested" buttons
      if (d.colors?.length) {
        const suggested: Record<number, string> = {};
        d.colors.forEach((c: any, i: number) => { if (c.image) suggested[i] = c.image; });
        setSuggestedColorImages(suggested);
      }
      const colorImgCount = d.colors?.filter((c: any) => c.image).length || 0;
      show(`✅ تم جلب بيانات ${d.phone_name || form.name_ar} — ${d.colors?.length || 0} ألوان${colorImgCount ? ` (${colorImgCount} بصور)` : ""}، ${d.storage_options?.length || 0} سعات`);
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    }
    setAutoFilling(false);
  };

  // === Variant Management ===
  const addVariant = () => {
    setForm({ ...form, variants: [...(form.variants || []), { storage: "", price: 0, old_price: undefined, cost: 0, stock: 0 }] });
  };

  const updateVariant = (idx: number, field: keyof ProductVariant, value: string | number | undefined) => {
    const updated = [...(form.variants || [])];
    updated[idx] = { ...updated[idx], [field]: value };
    setForm({ ...form, variants: updated });
  };

  const removeVariant = (idx: number) => {
    setForm({ ...form, variants: (form.variants || []).filter((_, i) => i !== idx) });
  };

  // Sync storage_options from variants
  const syncStorageFromVariants = () => {
    const variants = form.variants || [];
    if (variants.length > 0) {
      const storageLabels = variants.map((v) => v.storage).filter(Boolean);
      setForm((prev) => ({ ...prev, storage_options: storageLabels }));
    }
  };

  const adminBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand))].sort(),
    [products]
  );

  const filtered = useMemo(() => {
    let list = products;
    if (filter === "device") list = list.filter((p) => p.type === "device");
    else if (filter === "accessory") list = list.filter((p) => p.type === "accessory");
    else if (filter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (filter === "out") list = list.filter((p) => p.stock === 0);
    if (brandFilter !== "all") list = list.filter((p) => p.brand === brandFilter);
    return list;
  }, [products, filter, brandFilter]);

  const openCreate = () => { setForm(EMPTY); setEditId(null); setNameEn(""); setDuplicateWarning([]); setModal(true); };
  const openEdit = (p: Product) => { setForm({ ...p }); setEditId(p.id); setNameEn(""); setDuplicateWarning([]); setModal(true); };

  // === AI: Handle English name change → live translate + detect type + check duplicates ===
  const handleNameEnChange = (value: string) => {
    setNameEn(value);
    if (!value.trim()) {
      setDuplicateWarning([]);
      return;
    }
    // Live translate name
    const { name_ar, name_he } = translateProductName(value);
    setForm((prev) => ({ ...prev, name_ar, name_he }));
    // Auto-detect type
    const detectedType = detectProductType(value);
    setForm((prev) => ({ ...prev, type: detectedType }));
    // Check duplicates
    const dups = findDuplicates(value, form.brand || "", products, editId);
    setDuplicateWarning(dups.map((d) => ({ name: d.product.name_ar, confidence: d.confidence })));
  };

  const handleSave = async () => {
    try {
      if (!form.name_ar || !form.brand || !form.price) {
        show("❌ عبّي الحقول المطلوبة", "error"); return;
      }

      setAiProcessing(true);
      const saveForm = { ...form };

      // AI Enhancement: If English name provided, call OpenAI for professional translation
      if (nameEn.trim()) {
        try {
          const aiRes = await fetch("/api/admin/ai-enhance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name_en: nameEn, brand: form.brand || "", specs: form.specs || {}, type: form.type || "device" }),
          });
          if (aiRes.ok) {
            const { data: ai } = await aiRes.json();
            if (ai.name_ar) saveForm.name_ar = ai.name_ar;
            if (ai.name_he) saveForm.name_he = ai.name_he;
            if (ai.type) saveForm.type = ai.type;
            // Only override descriptions if user hasn't manually written them
            if (!form.description_ar?.trim() && ai.description_ar) saveForm.description_ar = ai.description_ar;
            if (!form.description_he?.trim() && ai.description_he) saveForm.description_he = ai.description_he;
          } else {
            // Fallback to local dictionary if OpenAI fails
            const ai = aiEnhanceProduct(nameEn, form.brand || "", form.specs || {}, products, editId);
            saveForm.name_ar = ai.name_ar;
            saveForm.name_he = ai.name_he;
            if (!form.description_ar?.trim()) saveForm.description_ar = ai.description_ar;
            if (!form.description_he?.trim()) saveForm.description_he = ai.description_he;
            saveForm.type = ai.type;
          }
        } catch {
          // Fallback to local dictionary on network error
          const ai = aiEnhanceProduct(nameEn, form.brand || "", form.specs || {}, products, editId);
          saveForm.name_ar = ai.name_ar;
          saveForm.name_he = ai.name_he;
          if (!form.description_ar?.trim()) saveForm.description_ar = ai.description_ar;
          if (!form.description_he?.trim()) saveForm.description_he = ai.description_he;
          saveForm.type = ai.type;
        }
      }

      // Auto-sync storage_options from variants
      const variants = saveForm.variants || [];
      if (variants.length > 0) {
        saveForm.storage_options = variants.map((v) => v.storage).filter(Boolean);
        // Set base price to minimum variant price
        const minPrice = Math.min(...variants.map((v) => v.price).filter((p) => p > 0));
        if (minPrice > 0 && minPrice < Infinity) saveForm.price = minPrice;
      }

      if (editId) {
        await update(editId, saveForm);
        show("✅ تم التعديل");
      } else {
        await create(saveForm);
        show("✅ تم الإضافة");
      }
      setAiProcessing(false);
      setModal(false);
    } catch (err: any) {
      setAiProcessing(false);
      show(`❌ ${err.message}`, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await remove(confirm);
      show("🗑️ تم الحذف");
    } catch (err: any) {
      show(`❌ ${err.message}`, "error");
    }
    setConfirm(null);
  };

  const margin = form.price && form.cost ? calcMargin(Number(form.price), Number(form.cost)) : 0;
  const profit = (Number(form.price) || 0) - (Number(form.cost) || 0);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  return (
    <div>
      <PageHeader title="📱 المنتجات" count={products.length} onAdd={openCreate} addLabel="منتج جديد" />

      {/* Filters — Type + Stock */}
      <div className="flex gap-1 mb-2 overflow-x-auto">
        {[
          { k: "all", l: "الكل" }, { k: "device", l: "📱 أجهزة" },
          { k: "accessory", l: "🔌 إكسسوارات" }, { k: "low", l: "⚠️ مخزون منخفض" },
          { k: "out", l: "❌ نفذ" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`chip whitespace-nowrap ${filter === f.k ? "chip-active" : ""}`}>{f.l}</button>
        ))}
      </div>

      {/* Filters — Brand */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        <button onClick={() => setBrandFilter("all")}
          className={`chip whitespace-nowrap ${brandFilter === "all" ? "chip-active" : ""}`}>كل الشركات</button>
        {adminBrands.map((b) => (
          <button key={b} onClick={() => setBrandFilter(b)}
            className={`chip whitespace-nowrap ${brandFilter === b ? "chip-active" : ""}`}>{b}</button>
        ))}
      </div>

      {/* Products list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📱" title="لا يوجد منتجات" sub="أضف أول منتج" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <div key={p.id} className="card flex items-center gap-2 cursor-pointer hover:border-brand/30 transition-all"
              style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
              onClick={() => openEdit(p)}>

              {/* Actions — left side (RTL) */}
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={(e) => { e.stopPropagation(); setConfirm(p.id); }}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center flex-shrink-0">🗑</button>
                <Toggle value={p.active} onChange={async (v) => { await update(p.id, { active: v }); show(v ? "✅ مفعّل" : "⏸️ معطّل"); }} />
              </div>

              {/* Price */}
              <div className="text-left flex-shrink-0">
                <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>₪{Number(p.price).toLocaleString()}</div>
                {p.old_price && <div className="text-dim line-through text-[10px]">₪{Number(p.old_price).toLocaleString()}</div>}
              </div>

              {/* Info — center */}
              <div className="flex-1 text-right">
                <div className="font-bold flex items-center gap-1.5 justify-end" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                  {p.name_ar}
                  {p.featured && <span className="badge bg-brand/15 text-brand">🔥</span>}
                  {!p.active && <span className="badge bg-dim/20 text-dim">معطّل</span>}
                </div>
                <div className="text-muted flex items-center gap-1.5 justify-end" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                  <span>{PRODUCT_TYPES[p.type as keyof typeof PRODUCT_TYPES]?.icon} {p.brand}</span>
                  <span>•</span>
                  <span>مخزون: {p.stock === 0 ? <span className="text-state-error">نفذ</span> : p.stock <= 5 ? <span className="text-state-warning">{p.stock}</span> : p.stock}</span>
                  <span>•</span>
                  <span>بيع: {p.sold}</span>
                  <span>•</span>
                  <span>هامش: {calcMargin(Number(p.price), Number(p.cost))}%</span>
                </div>
              </div>

              {/* Product thumbnail — right side (RTL), first thing user sees */}
              <div className="flex-shrink-0">
                {p.image_url ? (
                  <img
                    src={p.image_url}
                    alt={p.name_ar}
                    className="object-contain rounded-lg bg-surface-elevated"
                    style={{ width: scr.mobile ? 44 : 52, height: scr.mobile ? 44 : 52 }}
                  />
                ) : (
                  <div
                    className="rounded-lg border-2 border-dashed border-state-warning/40 bg-state-warning/5 flex items-center justify-center"
                    style={{ width: scr.mobile ? 44 : 52, height: scr.mobile ? 44 : 52, fontSize: scr.mobile ? 16 : 20 }}
                    title="بحاجة لصورة"
                  >
                    📷
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل منتج" : "منتج جديد"} wide
        footer={<button onClick={handleSave} disabled={aiProcessing} className="btn-primary w-full disabled:opacity-60">{aiProcessing ? "🤖 جاري المعالجة الذكية..." : editId ? "💾 حفظ التعديلات" : "✅ إضافة المنتج"}</button>}>
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 14 }}>
          <div className="flex-1">
            <FormField label="النوع" required>
              <div className="flex gap-1.5">
                {(["device", "accessory"] as const).map((t) => (
                  <button key={t} onClick={() => setForm({ ...form, type: t })}
                    className={`chip flex-1 ${form.type === t ? "chip-active" : ""}`}>
                    {PRODUCT_TYPES[t].icon} {PRODUCT_TYPES[t].label}
                  </button>
                ))}
              </div>
            </FormField>
            <FormField label="الماركة" required>
              <input className="input" value={form.brand || ""} onChange={(e) => { setForm({ ...form, brand: e.target.value }); if (nameEn) handleNameEnChange(nameEn); }} placeholder="Samsung, Apple..." />
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
              <input className="input" value={form.name_ar || ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="آيفون 17 برو ماكس" />
            </FormField>
            <FormField label="الاسم (عبري)">
              <input className="input" value={form.name_he || ""} onChange={(e) => setForm({ ...form, name_he: e.target.value })} dir="rtl" placeholder="אייפון 17 פרו מקס" />
            </FormField>
            <FormField label="الوصف (عربي)">
              <textarea className="input min-h-[60px] resize-y" value={form.description_ar || ""} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} placeholder="يُولّد تلقائياً من المواصفات عند الحفظ..." />
            </FormField>
            <FormField label="الوصف (عبري)">
              <textarea className="input min-h-[60px] resize-y" value={form.description_he || ""} onChange={(e) => setForm({ ...form, description_he: e.target.value })} dir="rtl" placeholder="נוצר אוטומטית מהמפרט בעת השמירה..." />
            </FormField>

            {/* ===== Auto-Fill from GSMArena ===== */}
            {form.type === "device" && (
              <button
                onClick={handleAutoFill}
                disabled={autoFilling || !form.brand || (!form.name_ar && !nameEn)}
                className="w-full mb-3 py-2.5 rounded-xl font-extrabold cursor-pointer transition-all active:scale-[0.97] flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
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
                    جاري الجلب من GSMArena...
                  </>
                ) : (
                  <>
                    🤖 جلب المواصفات والألوان والصور تلقائياً
                  </>
                )}
              </button>
            )}

            {/* ===== Image Upload Section ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(6,182,212,0.04)", borderColor: "rgba(6,182,212,0.15)" }}>
              <div className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>📸 صورة المنتج</div>

              {/* Main image preview */}
              {form.image_url && (
                <div className="relative mb-2 bg-surface-elevated rounded-xl flex items-center justify-center cursor-pointer" style={{ height: 120 }} onClick={() => setZoomImage(form.image_url!)}>
                  <img src={form.image_url} alt="صورة" className="max-h-[90%] max-w-[90%] object-contain rounded-lg" />
                  <div className="absolute bottom-1.5 right-1.5 w-6 h-6 rounded-full bg-black/50 text-white text-xs flex items-center justify-center">🔍</div>
                  <button
                    onClick={() => setForm({ ...form, image_url: undefined })}
                    className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-state-error/80 text-white text-xs flex items-center justify-center cursor-pointer border-0"
                  >✕</button>
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
              </div>
              <FormField label="أو رابط صورة مباشر">
                <input className="input text-xs" dir="ltr" value={form.image_url || ""} onChange={(e) => setForm({ ...form, image_url: e.target.value || undefined })} placeholder="https://..." />
              </FormField>
              <div className="text-[9px] text-muted text-right mt-0.5">📐 المقاس المفضّل: {IMAGE_DIMS.product}</div>

              {/* Gallery */}
              <div className="font-bold text-right mt-3 mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>🖼️ معرض صور إضافية</div>
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {(form.gallery || []).map((url, i) => (
                  <div key={i} className="relative w-16 h-16 bg-surface-elevated rounded-lg overflow-hidden flex items-center justify-center cursor-pointer" onClick={() => setZoomImage(url)}>
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
                    setForm({ ...form, colors: updated });
                    show("✅ تم تطبيق جميع صور الألوان المقترحة");
                  }}
                  className="w-full py-1.5 rounded-lg bg-brand/10 text-brand text-[10px] cursor-pointer border border-brand/30 font-bold mb-2"
                >
                  ✨ تطبيق جميع صور الألوان المقترحة ({Object.keys(suggestedColorImages).filter(i => !(form.colors || [])[Number(i)]?.image).length})
                </button>
              )}
              {(form.colors || []).length === 0 && (
                <div className="text-center text-dim text-[10px] py-2">لم تتم إضافة ألوان</div>
              )}
              {(form.colors || []).map((c, i) => (
                <div key={i} className="bg-surface-elevated rounded-lg p-2 mb-2">
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
                          onClick={(e) => { e.stopPropagation(); const updated = [...(form.colors || [])]; updated[i] = { ...updated[i], image: undefined }; setForm({ ...form, colors: updated }); }}
                          className="absolute top-0 left-0 w-3.5 h-3.5 rounded-full bg-state-error/80 text-white text-[7px] flex items-center justify-center cursor-pointer border-0"
                        >✕</button>
                      </div>
                    )}
                    {/* Show suggested image from GSMArena if available and not already set */}
                    {!c.image && suggestedColorImages[i] && (
                      <div
                        className="relative w-12 h-12 bg-surface-bg rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0 cursor-pointer border-2 border-dashed border-brand/40 hover:border-brand"
                        title="اضغط لاستخدام هذه الصورة"
                        onClick={() => {
                          const updated = [...(form.colors || [])];
                          updated[i] = { ...updated[i], image: suggestedColorImages[i] };
                          setForm({ ...form, colors: updated });
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
                  </div>
                  {/* Apply all suggested images button */}
                  {!c.image && suggestedColorImages[i] && (
                    <div className="text-[8px] text-brand text-right mt-0.5 opacity-70">
                      ✨ صورة مقترحة من GSMArena — اضغط عليها لتطبيقها
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
                    <div key={i} className="bg-surface-elevated rounded-lg p-2 mb-2">
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
                          <div className="text-muted text-[8px] text-right mb-0.5">التكلفة ₪</div>
                          <input className="input text-xs" type="number" value={v.cost || ""} onChange={(e) => updateVariant(i, "cost", Number(e.target.value))} dir="ltr" />
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
            {/* Margin Calculator */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(196,16,64,0.04)", borderColor: "rgba(196,16,64,0.15)" }}>
              <div className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>💰 حاسبة الهامش</div>
              <div className="flex gap-2 mb-1.5">
                <FormField label="سعر البيع ₪" required>
                  <input className="input" type="number" value={form.price || ""} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} dir="ltr" />
                </FormField>
                <FormField label="التكلفة ₪" required>
                  <input className="input" type="number" value={form.cost || ""} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} dir="ltr" />
                </FormField>
              </div>
              <FormField label="سعر قبل الخصم ₪ (اختياري)">
                <input className="input" type="number" value={form.old_price || ""} onChange={(e) => setForm({ ...form, old_price: Number(e.target.value) || undefined })} dir="ltr" />
              </FormField>
              <div className="flex justify-between mt-1">
                <span style={{ fontSize: 11, color: margin >= 30 ? "#22c55e" : margin >= 15 ? "#eab308" : "#ef4444" }}>
                  الهامش: {margin}%
                </span>
                <span style={{ fontSize: 11, color: profit > 0 ? "#22c55e" : "#ef4444" }}>
                  الربح: ₪{profit}
                </span>
              </div>
            </div>

            <FormField label="المخزون">
              <input className="input" type="number" value={form.stock || 0} onChange={(e) => setForm({ ...form, stock: Number(e.target.value) })} dir="ltr" />
            </FormField>

            <div className="flex gap-3 mt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} />
                <span className="text-xs text-muted">مفعّل</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={!!form.featured} onChange={(v) => setForm({ ...form, featured: v })} />
                <span className="text-xs text-muted">🔥 مميز</span>
              </label>
            </div>
          </div>
        </div>

      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="حذف المنتج؟" message="هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه."
      />

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

      {/* Toast */}
      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
