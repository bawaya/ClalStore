"use client";

import Image from "next/image";

export const dynamic = "force-dynamic";

import { useEffect, useMemo, useState } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import {
  PageHeader,
  Modal,
  FormField,
  Toggle,
  ConfirmDialog,
  EmptyState,
} from "@/components/admin/shared";
import { ImageUpload, IMAGE_DIMS } from "@/components/admin/ImageUpload";
import type { StoreSpotlight, Product } from "@/types/database";

type Position = 1 | 2 | 3 | 4;

const EMPTY: Partial<StoreSpotlight> = {
  product_id: "",
  position: 1,
  eyebrow_ar: "",
  eyebrow_he: "",
  tagline_ar: "",
  tagline_he: "",
  custom_image_url: "",
  active: true,
};

const POSITION_LABELS: Record<Position, string> = {
  1: "1 — الكرت الكبير (البطل)",
  2: "2 — كرت صغير",
  3: "3 — كرت صغير",
  4: "4 — كرت صغير",
};

export default function StoreSpotlightsPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const {
    data: spotlights,
    loading,
    create,
    update,
    remove,
  } = useAdminApi<StoreSpotlight>({ endpoint: "/api/admin/store-spotlights" });

  // Lightweight product list for the dropdown (id + name + brand only)
  const [products, setProducts] = useState<Product[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin/products?limit=500");
        const json = await res.json();
        if (!cancelled && json?.data) setProducts(json.data as Product[]);
      } catch (err) {
        console.error("Failed to fetch products:", err);
      } finally {
        if (!cancelled) setProductsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const productById = useMemo(
    () => new Map(products.map((p) => [p.id, p])),
    [products]
  );

  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<StoreSpotlight>>(EMPTY);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);

  const openCreate = (position?: Position) => {
    setForm({ ...EMPTY, position: position ?? 1 });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (s: StoreSpotlight) => {
    setForm({ ...s });
    setEditId(s.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.product_id) {
      show("❌ اختر المنتج", "error");
      return;
    }
    if (!form.tagline_ar?.trim()) {
      show("❌ الـ tagline (عربي) مطلوب", "error");
      return;
    }
    try {
      if (editId) {
        await update(editId, form);
        show("✅ تم التعديل");
      } else {
        await create(form);
        show("✅ تمت الإضافة");
      }
      setModal(false);
    } catch (err: unknown) {
      const msg = (err as { message?: string })?.message || "خطأ غير معروف";
      show(`❌ ${msg}`, "error");
    }
  };

  const handleDelete = async () => {
    if (confirm) {
      await remove(confirm);
      show("🗑️ تم الحذف");
      setConfirm(null);
    }
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳ جاري التحميل...</div>;

  // Index by position so we can render 4 fixed slots even if some are empty.
  const byPosition = new Map<Position, StoreSpotlight>();
  for (const s of spotlights) {
    if (!byPosition.has(s.position as Position)) {
      byPosition.set(s.position as Position, s);
    }
  }

  return (
    <div>
      <PageHeader
        title="🔥 Spotlight المتجر"
        count={spotlights.length}
        onAdd={() => openCreate()}
        addLabel="spotlight جديد"
      />

      <div
        className="card mb-4"
        style={{ padding: scr.mobile ? 12 : 16, borderColor: "rgba(196,16,64,0.18)" }}
      >
        <div className="text-right">
          <div className="text-xs font-bold text-brand">قسم Editorial في الصفحة الرئيسية للمتجر</div>
          <div className="mt-1 text-[11px] leading-6 text-muted">
            4 مواضع: <strong>الموضع 1</strong> هو الكرت الكبير "البطل"، والمواضع <strong>2-3-4</strong> الكروت الصغيرة تحته.
            كل spotlight يربط بمنتج موجود ويضيف <em>eyebrow</em> (شارة قصيرة فوق الاسم — اختياري) و <em>tagline</em> (سطر تسويقي تحت الاسم).
            الموضع الواحد يقبل <strong>spotlight نشط واحد</strong> فقط.
          </div>
        </div>
      </div>

      {productsLoading ? (
        <div className="text-center py-10 text-muted text-sm">⏳ جاري تحميل قائمة المنتجات...</div>
      ) : (
        <div className="space-y-2">
          {([1, 2, 3, 4] as Position[]).map((pos) => {
            const slot = byPosition.get(pos);
            const product = slot ? productById.get(slot.product_id) : null;
            const imageSrc = slot?.custom_image_url || product?.image_url || "";

            return (
              <div
                key={pos}
                className="card"
                style={{
                  padding: scr.mobile ? "10px 12px" : "14px 18px",
                  borderColor: pos === 1 ? "rgba(255,14,52,0.30)" : undefined,
                }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex gap-2">
                    {slot && (
                      <>
                        <button
                          onClick={() => setConfirm(slot.id)}
                          className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center"
                          aria-label="حذف"
                        >
                          🗑
                        </button>
                        <Toggle
                          value={slot.active}
                          onChange={async (v) => {
                            try {
                              await update(slot.id, { active: v });
                              show(v ? "✅ نشط" : "⏸️ موقوف");
                            } catch (err: unknown) {
                              const msg =
                                (err as { message?: string })?.message || "خطأ";
                              show(`❌ ${msg}`, "error");
                            }
                          }}
                        />
                      </>
                    )}
                  </div>

                  <div
                    className="flex-1 text-right cursor-pointer"
                    onClick={() => (slot ? openEdit(slot) : openCreate(pos))}
                  >
                    <div className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>
                      {POSITION_LABELS[pos]}
                    </div>
                    {slot && product ? (
                      <div className="text-muted mt-1" style={{ fontSize: scr.mobile ? 10 : 11 }}>
                        <span className="font-semibold text-white/80">{product.brand}</span>{" "}
                        — {product.name_ar}
                        {slot.tagline_ar && (
                          <span className="block text-[#ff8da0] mt-0.5">
                            “{slot.tagline_ar}”
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-muted mt-1" style={{ fontSize: scr.mobile ? 10 : 11 }}>
                        <span className="text-state-warning">فارغ</span> — اضغط لإضافة spotlight هنا
                      </div>
                    )}
                  </div>

                  {slot && imageSrc && (
                    <div className="w-12 h-12 bg-surface-elevated rounded-lg overflow-hidden flex-shrink-0">
                      <Image
                        src={imageSrc}
                        alt=""
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        unoptimized
                      />
                    </div>
                  )}

                  {!slot && (
                    <button
                      onClick={() => openCreate(pos)}
                      className="btn-primary text-xs px-3 py-1.5 rounded-lg"
                    >
                      + إضافة
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {spotlights.length === 0 && !productsLoading && (
        <div className="mt-4">
          <EmptyState icon="🔥" title="ما في spotlights بعد — أضف أول واحد للموضع 1 (الكرت الكبير)" />
        </div>
      )}

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title={editId ? "تعديل spotlight" : "spotlight جديد"}
        footer={
          <button onClick={handleSave} className="btn-primary w-full">
            {editId ? "💾 حفظ" : "✅ إضافة"}
          </button>
        }
      >
        <FormField label="المنتج" required>
          <select
            className="input"
            value={form.product_id || ""}
            onChange={(e) => setForm({ ...form, product_id: e.target.value })}
          >
            <option value="">— اختر منتج —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.brand} — {p.name_ar} (₪{p.price.toLocaleString()})
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="الموضع" required>
          <select
            className="input"
            value={form.position || 1}
            onChange={(e) =>
              setForm({ ...form, position: Number(e.target.value) as Position })
            }
          >
            {([1, 2, 3, 4] as Position[]).map((pos) => (
              <option key={pos} value={pos}>
                {POSITION_LABELS[pos]}
              </option>
            ))}
          </select>
        </FormField>

        <FormField label="Eyebrow (عربي) — شارة فوق الاسم، اختياري">
          <input
            className="input"
            value={form.eyebrow_ar || ""}
            onChange={(e) => setForm({ ...form, eyebrow_ar: e.target.value })}
            placeholder="مثال: ✨ الأكثر تميّزاً"
          />
        </FormField>

        <FormField label="Eyebrow (עברית)">
          <input
            className="input"
            value={form.eyebrow_he || ""}
            onChange={(e) => setForm({ ...form, eyebrow_he: e.target.value })}
            dir="rtl"
            placeholder="לדוגמה: ✨ הבולט ביותר"
          />
        </FormField>

        <FormField label="Tagline (عربي)" required>
          <input
            className="input"
            value={form.tagline_ar || ""}
            onChange={(e) => setForm({ ...form, tagline_ar: e.target.value })}
            placeholder="مثال: أقوى كاميرا 200MP بضمان سنتين"
          />
        </FormField>

        <FormField label="Tagline (עברית)">
          <input
            className="input"
            value={form.tagline_he || ""}
            onChange={(e) => setForm({ ...form, tagline_he: e.target.value })}
            dir="rtl"
          />
        </FormField>

        <ImageUpload
          value={form.custom_image_url || ""}
          onChange={(url) => setForm({ ...form, custom_image_url: url })}
          label="صورة مخصّصة (اختياري — لو فاضي نستخدم صورة المنتج)"
          dimensions={IMAGE_DIMS.product}
          previewHeight={140}
          enableEnhance
        />

        <label className="flex items-center gap-1.5 mb-3">
          <Toggle
            value={form.active !== false}
            onChange={(v) => setForm({ ...form, active: v })}
          />
          <span className="text-xs text-muted">مفعّل (يظهر للزبون)</span>
        </label>
      </Modal>

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={handleDelete}
        title="حذف الـ spotlight؟"
        message="لا يمكن التراجع. (المنتج نفسه يبقى — هذا فقط الـ slot)"
      />

      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${
            t.type === "error"
              ? "border-state-error text-state-error"
              : "border-state-success text-state-success"
          }`}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
