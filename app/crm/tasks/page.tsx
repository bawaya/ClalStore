"use client";

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { TASK_PRIORITY } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { Modal, FormField, PageHeader, EmptyState, ConfirmDialog } from "@/components/admin/shared";

const STATUS_MAP: Record<string, { icon: string; label: string; color: string }> = {
  open: { icon: "🔵", label: "مفتوحة", color: "#3b82f6" },
  in_progress: { icon: "🟡", label: "قيد التنفيذ", color: "#eab308" },
  done: { icon: "🟢", label: "مكتملة", color: "#22c55e" },
};

const EMPTY_TASK = { title: "", description: "", priority: "medium", status: "open", due_date: "" };

export default function TasksPage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_TASK);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter !== "all") params.set("status", statusFilter);
    const res = await fetch(`/api/crm/tasks?${params}`);
    const json = await res.json();
    setTasks(json.data || []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const openCreate = () => { setForm(EMPTY_TASK); setEditId(null); setModal(true); };
  const openEdit = (t: any) => { setForm({ ...t, due_date: t.due_date?.slice(0, 10) || "" }); setEditId(t.id); setModal(true); };

  const handleSave = async () => {
    if (!form.title) { show("❌ العنوان مطلوب", "error"); return; }
    try {
      const payload = { ...form };
      if (!payload.due_date) delete payload.due_date;
      if (editId) {
        const { id: _id, customers: _customers, orders: _orders, created_at: _created_at, updated_at: _updated_at, ...updates } = payload;
        await fetch("/api/crm/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...updates }) });
        show("✅ تم التعديل");
      } else {
        await fetch("/api/crm/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        show("✅ تم الإضافة");
      }
      setModal(false); fetchTasks();
    } catch (err: any) { show(`❌ ${err.message}`, "error"); }
  };

  const toggleStatus = async (task: any) => {
    const next = task.status === "open" ? "in_progress" : task.status === "in_progress" ? "done" : "open";
    await fetch("/api/crm/tasks", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: task.id, status: next }) });
    show(`${STATUS_MAP[next].icon} ${STATUS_MAP[next].label}`);
    fetchTasks();
  };

  const handleDelete = async () => {
    if (!confirm) return;
    await fetch(`/api/crm/tasks?id=${confirm}`, { method: "DELETE" });
    show("🗑️ تم"); setConfirm(null); fetchTasks();
  };

  const filtered = statusFilter === "all" ? tasks : tasks.filter((t) => t.status === statusFilter);
  const overdue = tasks.filter((t) => t.due_date && new Date(t.due_date) < new Date() && t.status !== "done").length;

  return (
    <div>
      <PageHeader title="✅ المهام" count={tasks.length} onAdd={openCreate} addLabel="مهمة جديدة" />

      {overdue > 0 && (
        <div className="bg-state-error/10 rounded-xl px-3 py-2 mb-3 text-state-error text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>
          ⏰ {overdue} مهام متأخرة!
        </div>
      )}

      {/* Status tabs */}
      <div className="flex gap-1 mb-3">
        <button onClick={() => setStatusFilter("all")} className={`chip ${statusFilter === "all" ? "chip-active" : ""}`}>الكل ({tasks.length})</button>
        {Object.entries(STATUS_MAP).map(([k, v]) => (
          <button key={k} onClick={() => setStatusFilter(k)}
            className={`chip ${statusFilter === k ? "chip-active" : ""}`}>
            {v.icon} {v.label} ({tasks.filter((t) => t.status === k).length})
          </button>
        ))}
      </div>

      {/* Task list */}
      {loading ? <div className="text-center py-12 text-muted">⏳</div> :
        filtered.length === 0 ? <EmptyState icon="✅" title="لا يوجد مهام" /> : (
          <div className="space-y-1.5">
            {filtered.map((t) => {
              const st = STATUS_MAP[t.status];
              const pr = TASK_PRIORITY[t.priority as keyof typeof TASK_PRIORITY];
              const isOverdue = t.due_date && new Date(t.due_date) < new Date() && t.status !== "done";
              return (
                <div key={t.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
                  style={{ padding: scr.mobile ? "10px 12px" : "14px 18px", opacity: t.status === "done" ? 0.6 : 1 }}
                  onClick={() => openEdit(t)}>
                  <div className="flex gap-2">
                    <button onClick={(e) => { e.stopPropagation(); setConfirm(t.id); }}
                      className="w-6 h-6 rounded-md border border-state-error/30 bg-transparent text-state-error text-[10px] cursor-pointer flex items-center justify-center">🗑</button>
                    <button onClick={(e) => { e.stopPropagation(); toggleStatus(t); }}
                      className="w-7 h-7 rounded-full border-2 cursor-pointer flex items-center justify-center text-xs"
                      style={{ borderColor: st?.color, background: t.status === "done" ? st?.color : "transparent", color: t.status === "done" ? "white" : st?.color }}>
                      {t.status === "done" ? "✓" : ""}
                    </button>
                  </div>
                  <div className="flex-1 text-right mr-2">
                    <div className="flex items-center gap-1.5 justify-end">
                      <span className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14, textDecoration: t.status === "done" ? "line-through" : "none" }}>
                        {t.title}
                      </span>
                      {pr && <span className="badge" style={{ background: `${pr.color}15`, color: pr.color }}>{pr.icon}</span>}
                      {st && <span className="text-[9px]" style={{ color: st.color }}>{st.icon}</span>}
                    </div>
                    <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>
                      {t.customers?.name && <span>👤 {t.customers.name} </span>}
                      {t.orders?.id && <span>📦 {t.orders.id} </span>}
                      {t.due_date && (
                        <span style={{ color: isOverdue ? "#ef4444" : "#71717a" }}>
                          📅 {formatDate(t.due_date)} {isOverdue && "⏰"}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

      {/* Task Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل مهمة" : "مهمة جديدة"}
        footer={<div className="flex gap-2">
          {editId && <button onClick={() => { setModal(false); setConfirm(editId); }}
            className="px-4 py-2.5 rounded-xl bg-state-error/10 text-state-error font-bold cursor-pointer border border-state-error/30">🗑️</button>}
          <button onClick={handleSave} className="btn-primary flex-1">{editId ? "💾 حفظ" : "✅ إضافة"}</button>
        </div>}>
        <FormField label="العنوان" required><input className="input" value={form.title || ""} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="متابعة طلب / اتصال..." /></FormField>
        <FormField label="الوصف"><textarea className="input min-h-[60px] resize-y" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} /></FormField>
        <FormField label="الأولوية">
          <div className="flex gap-1.5">
            {Object.entries(TASK_PRIORITY).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, priority: k })}
                className={`chip flex-1 ${form.priority === k ? "chip-active" : ""}`}>{v.icon} {v.label}</button>
            ))}
          </div>
        </FormField>
        <FormField label="الحالة">
          <div className="flex gap-1.5">
            {Object.entries(STATUS_MAP).map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, status: k })}
                className={`chip flex-1 ${form.status === k ? "chip-active" : ""}`}>{v.icon} {v.label}</button>
            ))}
          </div>
        </FormField>
        <FormField label="تاريخ الاستحقاق"><input className="input" type="date" value={form.due_date || ""} onChange={(e) => setForm({ ...form, due_date: e.target.value })} dir="ltr" /></FormField>

      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete} title="حذف المهمة؟" message="لا يمكن التراجع" />
      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
