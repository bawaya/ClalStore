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
        // Hybrid picker (Shopify-like): show ALL device+accessory products,
        // active AND inactive, with status badges + warnings on selection.
        // The 2000 cap inside getAdminProducts surfaces the full catalog.
        // Inactive items still appear so admins can prep spotlights ahead of
        // launch; a per-row badge + a warning panel on the selected chip
        // make the status unambiguous.
        const res = await fetch("/api/admin/products?types=device,accessory");
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

  // Product picker search state — drives the searchable combobox below.
  const [productSearch, setProductSearch] = useState("");

  const filteredProducts = useMemo(() => {
    const q = productSearch.trim().toLowerCase();
    // Autocomplete behavior: don't show any list until the user types.
    if (!q) return [];

    // Tokenize the query so multi-word searches like
    //   "iPhone 17 Pro Max 256GB أسود"
    // succeed even when the storage / color isn't part of the product
    // name in the DB. Each token must appear somewhere in the haystack.
    const tokens = q.split(/\s+/).filter(Boolean);
    if (tokens.length === 0) return [];

    return products
      .filter((p) => {
        // Build a single searchable string per product, including:
        //   - brand, name (ar+he), model_number, type
        //   - storage variants (e.g. "128GB 256GB 512GB 1TB")
        //   - color names in both languages
        const colorNames = (p.colors || [])
          .flatMap((c) => [c.name_ar, c.name_he])
          .filter(Boolean) as string[];
        const haystack = [
          p.brand,
          p.name_ar,
          p.name_he,
          p.model_number || "",
          p.type,
          ...(p.storage_options || []),
          ...colorNames,
        ]
          .join(" ")
          .toLowerCase();
        return tokens.every((token) => haystack.includes(token));
      })
      .sort((a, b) => {
        // Sort active products first so the most-relevant matches surface
        // at the top. Within the same active state, preserve sort_position
        // (lower comes first), then created_at.
        if (a.active !== b.active) return a.active ? -1 : 1;
        const aPos = a.sort_position ?? Number.MAX_SAFE_INTEGER;
        const bPos = b.sort_position ?? Number.MAX_SAFE_INTEGER;
        return aPos - bPos;
      });
  }, [products, productSearch]);

  const selectedProduct = form.product_id
    ? productById.get(form.product_id) ?? null
    : null;

  const openCreate = (position?: Position) => {
    setForm({ ...EMPTY, position: position ?? 1 });
    setEditId(null);
    setProductSearch("");
    setModal(true);
  };

  const openEdit = (s: StoreSpotlight) => {
    setForm({ ...s });
    setEditId(s.id);
    setProductSearch("");
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
                        {!product.active && (
                          <span className="ms-2 inline-block text-[9px] font-bold text-state-warning bg-state-warning/[0.12] border border-state-warning/30 px-1.5 py-0.5 rounded">
                            ⚠ منتج غير نشط
                          </span>
                        )}
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
          {/* Selected product chip — shown when product_id is set and we have
              the product loaded. Click ✕ to clear and pick a different one. */}
          {selectedProduct && (
            <>
              <div className="mb-2 flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/[0.06] px-3 py-2">
                <div className="flex-1 text-right">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-white/55 flex items-center gap-1.5 justify-end">
                    {!selectedProduct.active && (
                      <span className="text-[9px] font-bold text-state-warning bg-state-warning/[0.15] border border-state-warning/35 px-1.5 py-0.5 rounded normal-case tracking-normal">
                        غير نشط
                      </span>
                    )}
                    {selectedProduct.stock === 0 && (
                      <span className="text-[9px] font-bold text-state-error bg-state-error/[0.15] border border-state-error/35 px-1.5 py-0.5 rounded normal-case tracking-normal">
                        نفد
                      </span>
                    )}
                    <span>{selectedProduct.brand}</span>
                  </div>
                  <div className="text-sm font-semibold text-white">
                    {selectedProduct.name_ar}
                  </div>
                  <div className="text-xs text-white/50">
                    ₪{selectedProduct.price.toLocaleString()} · {selectedProduct.type}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setForm({ ...form, product_id: "" });
                    setProductSearch("");
                  }}
                  className="w-7 h-7 rounded-lg border border-state-error/30 bg-transparent text-state-error text-xs cursor-pointer flex items-center justify-center"
                  aria-label="تغيير المنتج"
                >
                  ✕
                </button>
              </div>

              {/* Inline warning when the picked product is inactive — the
                  spotlight will save fine but won't render on /store until
                  the admin activates the product. */}
              {!selectedProduct.active && (
                <div className="mb-3 rounded-xl border border-state-warning/35 bg-state-warning/[0.08] px-3 py-2 text-[11px] leading-relaxed text-state-warning">
                  ⚠️ هذا المنتج <strong>غير نشط</strong> حالياً.
                  الـ spotlight سيُحفظ لكن <strong>لن يظهر للزبون</strong> على /store حتى تُفعّل المنتج من{" "}
                  <a
                    href={selectedProduct.type === "device" ? "/admin/phones" : "/admin/accessories"}
                    className="underline font-bold"
                  >
                    لوحة المنتجات
                  </a>
                  .
                </div>
              )}

              {/* Soft notice when product is active but out-of-stock */}
              {selectedProduct.active && selectedProduct.stock === 0 && (
                <div className="mb-3 rounded-xl border border-state-error/30 bg-state-error/[0.06] px-3 py-2 text-[11px] leading-relaxed text-state-error/85">
                  ℹ️ المنتج نشط لكن المخزون <strong>نفد</strong>. يظهر للزبون مع شارة &ldquo;نفد المخزون&rdquo; — تأكّد إذا فعلاً تريد spotlight لمنتج غير متوفر.
                </div>
              )}
            </>
          )}

          {/* Search input — always visible. Token-based fuzzy match across
              brand, name (ar+he), model_number, type, storage_options and
              color names. Multi-word queries succeed across fields:
                  "iPhone 17 Pro Max 256GB أسود"
              splits into 6 tokens — all must appear somewhere on the product. */}
          <input
            className="input"
            type="text"
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="ابحث: iPhone 17 Pro Max، Galaxy 256GB، Apple أسود..."
            dir="rtl"
          />

          {/* Autocomplete results — only shown when the user has typed something.
              Empty input shows a single-line hint instead of dumping the full
              product list. Bordered scroll container appears only on active search. */}
          {productSearch.trim() === "" ? (
            <div className="mt-2 space-y-1.5 text-right">
              <p className="text-[10px] text-muted leading-5">
                💡 ابحث بـ: الاسم، الماركة (Apple, Samsung…)، الموديل، السعة (256GB)، أو اللون.
                <br />
                <span className="text-white/40">
                  مثال: <code className="bg-surface-elevated px-1 rounded">iPhone 17 Pro Max 256GB</code>
                </span>
              </p>
              <p className="text-[10px] text-state-warning/75 leading-5">
                ℹ️ الـ spotlight يربط بـ <strong>منتج واحد</strong> — الزبون يختار السعة واللون في صفحة التفاصيل.
              </p>
            </div>
          ) : (
            <div className="mt-2 max-h-72 overflow-y-auto rounded-xl border border-surface-border bg-surface-elevated">
              {filteredProducts.length === 0 ? (
                <div className="py-6 text-center text-xs text-muted">
                  لا توجد نتائج لـ &ldquo;{productSearch}&rdquo;
                </div>
              ) : (
                <ul className="divide-y divide-surface-border">
                  {filteredProducts.slice(0, 30).map((p) => {
                    const isSelected = p.id === form.product_id;
                    const isInactive = !p.active;
                    const isOutOfStock = p.stock === 0;
                    const storageLabel = (p.storage_options || []).join(" · ");
                    const colorCount = (p.colors || []).length;
                    return (
                      <li key={p.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setForm({ ...form, product_id: p.id });
                            setProductSearch("");
                          }}
                          className={`w-full text-right px-3 py-2 text-xs transition-colors hover:bg-brand/10 ${
                            isSelected ? "bg-brand/15" : ""
                          } ${isInactive ? "opacity-65" : ""}`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="text-[10px] text-white/40 shrink-0 pt-0.5">
                              ₪{p.price.toLocaleString()}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="truncate">
                                <span className="font-bold text-white/55">{p.brand}</span>
                                {" · "}
                                <span className="text-white">{p.name_ar}</span>
                                {p.model_number && (
                                  <span className="text-white/40 mr-1">({p.model_number})</span>
                                )}
                                <span className="text-[9px] text-brand/70 mr-1">[{p.type}]</span>
                                {isInactive && (
                                  <span className="ms-1 inline-block text-[9px] font-bold text-state-warning bg-state-warning/[0.12] border border-state-warning/30 px-1.5 py-0.5 rounded">
                                    غير نشط
                                  </span>
                                )}
                                {isOutOfStock && (
                                  <span className="ms-1 inline-block text-[9px] font-bold text-state-error bg-state-error/[0.12] border border-state-error/30 px-1.5 py-0.5 rounded">
                                    نفد
                                  </span>
                                )}
                              </div>
                              {/* Variants line — surfaces storage + color count
                                  so the admin doesn't have to guess what's
                                  available on this product. */}
                              {(storageLabel || colorCount > 0) && (
                                <div className="mt-0.5 text-[9px] text-white/35 truncate">
                                  {storageLabel && <span>سعات: {storageLabel}</span>}
                                  {storageLabel && colorCount > 0 && (
                                    <span className="mx-1.5">·</span>
                                  )}
                                  {colorCount > 0 && (
                                    <span>
                                      {colorCount} {colorCount === 1 ? "لون" : "ألوان"}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              {filteredProducts.length > 30 && (
                <div className="px-3 py-2 text-[10px] text-muted text-center border-t border-surface-border">
                  يعرض أول 30 من {filteredProducts.length} نتيجة — اكتب أكثر لتقليلها
                </div>
              )}
            </div>
          )}
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
