"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { FormField, ToastContainer, ConfirmDialog } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import { COMMISSION, type SanctionKey } from "@/lib/commissions/calculator";
import { getCsrfToken } from "@/lib/csrf-client";
import { lastDayOfMonth } from "@/lib/commissions/date-utils";

interface Sanction {
  id: number;
  sanction_date: string;
  sanction_type: string;
  amount: number;
  has_sale_offset: boolean;
  description: string | null;
}

export default function SanctionsPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const [sanctions, setSanctions] = useState<Sanction[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  // Form state
  const [formType, setFormType] = useState<SanctionKey>("FAKE_PAYMENT");
  const [formDate, setFormDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [formAmount, setFormAmount] = useState(2500);
  const [formOffset, setFormOffset] = useState(true);
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);

  // Commission preview
  const [previewNet, setPreviewNet] = useState<number | null>(null);

  const currentMonth = new Date().toISOString().slice(0, 7);

  const fetchSanctions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/commissions/sanctions?from=${currentMonth}-01&to=${lastDayOfMonth(currentMonth)}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      setSanctions(json.data || []);
    } catch { show("שגיאה בטעינת סנקציות", "error"); }
    finally { setLoading(false); }
  }, [currentMonth, show]);

  const fetchPreview = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/commissions/dashboard?month=${currentMonth}`);
      if (!res.ok) return;
      const json = await res.json();
      const d = json.data || json;
      setPreviewNet(d.summary?.netCommission || 0);
    } catch { /* silent */ }
  }, [currentMonth]);

  useEffect(() => { fetchSanctions(); fetchPreview(); }, [fetchSanctions, fetchPreview]);

  // Auto-update amount when type changes
  const handleTypeChange = (key: SanctionKey) => {
    setFormType(key);
    const s = COMMISSION.SANCTIONS[key];
    setFormAmount(s.amount);
    setFormOffset(s.withOffset);
  };

  const handleSubmit = async () => {
    if (!formDate) { show("יש לבחור תאריך", "warning"); return; }
    setSaving(true);
    try {
      const res = await fetch("/api/admin/commissions/sanctions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": getCsrfToken() },
        body: JSON.stringify({
          sanction_type: formType,
          sanction_date: formDate,
          amount: formAmount,
          has_sale_offset: formOffset,
          description: formDesc || null,
        }),
      });
      if (!res.ok) throw new Error();
      show("הסנקציה נוספה", "success");
      setFormDesc("");
      fetchSanctions();
      fetchPreview();
    } catch { show("שגיאה בהוספת סנקציה", "error"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      const res = await fetch(`/api/admin/commissions/sanctions?id=${deleteId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": getCsrfToken() },
      });
      if (!res.ok) throw new Error();
      show("הסנקציה נמחקה", "success");
      setDeleteId(null);
      fetchSanctions();
      fetchPreview();
    } catch { show("שגיאה במחיקה", "error"); }
  };

  const totalSanctions = sanctions.reduce((s, x) => s + x.amount, 0);

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>⚠️ סנקציות</h1>
        <Link href="/admin/commissions" className="chip">← חזור</Link>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip chip-active">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
        <Link href="/admin/commissions/team" className="chip">צוות</Link>
        <Link href="/admin/commissions/live" className="chip">📊 לוח חי</Link>
      </div>

      {/* Impact Preview */}
      {previewNet !== null && (
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-2 text-right" style={{ fontSize: 12 }}>📊 השפעה על עמלות</h3>
          <div className="flex items-center justify-center gap-4 text-sm">
            <span className="font-bold" style={{ color: "#22c55e" }}>{formatCurrency(previewNet)}</span>
            <span className="text-muted">←</span>
            <span className="font-bold" style={{ color: "#f97316" }}>-{formatCurrency(totalSanctions)}</span>
            <span className="text-muted">←</span>
            <span className="font-bold">{formatCurrency(previewNet + totalSanctions)}</span>
          </div>
          <div className="flex items-center justify-center gap-4 text-[9px] text-muted">
            <span>אחרי סנקציות</span>
            <span />
            <span>סנקציות</span>
            <span />
            <span>לפני סנקציות</span>
          </div>
        </div>
      )}

      <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
        {/* Add Sanction Form */}
        <div className="card mb-4" style={{ padding: scr.mobile ? 12 : 18, width: scr.mobile ? "100%" : 340 }}>
          <h3 className="font-bold mb-3 text-right" style={{ fontSize: 12 }}>+ הוסף סנקציה</h3>

          <FormField label="סוג סנקציה" required>
            <select className="input" value={formType} onChange={(e) => handleTypeChange(e.target.value as SanctionKey)}>
              {Object.entries(COMMISSION.SANCTIONS).map(([key, val]) => (
                <option key={key} value={key}>{val.label}</option>
              ))}
            </select>
          </FormField>

          <FormField label="תאריך" required>
            <input type="date" className="input" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
          </FormField>

          <FormField label="סכום (₪)">
            <input type="number" className="input" value={formAmount} onChange={(e) => setFormAmount(parseFloat(e.target.value) || 0)} />
          </FormField>

          <div className="flex items-center gap-2 mb-3">
            <label className="text-muted text-xs">כולל קיזוז מכירה</label>
            <button
              onClick={() => setFormOffset(!formOffset)}
              className="rounded-full transition-all cursor-pointer border-0"
              style={{ width: 38, height: 20, background: formOffset ? "#c41040" : "#3f3f46", padding: 2 }}
            >
              <div className="w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: formOffset ? "translateX(-18px)" : "translateX(0)" }} />
            </button>
          </div>

          <FormField label="הערות">
            <textarea className="input" rows={2} value={formDesc} onChange={(e) => setFormDesc(e.target.value)} />
          </FormField>

          <button onClick={handleSubmit} disabled={saving} className="btn-primary w-full" style={{ opacity: saving ? 0.5 : 1 }}>
            {saving ? "⏳ שומר..." : "הוסף סנקציה"}
          </button>
        </div>

        {/* Sanctions Table */}
        <div className="card flex-1 mb-4" style={{ padding: scr.mobile ? 12 : 18 }}>
          <h3 className="font-bold mb-3 text-right" style={{ fontSize: 12 }}>📋 סנקציות החודש</h3>
          {loading ? (
            <div className="text-center text-muted text-xs py-8">⏳ טוען...</div>
          ) : sanctions.length === 0 ? (
            <div className="text-center text-dim text-xs py-8">
              <div className="text-3xl mb-2">✅</div>
              <div>אין סנקציות החודש</div>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>
                  <thead>
                    <tr className="text-muted border-b border-surface-border">
                      <th className="py-1.5 font-semibold">פעולות</th>
                      <th className="py-1.5 font-semibold">הערות</th>
                      <th className="py-1.5 font-semibold">קיזוז</th>
                      <th className="py-1.5 font-semibold">סכום</th>
                      <th className="py-1.5 font-semibold">סוג</th>
                      <th className="py-1.5 font-semibold">תאריך</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sanctions.map((s) => {
                      const sanctionInfo = Object.values(COMMISSION.SANCTIONS).find((v) => v.label === s.sanction_type)
                        || { label: s.sanction_type };
                      return (
                        <tr key={s.id} className="border-b border-surface-border/50">
                          <td className="py-1.5">
                            <button
                              onClick={() => setDeleteId(s.id)}
                              className="text-state-error bg-transparent border-0 cursor-pointer text-[10px] font-bold"
                            >
                              🗑️
                            </button>
                          </td>
                          <td className="py-1.5 text-muted">{s.description || "—"}</td>
                          <td className="py-1.5">{s.has_sale_offset ? "✅" : "—"}</td>
                          <td className="py-1.5 font-bold" style={{ color: "#ef4444" }}>{formatCurrency(s.amount)}</td>
                          <td className="py-1.5 text-[10px]">{sanctionInfo.label}</td>
                          <td className="py-1.5">{s.sanction_date}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-right border-t border-surface-border pt-2 font-bold text-sm">
                סה״כ סנקציות: <span style={{ color: "#ef4444" }}>{formatCurrency(totalSanctions)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDelete}
        title="מחיקת סנקציה"
        message="האם למחוק את הסנקציה? פעולה זו לא ניתנת לביטול."
      />
    </div>
  );
}
