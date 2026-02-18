"use client";

import { useState, useEffect, useCallback } from "react";
import { useScreen, useToast } from "@/lib/hooks";
import { PIPELINE_STAGE } from "@/lib/constants";
import { formatCurrency, timeAgo } from "@/lib/utils";
import { Modal, FormField, PageHeader, EmptyState, ConfirmDialog } from "@/components/admin/shared";

const EMPTY_DEAL = { customer_name: "", product_summary: "", value: 0, stage: "lead", source: "store", notes: "" };

export default function PipelinePage() {
  const scr = useScreen();
  const { toasts, show } = useToast();
  const [deals, setDeals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState<any>(EMPTY_DEAL);
  const [editId, setEditId] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"board" | "list">(scr.mobile ? "list" : "board");

  const fetchDeals = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/crm/pipeline");
    const json = await res.json();
    setDeals(json.data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchDeals(); }, [fetchDeals]);

  const openCreate = () => { setForm(EMPTY_DEAL); setEditId(null); setModal(true); };
  const openEdit = (d: any) => { setForm({ ...d }); setEditId(d.id); setModal(true); };

  const handleSave = async () => {
    if (!form.customer_name || !form.value) { show("❌ عبّي الحقول", "error"); return; }
    try {
      if (editId) {
        const { id, customers, created_at, updated_at, ...updates } = form;
        await fetch("/api/crm/pipeline", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: editId, ...updates }) });
        show("✅ تم التعديل");
      } else {
        await fetch("/api/crm/pipeline", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
        show("✅ تم الإضافة");
      }
      setModal(false); fetchDeals();
    } catch (err: any) { show(`❌ ${err.message}`, "error"); }
  };

  const moveStage = async (dealId: string, stage: string) => {
    await fetch("/api/crm/pipeline", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: dealId, stage }) });
    show(`✅ → ${PIPELINE_STAGE[stage as keyof typeof PIPELINE_STAGE]?.label}`);
    fetchDeals();
  };

  const handleDelete = async () => {
    if (!confirm) return;
    await fetch(`/api/crm/pipeline?id=${confirm}`, { method: "DELETE" });
    show("🗑️ تم الحذف"); setConfirm(null); fetchDeals();
  };

  const stages = Object.entries(PIPELINE_STAGE);
  const totalValue = deals.filter((d) => d.stage !== "lost").reduce((s, d) => s + Number(d.value), 0);

  if (loading) return <div className="text-center py-20 text-muted">⏳</div>;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1.5">
          <button onClick={openCreate} className="btn-primary" style={{ fontSize: scr.mobile ? 10 : 12, padding: scr.mobile ? "8px 14px" : "10px 20px" }}>+ صفقة</button>
          {!scr.mobile && (
            <div className="flex gap-0.5">
              <button onClick={() => setViewMode("board")} className={`chip ${viewMode === "board" ? "chip-active" : ""}`}>🏗️ Board</button>
              <button onClick={() => setViewMode("list")} className={`chip ${viewMode === "list" ? "chip-active" : ""}`}>📋 List</button>
            </div>
          )}
        </div>
        <div>
          <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>🎯 Pipeline</h1>
          <div className="text-muted text-right" style={{ fontSize: scr.mobile ? 9 : 11 }}>{deals.length} صفقة • {formatCurrency(totalValue)}</div>
        </div>
      </div>

      {deals.length === 0 ? <EmptyState icon="🎯" title="لا يوجد صفقات" sub="أنشئ أول صفقة" /> : viewMode === "board" && !scr.mobile ? (
        /* Board View */
        <div className="flex gap-2 overflow-x-auto pb-4">
          {stages.map(([key, info]) => {
            const stagDeals = deals.filter((d) => d.stage === key);
            const stageVal = stagDeals.reduce((s, d) => s + Number(d.value), 0);
            return (
              <div key={key} className="flex-1 min-w-[200px]">
                <div className="rounded-xl px-3 py-2 mb-2 text-center" style={{ background: `${info.color}15` }}>
                  <div className="font-bold text-sm" style={{ color: info.color }}>{info.icon} {info.label}</div>
                  <div className="text-[10px] text-muted">{stagDeals.length} • {formatCurrency(stageVal)}</div>
                </div>
                <div className="space-y-1.5">
                  {stagDeals.map((d) => (
                    <div key={d.id} className="card cursor-pointer hover:border-brand/30" style={{ padding: 12 }} onClick={() => openEdit(d)}>
                      <div className="font-bold text-sm text-right mb-0.5">{d.customer_name}</div>
                      <div className="text-muted text-[10px] text-right mb-1">{d.product_summary || "—"}</div>
                      <div className="flex justify-between items-center">
                        <div className="flex gap-0.5">
                          {stages.filter(([sk]) => sk !== key && sk !== "lost").slice(0, 2).map(([sk, si]) => (
                            <button key={sk} onClick={(e) => { e.stopPropagation(); moveStage(d.id, sk); }}
                              className="text-[7px] px-1 py-0.5 rounded border cursor-pointer"
                              style={{ borderColor: `${si.color}40`, color: si.color, background: `${si.color}08` }}>
                              {si.icon}
                            </button>
                          ))}
                        </div>
                        <span className="font-black text-brand text-sm">{formatCurrency(Number(d.value))}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* List View */
        <div className="space-y-1.5">
          {deals.map((d) => {
            const stg = PIPELINE_STAGE[d.stage as keyof typeof PIPELINE_STAGE];
            return (
              <div key={d.id} className="card flex items-center justify-between cursor-pointer hover:border-brand/30"
                style={{ padding: scr.mobile ? "10px 12px" : "14px 18px" }} onClick={() => openEdit(d)}>
                <div className="flex items-center gap-1.5">
                  <span className="font-black text-brand" style={{ fontSize: scr.mobile ? 14 : 18 }}>{formatCurrency(Number(d.value))}</span>
                  <div className="flex gap-0.5">
                    {stages.filter(([sk]) => sk !== d.stage).slice(0, 3).map(([sk, si]) => (
                      <button key={sk} onClick={(e) => { e.stopPropagation(); moveStage(d.id, sk); }}
                        className="text-[8px] px-1.5 py-0.5 rounded border cursor-pointer"
                        style={{ borderColor: `${si.color}40`, color: si.color, background: `${si.color}08` }}>
                        {si.icon}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 text-right mr-2">
                  <div className="flex items-center gap-1.5 justify-end">
                    <span className="font-bold" style={{ fontSize: scr.mobile ? 12 : 14 }}>{d.customer_name}</span>
                    {stg && <span className="badge" style={{ background: `${stg.color}15`, color: stg.color }}>{stg.icon} {stg.label}</span>}
                  </div>
                  <div className="text-muted" style={{ fontSize: scr.mobile ? 9 : 11 }}>{d.product_summary || "—"} • {timeAgo(d.created_at)}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Deal Modal */}
      <Modal open={modal} onClose={() => setModal(false)} title={editId ? "تعديل صفقة" : "صفقة جديدة"}>
        <FormField label="اسم الزبون" required><input className="input" value={form.customer_name || ""} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} /></FormField>
        <FormField label="ملخص المنتج"><input className="input" value={form.product_summary || ""} onChange={(e) => setForm({ ...form, product_summary: e.target.value })} placeholder="iPhone 17 + كفر" /></FormField>
        <FormField label="القيمة ₪" required><input className="input" type="number" value={form.value || ""} onChange={(e) => setForm({ ...form, value: Number(e.target.value) })} dir="ltr" /></FormField>
        <FormField label="المرحلة">
          <div className="flex gap-1 flex-wrap">
            {stages.map(([k, v]) => (
              <button key={k} onClick={() => setForm({ ...form, stage: k })}
                className={`chip ${form.stage === k ? "chip-active" : ""}`}>{v.icon} {v.label}</button>
            ))}
          </div>
        </FormField>
        <FormField label="ملاحظات"><textarea className="input min-h-[60px] resize-y" value={form.notes || ""} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></FormField>

        <div className="flex gap-2 mt-3">
          {editId && <button onClick={() => { setModal(false); setConfirm(editId); }}
            className="px-4 py-2.5 rounded-xl bg-state-error/10 text-state-error font-bold cursor-pointer border border-state-error/30">🗑️ حذف</button>}
          <button onClick={handleSave} className="btn-primary flex-1">{editId ? "💾 حفظ" : "✅ إضافة"}</button>
        </div>
      </Modal>

      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} onConfirm={handleDelete} title="حذف الصفقة؟" message="لا يمكن التراجع" />
      {toasts.map((t) => <div key={t.id} className={`fixed bottom-5 left-1/2 -translate-x-1/2 card font-bold z-[999] shadow-2xl px-6 py-3 text-sm ${t.type === "error" ? "border-state-error text-state-error" : "border-state-success text-state-success"}`}>{t.message}</div>)}
    </div>
  );
}
