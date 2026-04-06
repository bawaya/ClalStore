"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { useAdminApi } from "@/lib/admin/hooks";
import { PageHeader, Modal, FormField, Toggle, ConfirmDialog, EmptyState } from "@/components/admin/shared";
import type { Category } from "@/types/database";

export default function AdminCategoriesPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  
  const { data: categories, loading, create, update, remove } = useAdminApi<Category>({ endpoint: "/api/admin/categories" });
  
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<Partial<Category>>({});
  const [editId, setEditId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const openCreate = () => {
    setForm({ name_ar: "", name_he: "", type: "manual", product_ids: [], rule: "", sort_order: 0, active: true });
    setEditId(null);
    setModal(true);
  };

  const openEdit = (c: Category) => {
    setForm({ ...c });
    setEditId(c.id);
    setModal(true);
  };

  const handleSave = async () => {
    if (!form.name_ar || !form.name_he) {
      show("❌ الرجاء إدخال اسم التصنيف بالعربية والعبرية", "error");
      return;
    }
    
    try {
      if (editId) {
        await update(editId, form);
        show("✅ تم تعديل التصنيف");
      } else {
        await create(form);
        show("✅ تم إضافة التصنيف");
      }
      setModal(false);
    } catch (err: any) {
      show(`❌ خطأ: ${err.message}`, "error");
    }
  };

  const handleDelete = async () => {
    if (confirmDelete) {
      try {
        await remove(confirmDelete);
        show("🗑️ تم حذف التصنيف");
      } catch (err: any) {
        show(`❌ خطأ: ${err.message}`, "error");
      }
      setConfirmDelete(null);
    }
  };

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <PageHeader title="🗂️ التصنيفات (Categories)" count={categories.length} />
        <button onClick={openCreate} className="btn-primary px-4 py-2 rounded-xl text-sm font-bold shadow-lg shadow-brand/20">
          ➕ إضافة تصنيف
        </button>
      </div>

      {categories.length === 0 ? (
        <div className="text-center">
          <EmptyState icon="🗂️" title="لا توجد تصنيفات بعد" sub="قم بإضافة التصنيفات ليتم عرضها في المتجر" />
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c) => (
            <div key={c.id} className="card flex items-center justify-between" style={{ padding: scr.mobile ? 12 : 16 }}>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(c.id)} className="text-state-error text-xs p-2 bg-state-error/10 rounded-lg hover:bg-state-error/20">🗑️</button>
                <button onClick={() => openEdit(c)} className="text-brand text-xs p-2 bg-brand/10 rounded-lg hover:bg-brand/20">✏️</button>
                <Toggle value={c.active} onChange={async (v) => {
                  try {
                    await update(c.id, { active: v });
                    show(v ? "✅ تم التفعيل" : "⏸️ تم التعطيل");
                  } catch (err: any) {
                    show("❌ خطأ", "error");
                  }
                }} />
              </div>
              <div className="flex-1 text-right mr-3">
                <div className="font-bold flex items-center justify-end gap-2 text-sm">
                  {c.name_ar}
                  <span className="text-[10px] text-muted px-2 py-0.5 bg-surface-elevated rounded-full">
                    {c.type === "auto" ? "🤖 تلقائي" : "✍️ يدوي"}
                  </span>
                </div>
                <div className="text-muted text-xs mt-0.5 truncate max-w-[200px] inline-block">{c.name_he}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Form Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "✏️ تعديل التصنيف" : "➕ تصنيف جديد"}
        footer={<button onClick={handleSave} className="btn-primary w-full">{editId ? "💾 حفظ التعديلات" : "✅ إضافة"}</button>}
      >
        <div className="grid grid-cols-2 gap-3 mb-2">
          <FormField label="الاسم (عربي) *" required>
            <input className="input" value={form.name_ar || ""} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
          </FormField>
          <FormField label="השם (עברית) *" required>
            <input className="input" value={form.name_he || ""} onChange={(e) => setForm({ ...form, name_he: e.target.value })} dir="rtl" />
          </FormField>
        </div>

        <FormField label="نوع التصنيف">
          <select className="input" value={form.type || "manual"} onChange={(e) => setForm({ ...form, type: e.target.value as any })}>
            <option value="manual">✍️ يدوي (تحديد المنتجات)</option>
            <option value="auto">🤖 تلقائي (قواعد معينة)</option>
          </select>
        </FormField>

        {form.type === "auto" && (
          <FormField label="قاعدة التحديد (مثال: السعر أقل من 100)">
            <input className="input" value={form.rule || ""} onChange={(e) => setForm({ ...form, rule: e.target.value })} placeholder="price < 100" />
            <div className="text-[9px] text-muted mt-1 text-right">سيتم إضافة المنتجات لهذا التصنيف تلقائياً بناءً على القاعدة لاحقاً</div>
          </FormField>
        )}

        <div className="flex items-center gap-4 mt-3">
          <div className="flex-1">
            <FormField label="ترتيب العرض">
              <input type="number" className="input" value={form.sort_order || 0} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) })} dir="ltr" />
            </FormField>
          </div>
          <label className="flex items-center gap-2 mt-4 cursor-pointer">
            <Toggle value={form.active !== false} onChange={(v) => setForm({ ...form, active: v })} />
            <span className="text-xs font-bold text-muted">مفعّل</span>
          </label>
        </div>
      </Modal>

      <ConfirmDialog 
        open={!!confirmDelete} 
        onClose={() => setConfirmDelete(null)} 
        onConfirm={handleDelete} 
        title="🗑️ حذف التصنيف؟" 
        message="هل أنت متأكد من حذف هذا التصنيف؟ لا يمكن التراجع عن هذا الإجراء." 
      />

      {toasts.map((t) => (
        <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>
          {t.message}
        </div>
      ))}
    </div>
  );
}
