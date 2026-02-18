"use client";

export const dynamic = 'force-dynamic';

import { useState, useRef } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import { PRODUCT_TYPES } from "@/lib/constants";
import { calcMargin, formatCurrency } from "@/lib/utils";
import type { Product, ProductColor } from "@/types/database";

const EMPTY: Partial<Product> = {
  type: "device", brand: "", name_ar: "", name_he: "", price: 0, old_price: undefined,
  cost: 0, stock: 0, description_ar: "", colors: [], storage_options: [], specs: {},
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
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const colorInputRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const [uploadingColor, setUploadingColor] = useState<number | null>(null);

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

  const filtered = filter === "all" ? products
    : filter === "device" ? products.filter((p) => p.type === "device")
    : filter === "accessory" ? products.filter((p) => p.type === "accessory")
    : filter === "low" ? products.filter((p) => p.stock > 0 && p.stock <= 5)
    : filter === "out" ? products.filter((p) => p.stock === 0)
    : products;

  const openCreate = () => { setForm(EMPTY); setEditId(null); setModal(true); };
  const openEdit = (p: Product) => { setForm({ ...p }); setEditId(p.id); setModal(true); };

  const handleSave = async () => {
    try {
      if (!form.name_ar || !form.brand || !form.price) {
        show("❌ عبّي الحقول المطلوبة", "error"); return;
      }
      if (editId) {
        await update(editId, form);
        show("✅ تم التعديل");
      } else {
        await create(form);
        show("✅ تم الإضافة");
      }
      setModal(false);
    } catch (err: any) {
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

      {/* Filters */}
      <div className="flex gap-1 mb-3 overflow-x-auto">
        {[
          { k: "all", l: "الكل" }, { k: "device", l: "📱 أجهزة" },
          { k: "accessory", l: "🔌 إكسسوارات" }, { k: "low", l: "⚠️ مخزون منخفض" },
          { k: "out", l: "❌ نفذ" },
        ].map((f) => (
          <button key={f.k} onClick={() => setFilter(f.k)}
            className={`chip whitespace-nowrap ${filter === f.k ? "chip-active" : ""}`}>{f.l}</button>
        ))}
      </div>

      {/* Products list */}
      {filtered.length === 0 ? (
        <EmptyState icon="📱" title="لا يوجد منتجات" sub="أضف أول منتج" />
      ) : (
        <div className="space-y-1.5">
          {filtered.map((p) => (
            <div key={p.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30 transition-all"
              style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }}
              onClick={() => openEdit(p)}>
              <div className="flex gap-2">
                <button onClick={(e) => { e.stopPropagation(); setConfirm(p.id); }}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center flex-shrink-0">🗑</button>
                <Toggle value={p.active} onChange={async (v) => { await update(p.id, { active: v }); show(v ? "✅ مفعّل" : "⏸️ معطّل"); }} />
              </div>
              <div className="flex-1 text-right mr-2">
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
              <div className="text-left flex-shrink-0 mr-3">
                <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>₪{Number(p.price).toLocaleString()}</div>
                {p.old_price && <div className="text-dim line-through text-[10px]">₪{Number(p.old_price).toLocaleString()}</div>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Product Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل منتج" : "منتج جديد"} wide>
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
              <input className="input" value={form.brand || ""} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="Samsung, Apple..." />
            </FormField>
            <FormField label="الاسم (عربي)" required>
              <input className="input" value={form.name_ar || ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} placeholder="Galaxy S25 Ultra" />
            </FormField>
            <FormField label="الاسم (عبري)">
              <input className="input" value={form.name_he || ""} onChange={(e) => setForm({ ...form, name_he: e.target.value })} dir="rtl" />
            </FormField>
            <FormField label="الوصف">
              <textarea className="input min-h-[60px] resize-y" value={form.description_ar || ""} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} />
            </FormField>

            {/* ===== Image Upload Section ===== */}
            <div className="card mb-3" style={{ padding: scr.mobile ? 10 : 14, background: "rgba(6,182,212,0.04)", borderColor: "rgba(6,182,212,0.15)" }}>
              <div className="font-bold text-right mb-2" style={{ fontSize: scr.mobile ? 10 : 12 }}>📸 صورة المنتج</div>

              {/* Main image preview */}
              {form.image_url && (
                <div className="relative mb-2 bg-surface-elevated rounded-xl flex items-center justify-center" style={{ height: 120 }}>
                  <img src={form.image_url} alt="صورة" className="max-h-[90%] max-w-[90%] object-contain rounded-lg" />
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

              {/* Gallery */}
              <div className="font-bold text-right mt-3 mb-1.5" style={{ fontSize: scr.mobile ? 9 : 11 }}>🖼️ معرض صور إضافية</div>
              <div className="flex gap-1.5 flex-wrap mb-1.5">
                {(form.gallery || []).map((url, i) => (
                  <div key={i} className="relative w-16 h-16 bg-surface-elevated rounded-lg overflow-hidden flex items-center justify-center">
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
                      <div className="relative w-12 h-12 bg-surface-bg rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        <img src={c.image} alt="" className="max-h-full max-w-full object-contain" />
                        <button
                          onClick={() => { const updated = [...(form.colors || [])]; updated[i] = { ...updated[i], image: undefined }; setForm({ ...form, colors: updated }); }}
                          className="absolute top-0 left-0 w-3.5 h-3.5 rounded-full bg-state-error/80 text-white text-[7px] flex items-center justify-center cursor-pointer border-0"
                        >✕</button>
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
                </div>
              ))}
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

        <button onClick={handleSave} className="btn-primary w-full mt-3">
          {editId ? "💾 حفظ التعديلات" : "✅ إضافة المنتج"}
        </button>
      </Modal>

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete}
        title="حذف المنتج؟" message="هل أنت متأكد؟ هذا الإجراء لا يمكن التراجع عنه."
      />

      {/* Toast */}
      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
