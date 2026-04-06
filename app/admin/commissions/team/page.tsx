"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { FormField, ToastContainer } from "@/components/admin/shared";
import { getCsrfToken } from "@/lib/csrf-client";
import { COMMISSION } from "@/lib/commissions/calculator";

interface EmployeeWithProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  profile: {
    line_multiplier: number;
    device_rate: number;
    device_milestone_bonus: number;
    min_package_price: number;
    loyalty_bonuses: Record<string, number>;
    notes: string | null;
    active: boolean;
  } | null;
}

export default function TeamCommissionsPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [lineMultiplier, setLineMultiplier] = useState(4);
  const [deviceRate, setDeviceRate] = useState(0.05);
  const [milestonBonus, setMilestoneBonus] = useState(0);
  const [minPackage, setMinPackage] = useState(19.90);
  const [notes, setNotes] = useState("");

  const fetchEmployees = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/commissions/profiles");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setEmployees(json.data?.employees || []);
    } catch { show("שגיאה בטעינת נתוני הצוות", "error"); }
    finally { setLoading(false); }
  }, [show]);

  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);

  const startEdit = (emp: EmployeeWithProfile) => {
    setEditingId(emp.id);
    const p = emp.profile;
    setLineMultiplier(p?.line_multiplier ?? COMMISSION.LINE_MULTIPLIER);
    setDeviceRate(p?.device_rate ?? COMMISSION.DEVICE_RATE);
    setMilestoneBonus(p?.device_milestone_bonus ?? 0);
    setMinPackage(p?.min_package_price ?? COMMISSION.MIN_PACKAGE_PRICE);
    setNotes(p?.notes || "");
  };

  const saveProfile = async () => {
    if (!editingId) return;
    setSaving(true);
    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/api/admin/commissions/profiles", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          user_id: editingId,
          line_multiplier: lineMultiplier,
          device_rate: deviceRate,
          device_milestone_bonus: milestonBonus,
          min_package_price: minPackage,
          notes: notes || undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      show("הפרופיל נשמר בהצלחה", "success");
      setEditingId(null);
      fetchEmployees();
    } catch { show("שגיאה בשמירת הפרופיל", "error"); }
    finally { setSaving(false); }
  };

  const deleteProfile = async (userId: string) => {
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/admin/commissions/profiles?user_id=${userId}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      });
      if (!res.ok) throw new Error("Failed");
      show("הפרופיל הוסר — ישוב לשיעורי החוזה", "success");
      fetchEmployees();
    } catch { show("שגיאה במחיקת הפרופיל", "error"); }
  };

  if (loading) return <div className="text-center py-20 text-muted" dir="rtl">טוען...</div>;

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>👥 ניהול עמלות צוות</h1>
        <Link href="/admin/commissions" className="chip">← חזור</Link>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
        <Link href="/admin/commissions/team" className="chip chip-active">צוות</Link>
      </div>

      {/* Contract rates reference */}
      <div className="card mb-4" style={{ padding: 12, borderRight: "4px solid #3b82f6" }}>
        <div className="text-[11px] text-muted mb-1">שיעורי חוזה HOT (ברירת מחדל)</div>
        <div className="flex gap-4 text-[11px]">
          <span>קו: מחיר × <strong>{COMMISSION.LINE_MULTIPLIER}</strong></span>
          <span>מכשירים: <strong>{(COMMISSION.DEVICE_RATE * 100).toFixed(0)}%</strong></span>
          <span>מדרגה: <strong>₪{COMMISSION.DEVICE_MILESTONE_BONUS.toLocaleString()}</strong> / ₪{COMMISSION.DEVICE_MILESTONE.toLocaleString()}</span>
          <span>מינימום חבילה: <strong>₪{COMMISSION.MIN_PACKAGE_PRICE}</strong></span>
        </div>
      </div>

      {/* Employees table */}
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <table className="w-full text-[11px]">
          <thead>
            <tr className="border-b border-surface-border" style={{ background: "#18181b" }}>
              <th className="p-2 text-right">שם</th>
              <th className="p-2 text-right">תפקיד</th>
              <th className="p-2 text-center">כפולה קו</th>
              <th className="p-2 text-center">% מכשירים</th>
              <th className="p-2 text-center">בונוס מדרגה</th>
              <th className="p-2 text-center">סטטוס</th>
              <th className="p-2 text-center">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => (
              <tr key={emp.id} className="border-b border-surface-border hover:bg-surface-hover">
                <td className="p-2 font-bold">{emp.name}</td>
                <td className="p-2 text-muted">{emp.role}</td>
                <td className="p-2 text-center">{emp.profile?.line_multiplier ?? "—"}</td>
                <td className="p-2 text-center">{emp.profile ? `${(emp.profile.device_rate * 100).toFixed(1)}%` : "—"}</td>
                <td className="p-2 text-center">{emp.profile ? `₪${emp.profile.device_milestone_bonus}` : "—"}</td>
                <td className="p-2 text-center">
                  {emp.profile ? (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#22c55e20", color: "#22c55e" }}>מוגדר</span>
                  ) : (
                    <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: "#78716c20", color: "#78716c" }}>חוזה</span>
                  )}
                </td>
                <td className="p-2 text-center">
                  <button onClick={() => startEdit(emp)} className="btn-outline text-[10px]" style={{ padding: "3px 10px" }}>
                    {emp.profile ? "ערוך" : "הגדר"}
                  </button>
                  {emp.profile && (
                    <button onClick={() => deleteProfile(emp.id)} className="text-[10px] mr-1" style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer" }}>
                      מחק
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {employees.length === 0 && (
              <tr><td colSpan={7} className="p-4 text-center text-muted">אין עובדים במערכת. הוסף עובדים דרך ניהול צוות CRM.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ background: "rgba(0,0,0,0.7)" }}>
          <div className="card" style={{ width: scr.mobile ? "95%" : 420, padding: 20 }}>
            <h3 className="font-bold text-sm mb-3">
              הגדרת עמלות — {employees.find(e => e.id === editingId)?.name}
            </h3>

            <FormField label={`כפולת קו (חוזה: ${COMMISSION.LINE_MULTIPLIER})`}>
              <input type="number" className="input" step="0.1" value={lineMultiplier} onChange={(e) => setLineMultiplier(parseFloat(e.target.value) || 0)} />
            </FormField>

            <FormField label={`אחוז מכשירים (חוזה: ${COMMISSION.DEVICE_RATE * 100}%)`}>
              <input type="number" className="input" step="0.01" value={deviceRate} onChange={(e) => setDeviceRate(parseFloat(e.target.value) || 0)} />
              <div className="text-[10px] text-muted mt-1">הזן כעשרוני: 0.03 = 3%</div>
            </FormField>

            <FormField label={`בונוס מדרגה (חוזה: ₪${COMMISSION.DEVICE_MILESTONE_BONUS})`}>
              <input type="number" className="input" value={milestonBonus} onChange={(e) => setMilestoneBonus(parseFloat(e.target.value) || 0)} />
              <div className="text-[10px] text-muted mt-1">0 = ללא בונוס מדרגה לעובד</div>
            </FormField>

            <FormField label="מינימום מחיר חבילה (₪)">
              <input type="number" className="input" step="0.1" value={minPackage} onChange={(e) => setMinPackage(parseFloat(e.target.value) || 0)} />
            </FormField>

            <FormField label="הערות">
              <input type="text" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות אופציונליות..." />
            </FormField>

            {/* Example calculation */}
            <div className="card mb-3" style={{ padding: 10, background: "#18181b", fontSize: 10 }}>
              <div className="text-muted mb-1">דוגמה: חבילה ₪30</div>
              <div className="flex justify-between">
                <span>עמלת חוזה: ₪{(30 * COMMISSION.LINE_MULTIPLIER)}</span>
                <span style={{ color: "#22c55e" }}>עמלת עובד: ₪{(30 * lineMultiplier).toFixed(0)}</span>
                <span style={{ color: "#8b5cf6" }}>רווחך: ₪{(30 * COMMISSION.LINE_MULTIPLIER - 30 * lineMultiplier).toFixed(0)}</span>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={saveProfile} disabled={saving} className="btn-primary flex-1" style={{ fontSize: 12 }}>
                {saving ? "שומר..." : "שמור"}
              </button>
              <button onClick={() => setEditingId(null)} className="btn-outline flex-1" style={{ fontSize: 12 }}>
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
