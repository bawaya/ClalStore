"use client";

// =====================================================
// Generic admin CRUD page for non-mobile product types
// (tv, computer, tablet, network — and reusable for appliance shape)
// Mirrors the UX of /admin/appliances but parameterized.
// =====================================================

import { useState, useMemo } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import {
  PageHeader,
  Modal,
  FormField,
  Toggle,
  ConfirmDialog,
  EmptyState,
  ErrorBanner,
  ToastContainer,
} from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { Product, ProductColor, ProductVariant, ProductVariantKind, ProductType } from "@/types/database";

export type SubkindMap = Record<string, { label: string; labelHe: string; icon: string }>;

export type SpecsField = {
  key: string;
  label: string;
  placeholder?: string;
  type?: "text" | "number";
  /** Show side-by-side with another spec in a 2-column row when both have rowGroup set to same id */
  rowGroup?: string;
};

interface Props {
  /** Product type for create/list (eg "tv"). */
  type: ProductType;
  /** Page header title — eg "📺 تلفزيونات (LG/Samsung/Hisense)" */
  pageTitle: string;
  /** Add button label — eg "تلفزيون جديد" */
  addLabel: string;
  /** Modal title (create) — eg "إضافة تلفزيون" */
  createModalTitle: string;
  /** Modal title (edit) — eg "تعديل تلفزيون" */
  editModalTitle: string;
  /** Empty-state */
  emptyIcon: string;
  emptyTitle: string;
  emptySub: string;

  /** Subkind picker — pass null to hide. */
  subkindOptions?: SubkindMap | null;
  subkindLabel?: string;
  subkindRequired?: boolean;
  /** Default subkind value applied to new entries. */
  defaultSubkind?: string;

  /** Variants UI: storage label (eg "السعة"), enable + default kind. */
  enableVariants?: boolean;
  defaultVariantKind?: ProductVariantKind;
  variantStorageLabel?: string; // eg "السعة" or "الموديل/الإصدار"

  /** Colors UI on/off. */
  enableColors?: boolean;

  /** Spec fields to render alongside basics. */
  specsFields?: SpecsField[];
}

const KIND_KEYS = (m?: SubkindMap | null) => (m ? Object.keys(m) : []);

export function CategoryProductAdmin({
  type,
  pageTitle,
  addLabel,
  createModalTitle,
  editModalTitle,
  emptyIcon,
  emptyTitle,
  emptySub,
  subkindOptions,
  subkindLabel = "نوع المنتج",
  subkindRequired = false,
  defaultSubkind,
  enableVariants = true,
  defaultVariantKind = "model",
  variantStorageLabel = "الموديل / الإصدار",
  enableColors = true,
  specsFields = [],
}: Props) {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const {
    data: products,
    loading,
    error,
    clearError,
    create,
    update,
    remove,
    bulkRemove,
    pagination,
    setPage,
  } = useAdminApi<Product>({ endpoint: `/api/admin/products?type=${type}`, paginate: { limit: 100 } });

  const EMPTY: Partial<Product> = {
    type,
    brand: "",
    name_ar: "",
    name_en: "",
    name_he: "",
    price: 0,
    old_price: undefined,
    cost: 0,
    stock: 0,
    description_ar: "",
    colors: [],
    storage_options: [],
    variants: [],
    specs: {},
    active: true,
    featured: false,
    warranty_months: 12,
    model_number: "",
    variant_kind: defaultVariantKind,
    subkind: (defaultSubkind as Product["subkind"]) || null,
  };

  const [modal, setModal] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [form, setForm] = useState<Partial<Product>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [brandFilter, setBrandFilter] = useState("all");
  const [nameEn, setNameEn] = useState("");

  const addVariant = () => {
    setForm((prev) => ({
      ...prev,
      variants: [
        ...(prev.variants || []),
        { storage: "", price: 0, old_price: undefined, monthly_price: undefined, cost: 0, stock: 10 },
      ],
    }));
  };

  const updateVariant = (idx: number, field: keyof ProductVariant, value: string | number | undefined) => {
    setForm((prev) => {
      const updated = [...(prev.variants || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, variants: updated };
    });
  };

  const removeVariant = (idx: number) => {
    setForm((prev) => ({
      ...prev,
      variants: (prev.variants || []).filter((_, i) => i !== idx),
    }));
  };

  const addColor = () => {
    setForm((prev) => ({
      ...prev,
      colors: [...(prev.colors || []), { hex: "#000000", name_ar: "", name_he: "", image: undefined }],
    }));
  };

  const updateColor = (idx: number, field: keyof ProductColor, value: string) => {
    setForm((prev) => {
      const updated = [...(prev.colors || [])];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, colors: updated };
    });
  };

  const removeColor = (idx: number) => {
    setForm((prev) => ({ ...prev, colors: (prev.colors || []).filter((_, i) => i !== idx) }));
  };

  const updateSpec = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, specs: { ...(prev.specs || {}), [key]: value } }));
  };

  const adminBrands = useMemo(
    () => [...new Set(products.map((p) => p.brand))].filter(Boolean).sort(),
    [products]
  );

  const filtered = useMemo(() => {
    let list = products;
    if (filter === "low") list = list.filter((p) => p.stock > 0 && p.stock <= 5);
    else if (filter === "out") list = list.filter((p) => p.stock === 0);
    if (brandFilter !== "all") list = list.filter((p) => p.brand === brandFilter);
    return list;
  }, [products, filter, brandFilter]);

  const openCreate = () => {
    setForm(EMPTY);
    setEditId(null);
    setNameEn("");
    setModal(true);
  };

  const openEdit = (p: Product) => {
    setForm({ ...p, type });
    setEditId(p.id);
    setNameEn(p.name_en || "");
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name_ar || !form.brand || !form.price) {
      show("❌ عبّي الحقول المطلوبة (الاسم، الماركة، السعر)", "error");
      return;
    }
    if (subkindRequired && !form.subkind) {
      show(`❌ اختر ${subkindLabel}`, "error");
      return;
    }

    const saveForm: Partial<Product> = {
      ...form,
      type,
      name_en: nameEn.trim() || undefined,
      variant_kind: form.variant_kind || defaultVariantKind,
    };

    const variants = saveForm.variants || [];
    if (variants.length > 0) {
      saveForm.storage_options = variants.map((v) => v.storage).filter(Boolean);
      const minPrice = Math.min(...variants.map((v) => v.price).filter((p) => p > 0));
      if (minPrice > 0 && minPrice < Infinity) saveForm.price = minPrice;
    }

    try {
      if (editId) {
        await update(editId, saveForm);
        show("✅ تم التعديل");
      } else {
        await create(saveForm);
        show("✅ تمت الإضافة");
      }
      setModal(false);
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
  };

  const handleDelete = async () => {
    if (!confirm) return;
    try {
      await remove(confirm);
      show("🗑️ تم الحذف");
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setConfirm(null);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((p) => p.id)));
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkDeleting(true);
    try {
      const deleted = await bulkRemove(Array.from(selected));
      show(`🗑️ تم حذف ${deleted} منتج`);
      setSelected(new Set());
    } catch (err: unknown) {
      show(`❌ ${err instanceof Error ? err.message : "خطأ غير متوقع"}`, "error");
    }
    setBulkDeleting(false);
    setBulkConfirm(false);
  };

  const vk = (form.variant_kind || defaultVariantKind) as ProductVariantKind;
  const subkindKeys = KIND_KEYS(subkindOptions);

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  // Group specs by rowGroup so two fields can render side-by-side
  const specRows: SpecsField[][] = [];
  const rowMap = new Map<string, SpecsField[]>();
  for (const sf of specsFields) {
    const key = sf.rowGroup || `_${sf.key}`;
    const arr = rowMap.get(key) || [];
    arr.push(sf);
    rowMap.set(key, arr);
  }
  for (const arr of rowMap.values()) specRows.push(arr);

  return (
    <div>
      <PageHeader title={pageTitle} count={pagination?.total ?? products.length} onAdd={openCreate} addLabel={addLabel} />
      <ErrorBanner message={error} onDismiss={clearError} />

      <div className="flex gap-1 mb-2 overflow-x-auto">
        {[
          { k: "all", l: "الكل" },
          { k: "low", l: "⚠️ مخزون منخفض" },
          { k: "out", l: "❌ نفذ" },
        ].map((f) => (
          <button
            key={f.k}
            type="button"
            onClick={() => setFilter(f.k)}
            className={`chip whitespace-nowrap ${filter === f.k ? "chip-active" : ""}`}
          >
            {f.l}
          </button>
        ))}
      </div>

      <div className="flex gap-1 mb-3 overflow-x-auto">
        <button
          type="button"
          onClick={() => setBrandFilter("all")}
          className={`chip whitespace-nowrap ${brandFilter === "all" ? "chip-active" : ""}`}
        >
          كل الشركات
        </button>
        {adminBrands.map((b) => (
          <button
            key={b}
            type="button"
            onClick={() => setBrandFilter(b)}
            className={`chip whitespace-nowrap ${brandFilter === b ? "chip-active" : ""}`}
          >
            {b}
          </button>
        ))}
      </div>

      {selected.size > 0 && (
        <div
          className="sticky top-0 z-30 mb-2 card flex items-center justify-between gap-3"
          style={{ padding: "10px 14px", background: "rgba(229,9,20,0.08)", borderColor: "rgba(229,9,20,0.3)" }}
        >
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setBulkConfirm(true)}
              disabled={bulkDeleting}
              className="py-1.5 px-4 rounded-lg bg-state-error text-white text-xs font-bold cursor-pointer border-0 flex items-center gap-1.5 disabled:opacity-50"
            >
              {bulkDeleting ? "⏳ جاري الحذف..." : `🗑️ حذف ${selected.size} منتج`}
            </button>
            <button
              type="button"
              onClick={() => setSelected(new Set())}
              className="py-1.5 px-3 rounded-lg border border-surface-border bg-transparent text-muted text-xs cursor-pointer"
            >
              إلغاء التحديد
            </button>
          </div>
          <span className="text-xs font-bold text-brand">{selected.size} محدد</span>
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState icon={emptyIcon} title={emptyTitle} sub={emptySub} />
      ) : (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 px-2 py-1">
            <input
              type="checkbox"
              checked={filtered.length > 0 && selected.size === filtered.length}
              onChange={toggleSelectAll}
              title="تحديد الكل"
              className="w-4 h-4 rounded cursor-pointer accent-[#e50914] flex-shrink-0"
            />
            <span className="text-[10px] text-muted">تحديد الكل ({filtered.length})</span>
          </div>
          {filtered.map((p) => {
            const sk = p.subkind && subkindOptions ? subkindOptions[p.subkind as string] : undefined;
            const stockBadge = p.stock === 999 ? <span className="text-state-info">متوفر بالطلب</span> : p.stock === 0 ? <span className="text-state-error">نفذ</span> : p.stock;
            return (
              <div
                key={p.id}
                className="card flex items-center gap-2 cursor-pointer hover:border-brand/30 transition-all"
                style={{
                  padding: scr.mobile ? "10px 12px" : "14px 18px",
                  borderColor: selected.has(p.id) ? "rgba(229,9,20,0.4)" : undefined,
                  background: selected.has(p.id) ? "rgba(229,9,20,0.04)" : undefined,
                }}
                onClick={() => openEdit(p)}
                onKeyDown={(e) => e.key === "Enter" && openEdit(p)}
                role="button"
                tabIndex={0}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(p.id)}
                  title="تحديد"
                  className="w-4 h-4 rounded cursor-pointer accent-[#e50914] flex-shrink-0"
                />
                <div className="flex gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                  <button
                    type="button"
                    onClick={() => setConfirm(p.id)}
                    className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center flex-shrink-0"
                  >
                    🗑
                  </button>
                  <Toggle
                    value={p.active}
                    onChange={async (v) => {
                      await update(p.id, { active: v });
                      show(v ? "✅ مفعّل" : "⏸️ معطّل");
                    }}
                  />
                </div>
                <div className="text-left flex-shrink-0">
                  <div className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>
                    ₪{Number(p.price).toLocaleString()}
                  </div>
                  {p.old_price != null && (
                    <div className="text-dim line-through text-[10px]">₪{Number(p.old_price).toLocaleString()}</div>
                  )}
                </div>
                <div className="flex-1 text-right min-w-0">
                  <div className="font-bold flex items-center gap-1.5 justify-end flex-wrap" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                    {p.name_ar}
                    {p.featured && <span className="badge bg-brand/15 text-brand">🔥</span>}
                    {!p.active && <span className="badge bg-dim/20 text-dim">معطّل</span>}
                    {sk && (
                      <span className="badge bg-surface-elevated text-[10px]">
                        {sk.icon} {sk.label}
                      </span>
                    )}
                  </div>
                  <div className="text-muted flex items-center gap-1.5 justify-end flex-wrap" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                    <span>{p.brand}</span>
                    {p.model_number && (
                      <>
                        <span>•</span>
                        <span>#{p.model_number}</span>
                      </>
                    )}
                    <span>•</span>
                    <span>مخزون: {stockBadge}</span>
                  </div>
                </div>
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
                    >
                      📷
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 py-4">
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage(pagination.page - 1)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 cursor-pointer disabled:cursor-default hover:bg-surface-elevated"
              >
                ← السابق
              </button>
              <span className="text-sm text-muted">
                صفحة {pagination.page} من {pagination.totalPages} ({pagination.total} منتج)
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setPage(pagination.page + 1)}
                className="px-3 py-1.5 rounded-lg border border-border text-sm disabled:opacity-30 cursor-pointer disabled:cursor-default hover:bg-surface-elevated"
              >
                التالي →
              </button>
            </div>
          )}
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? editModalTitle : createModalTitle}
        wide
        footer={
          <button type="button" onClick={handleSave} className="btn-primary w-full">
            {editId ? "💾 حفظ" : "✅ إضافة"}
          </button>
        }
      >
        <div style={{ display: scr.mobile ? "block" : "flex", gap: 14 }}>
          <div className="flex-1">
            {subkindOptions && subkindKeys.length > 0 && (
              <FormField label={subkindLabel} required={subkindRequired}>
                <select
                  className="input"
                  value={form.subkind || ""}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, subkind: (e.target.value || null) as Product["subkind"] }))
                  }
                >
                  <option value="">— بدون —</option>
                  {subkindKeys.map((k) => (
                    <option key={k} value={k}>
                      {subkindOptions[k].icon} {subkindOptions[k].label}
                    </option>
                  ))}
                </select>
              </FormField>
            )}
            <FormField label="الماركة" required>
              <input
                className="input"
                value={form.brand || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, brand: e.target.value }))}
                placeholder="LG, Samsung, Apple..."
                dir="ltr"
              />
            </FormField>
            <FormField label="رقم موديل (اختياري)">
              <input
                className="input"
                value={form.model_number || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, model_number: e.target.value || null }))}
                placeholder="QE65QN70F"
                dir="ltr"
              />
            </FormField>
            <FormField label="الضمان (شهور)">
              <input
                className="input"
                type="number"
                min={0}
                max={120}
                value={form.warranty_months ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, warranty_months: e.target.value === "" ? null : Number(e.target.value) }))
                }
                dir="ltr"
              />
            </FormField>

            <FormField label="الاسم (عربي)" required>
              <input
                className="input"
                value={form.name_ar || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, name_ar: e.target.value }))}
              />
            </FormField>
            <FormField label="الاسم (إنجليزي)">
              <input
                className="input font-bold"
                value={nameEn}
                onChange={(e) => setNameEn(e.target.value)}
                dir="ltr"
              />
            </FormField>
            <FormField label="الاسم (عبري)">
              <input
                className="input"
                value={form.name_he || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, name_he: e.target.value }))}
                dir="rtl"
              />
            </FormField>
            <FormField label="وصف (عربي)">
              <textarea
                className="input min-h-[60px] resize-y"
                value={form.description_ar || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, description_ar: e.target.value }))}
              />
            </FormField>
            <FormField label="وصف (عبري)">
              <textarea
                className="input min-h-[60px] resize-y"
                value={form.description_he || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, description_he: e.target.value }))}
                dir="rtl"
              />
            </FormField>

            {/* Custom specs fields per type (TV: screen size; Computer: CPU/RAM; etc.) */}
            {specRows.length > 0 && (
              <div className="card mb-3" style={{ padding: 12 }}>
                <div className="font-bold text-right mb-2 text-sm">📝 المواصفات</div>
                {specRows.map((row, idx) => (
                  <div key={idx} className={row.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
                    {row.map((sf) => (
                      <FormField key={sf.key} label={sf.label}>
                        <input
                          className="input"
                          type={sf.type === "number" ? "number" : "text"}
                          value={form.specs?.[sf.key] || ""}
                          onChange={(e) => updateSpec(sf.key, e.target.value)}
                          placeholder={sf.placeholder}
                          dir="ltr"
                        />
                      </FormField>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <ImageUpload
              label="📸 صورة رئيسية"
              dimensions={IMAGE_DIMS.product}
              value={form.image_url || ""}
              onChange={(url) => setForm((prev) => ({ ...prev, image_url: url || undefined }))}
              previewHeight={160}
              enableEnhance
            />
            <FormField label="أو رابط صورة (اختياري)">
              <input
                className="input text-xs"
                dir="ltr"
                value={form.image_url || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, image_url: e.target.value || undefined }))}
                placeholder="https://..."
              />
            </FormField>
          </div>

          <div className="flex-1">
            {enableVariants && (
              <>
                <FormField label="شكل خيارات السعر" required>
                  <div className="flex gap-1.5 flex-wrap">
                    {(["storage", "model", "color_only"] as const).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setForm((prev) => ({ ...prev, variant_kind: k }))}
                        className={`chip ${vk === k ? "chip-active" : ""}`}
                      >
                        {k === "storage" ? "💾 سعة" : k === "model" ? "🏷️ موديل" : "🎨 لون فقط"}
                      </button>
                    ))}
                  </div>
                </FormField>

                {vk !== "color_only" && (
                  <div className="card mb-3" style={{ padding: 12 }}>
                    <div className="flex justify-between items-center mb-2">
                      <button
                        type="button"
                        onClick={addVariant}
                        className="text-[10px] px-2 py-1 rounded-lg bg-state-success/10 text-state-success border border-state-success/30"
                      >
                        + خيار
                      </button>
                      <div className="font-bold text-sm text-right">
                        تسعير حسب{" "}
                        {vk === "model" ? "الموديل / الإصدار" : vk === "storage" ? "السعة / الحجم" : variantStorageLabel}
                      </div>
                    </div>
                    {(form.variants || []).length === 0 ? (
                      <p className="text-[10px] text-muted text-right">
                        يمكن الاعتماد على السعر الأساسي فقط، أو إضافة خيارات بأسعار مختلفة.
                      </p>
                    ) : (
                      (form.variants || []).map((v, i) => (
                        <div key={i} className="bg-surface-elevated rounded-lg p-2 mb-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <button
                              type="button"
                              onClick={() => removeVariant(i)}
                              className="w-5 h-5 rounded-md border border-state-error/30 text-state-error text-[8px]"
                            >
                              ✕
                            </button>
                            <input
                              className="input text-xs flex-1"
                              value={v.storage}
                              onChange={(e) => updateVariant(i, "storage", e.target.value)}
                              placeholder={vk === "model" ? "OL750" : "256GB"}
                              dir="ltr"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-1.5">
                            <div>
                              <div className="text-muted text-[8px] text-right">سعر النقد ₪</div>
                              <input
                                className="input text-xs"
                                type="number"
                                value={v.price || ""}
                                onChange={(e) => updateVariant(i, "price", Number(e.target.value))}
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <div className="text-muted text-[8px] text-right">قسط × 36 ₪</div>
                              <input
                                className="input text-xs"
                                type="number"
                                value={v.monthly_price || ""}
                                onChange={(e) =>
                                  updateVariant(i, "monthly_price", e.target.value === "" ? undefined : Number(e.target.value))
                                }
                                dir="ltr"
                              />
                            </div>
                            <div>
                              <div className="text-muted text-[8px] text-right">المخزون</div>
                              <input
                                className="input text-xs"
                                type="number"
                                value={v.stock ?? ""}
                                onChange={(e) => updateVariant(i, "stock", Number(e.target.value))}
                                dir="ltr"
                              />
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </>
            )}

            {enableColors && (
              <div className="card mb-3" style={{ padding: 12 }}>
                <div className="flex justify-between items-center mb-2">
                  <button
                    type="button"
                    onClick={addColor}
                    className="text-[10px] px-2 py-1 rounded-lg border border-surface-border"
                  >
                    + لون
                  </button>
                  <div className="font-bold text-sm">🎨 ألوان</div>
                </div>
                {(form.colors || []).map((c, i) => (
                  <div key={i} className="bg-surface-elevated rounded p-2 mb-2 space-y-1">
                    <div className="flex gap-1 items-center">
                      <button
                        type="button"
                        onClick={() => removeColor(i)}
                        className="text-state-error text-[8px] px-1"
                      >
                        ✕
                      </button>
                      <input
                        className="input text-xs flex-1"
                        value={c.name_ar}
                        onChange={(e) => updateColor(i, "name_ar", e.target.value)}
                        placeholder="أسود"
                      />
                      <input
                        className="input text-xs w-8 p-0 h-8"
                        type="color"
                        value={c.hex}
                        onChange={(e) => updateColor(i, "hex", e.target.value)}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            <FormField label="سعر النقد ₪" required>
              <input
                className="input"
                type="number"
                value={form.price || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, price: Number(e.target.value) }))}
                dir="ltr"
              />
            </FormField>
            <FormField label="المخزون (999 = متوفر بالطلب)">
              <input
                className="input"
                type="number"
                value={form.stock || 0}
                onChange={(e) => setForm((prev) => ({ ...prev, stock: Number(e.target.value) }))}
                dir="ltr"
              />
            </FormField>
            <div className="flex gap-3 mt-2">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={form.active !== false} onChange={(v) => setForm((prev) => ({ ...prev, active: v }))} />
                <span className="text-xs text-muted">مفعّل</span>
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <Toggle value={!!form.featured} onChange={(v) => setForm((prev) => ({ ...prev, featured: v }))} />
                <span className="text-xs text-muted">🔥 مميز</span>
              </label>
            </div>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="حذف المنتج؟"
        message="تأكيد الحذف؟"
      />
      <ConfirmDialog
        open={bulkConfirm}
        onClose={() => setBulkConfirm(false)}
        onConfirm={handleBulkDelete}
        title={`حذف ${selected.size} منتج؟`}
        message="لن يمكن التراجع."
      />
      <ToastContainer toasts={toasts} />
    </div>
  );
}
