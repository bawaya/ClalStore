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

interface CommissionEmployee {
  id: number;
  name: string;
  phone: string | null;
  token: string;
  role: string;
  active: boolean;
  notes: string | null;
  created_at: string;
}

interface LeaderboardEntry {
  name: string;
  linesCount: number;
  devicesCount: number;
  lineCommission: number;
  deviceCommission: number;
  totalCommission: number;
}

type TabId = "employees" | "profiles" | "leaderboard";

export default function TeamCommissionsPage() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const [activeTab, setActiveTab] = useState<TabId>("employees");

  // === Commission Employees State ===
  const [commEmployees, setCommEmployees] = useState<CommissionEmployee[]>([]);
  const [loadingEmp, setLoadingEmp] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editEmpId, setEditEmpId] = useState<number | null>(null);
  const [empName, setEmpName] = useState("");
  const [empPhone, setEmpPhone] = useState("");
  const [empRole, setEmpRole] = useState("sales");
  const [empNotes, setEmpNotes] = useState("");
  const [savingEmp, setSavingEmp] = useState(false);
  const [visibleTokens, setVisibleTokens] = useState<Set<number>>(new Set());

  // === Profiles State ===
  const [employees, setEmployees] = useState<EmployeeWithProfile[]>([]);
  const [loadingProf, setLoadingProf] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [lineMultiplier, setLineMultiplier] = useState(4);
  const [deviceRate, setDeviceRate] = useState(0.05);
  const [milestonBonus, setMilestoneBonus] = useState(0);
  const [minPackage, setMinPackage] = useState(19.90);
  const [notes, setNotes] = useState("");

  // === Leaderboard State ===
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loadingLB, setLoadingLB] = useState(true);
  const [lbMonth, setLbMonth] = useState(() => new Date().toISOString().slice(0, 7));

  // ========================
  // Commission Employees CRUD
  // ========================
  const fetchCommEmployees = useCallback(async () => {
    setLoadingEmp(true);
    try {
      const res = await fetch("/api/admin/commissions/employees");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setCommEmployees(json.data?.employees || []);
    } catch { show("שגיאה בטעינת עובדים", "error"); }
    finally { setLoadingEmp(false); }
  }, [show]);

  const saveCommEmployee = async () => {
    if (!empName.trim()) { show("שם נדרש", "error"); return; }
    setSavingEmp(true);
    try {
      const csrf = await getCsrfToken();
      const body: Record<string, unknown> = { name: empName.trim(), phone: empPhone || undefined, role: empRole, notes: empNotes || undefined };
      if (editEmpId) body.id = editEmpId;
      const res = await fetch("/api/admin/commissions/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Failed");
      show(editEmpId ? "עובד עודכן" : "עובד נוסף בהצלחה", "success");
      resetEmpForm();
      fetchCommEmployees();
    } catch { show("שגיאה בשמירה", "error"); }
    finally { setSavingEmp(false); }
  };

  const deleteCommEmployee = async (id: number) => {
    try {
      const csrf = await getCsrfToken();
      const res = await fetch(`/api/admin/commissions/employees?id=${id}`, {
        method: "DELETE",
        headers: { "x-csrf-token": csrf },
      });
      if (!res.ok) throw new Error("Failed");
      show("עובד הוסר", "success");
      fetchCommEmployees();
    } catch { show("שגיאה במחיקה", "error"); }
  };

  const regenerateToken = async (id: number) => {
    try {
      const csrf = await getCsrfToken();
      const res = await fetch("/api/admin/commissions/employees", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error("Failed");
      show("טוקן חדש נוצר", "success");
      fetchCommEmployees();
    } catch { show("שגיאה ביצירת טוקן", "error"); }
  };

  const resetEmpForm = () => {
    setShowAddForm(false);
    setEditEmpId(null);
    setEmpName("");
    setEmpPhone("");
    setEmpRole("sales");
    setEmpNotes("");
  };

  const startEditEmp = (emp: CommissionEmployee) => {
    setEditEmpId(emp.id);
    setEmpName(emp.name);
    setEmpPhone(emp.phone || "");
    setEmpRole(emp.role);
    setEmpNotes(emp.notes || "");
    setShowAddForm(true);
  };

  const toggleToken = (id: number) => {
    setVisibleTokens(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    show("טוקן הועתק", "success");
  };

  // ========================
  // Profiles
  // ========================
  const fetchEmployees = useCallback(async () => {
    setLoadingProf(true);
    try {
      const res = await fetch("/api/admin/commissions/profiles");
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setEmployees(json.data?.employees || []);
    } catch { show("שגיאה בטעינת נתוני הצוות", "error"); }
    finally { setLoadingProf(false); }
  }, [show]);

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

  // ========================
  // Leaderboard
  // ========================
  const fetchLeaderboard = useCallback(async () => {
    setLoadingLB(true);
    try {
      const res = await fetch(`/api/admin/commissions/sales?from=${lbMonth}-01&to=${lbMonth}-31&limit=9999`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const sales = Array.isArray(json.data) ? json.data : (json.data?.sales || []);

      const byEmployee: Record<string, LeaderboardEntry> = {};
      for (const s of sales) {
        const name = s.employee_name || "ללא שיוך";
        if (!byEmployee[name]) byEmployee[name] = { name, linesCount: 0, devicesCount: 0, lineCommission: 0, deviceCommission: 0, totalCommission: 0 };
        if (s.sale_type === "line") {
          byEmployee[name].linesCount++;
          byEmployee[name].lineCommission += s.commission_amount || 0;
        } else {
          byEmployee[name].devicesCount++;
          byEmployee[name].deviceCommission += s.commission_amount || 0;
        }
        byEmployee[name].totalCommission += s.commission_amount || 0;
      }

      const sorted = Object.values(byEmployee).sort((a, b) => b.totalCommission - a.totalCommission);
      setLeaderboard(sorted);
    } catch { show("שגיאה בטעינת לוח מובילים", "error"); }
    finally { setLoadingLB(false); }
  }, [lbMonth, show]);

  // Fetch on tab switch
  useEffect(() => {
    if (activeTab === "employees") fetchCommEmployees();
    else if (activeTab === "profiles") fetchEmployees();
    else if (activeTab === "leaderboard") fetchLeaderboard();
  }, [activeTab, fetchCommEmployees, fetchEmployees, fetchLeaderboard]);

  const tabs: { id: TabId; label: string }[] = [
    { id: "employees", label: "עובדים" },
    { id: "profiles", label: "שיעורי עמלה" },
    { id: "leaderboard", label: "לוח מובילים" },
  ];

  const podiumColors = ["#eab308", "#a1a1aa", "#cd7f32"];
  const podiumLabels = ["🥇", "🥈", "🥉"];

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>ניהול צוות ועמלות</h1>
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
        <Link href="/admin/commissions/live" className="chip">📊 לוח חי</Link>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-1 mb-4 p-1 rounded-lg" style={{ background: "#18181b" }}>
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className="flex-1 py-1.5 rounded text-[11px] font-bold transition-colors"
            style={{
              background: activeTab === t.id ? "#c41040" : "transparent",
              color: activeTab === t.id ? "#fff" : "#a1a1aa",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ===================== TAB: EMPLOYEES ===================== */}
      {activeTab === "employees" && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="text-[11px] text-muted">עובדי עמלות — טוקנים לאפליקציה המקומית</div>
            <button onClick={() => { resetEmpForm(); setShowAddForm(true); }} className="btn-primary text-[11px]" style={{ padding: "5px 14px" }}>
              + הוסף עובד
            </button>
          </div>

          {/* Add/Edit form */}
          {showAddForm && (
            <div className="card mb-4" style={{ padding: 16, borderRight: "4px solid #c41040" }}>
              <h3 className="font-bold text-[12px] mb-3">{editEmpId ? "עריכת עובד" : "הוספת עובד חדש"}</h3>
              <div className="grid gap-2" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "1fr 1fr" }}>
                <FormField label="שם *">
                  <input type="text" className="input" value={empName} onChange={e => setEmpName(e.target.value)} placeholder="שם העובד" />
                </FormField>
                <FormField label="טלפון">
                  <input type="text" className="input" value={empPhone} onChange={e => setEmpPhone(e.target.value)} placeholder="050-0000000" />
                </FormField>
                <FormField label="תפקיד">
                  <select className="input" value={empRole} onChange={e => setEmpRole(e.target.value)}>
                    <option value="sales">מכירות</option>
                    <option value="manager">מנהל</option>
                    <option value="senior">בכיר</option>
                  </select>
                </FormField>
                <FormField label="הערות">
                  <input type="text" className="input" value={empNotes} onChange={e => setEmpNotes(e.target.value)} placeholder="הערות..." />
                </FormField>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={saveCommEmployee} disabled={savingEmp} className="btn-primary text-[11px]" style={{ padding: "6px 20px" }}>
                  {savingEmp ? "שומר..." : editEmpId ? "עדכן" : "הוסף"}
                </button>
                <button onClick={resetEmpForm} className="btn-outline text-[11px]" style={{ padding: "6px 20px" }}>ביטול</button>
              </div>
            </div>
          )}

          {loadingEmp ? (
            <div className="text-center py-10 text-muted text-[12px]">טוען...</div>
          ) : commEmployees.length === 0 ? (
            <div className="card text-center py-10 text-muted text-[12px]">אין עובדים — לחץ &quot;הוסף עובד&quot; להתחיל</div>
          ) : (
            <div className="space-y-2">
              {commEmployees.map(emp => (
                <div key={emp.id} className="card" style={{ padding: 12 }}>
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-bold text-[13px]">{emp.name}</span>
                      <span className="text-[10px] text-muted mr-2">{emp.role === "manager" ? "מנהל" : emp.role === "senior" ? "בכיר" : "מכירות"}</span>
                      {emp.phone && <span className="text-[10px] text-muted mr-2">{emp.phone}</span>}
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => startEditEmp(emp)} className="btn-outline text-[10px]" style={{ padding: "2px 8px" }}>ערוך</button>
                      <button onClick={() => deleteCommEmployee(emp.id)} className="text-[10px]" style={{ color: "#ef4444", background: "none", border: "1px solid #ef444440", borderRadius: 4, padding: "2px 8px", cursor: "pointer" }}>מחק</button>
                    </div>
                  </div>
                  {/* Token row */}
                  <div className="flex items-center gap-2" style={{ background: "#18181b", borderRadius: 6, padding: "6px 10px" }}>
                    <span className="text-[10px] text-muted">טוקן:</span>
                    <code className="text-[10px] flex-1" style={{ color: "#22c55e", fontFamily: "monospace" }}>
                      {visibleTokens.has(emp.id) ? emp.token : "••••••••••••••••"}
                    </code>
                    <button onClick={() => toggleToken(emp.id)} className="text-[9px] text-muted" style={{ background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                      {visibleTokens.has(emp.id) ? "הסתר" : "הצג"}
                    </button>
                    <button onClick={() => copyToken(emp.token)} className="text-[9px]" style={{ background: "none", border: "none", cursor: "pointer", color: "#3b82f6" }}>
                      העתק
                    </button>
                    <button onClick={() => regenerateToken(emp.id)} className="text-[9px]" style={{ background: "none", border: "none", cursor: "pointer", color: "#f97316" }}>
                      חדש
                    </button>
                  </div>
                  {emp.notes && <div className="text-[10px] text-muted mt-1">{emp.notes}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: PROFILES ===================== */}
      {activeTab === "profiles" && (
        <div>
          {/* Contract rates reference */}
          <div className="card mb-4" style={{ padding: 12, borderRight: "4px solid #3b82f6" }}>
            <div className="text-[11px] text-muted mb-1">שיעורי חוזה HOT (ברירת מחדל)</div>
            <div className="flex gap-4 text-[11px] flex-wrap">
              <span>קו: מחיר × <strong>{COMMISSION.LINE_MULTIPLIER}</strong></span>
              <span>מכשירים: <strong>{(COMMISSION.DEVICE_RATE * 100).toFixed(0)}%</strong></span>
              <span>מדרגה: <strong>₪{COMMISSION.DEVICE_MILESTONE_BONUS.toLocaleString()}</strong> / ₪{COMMISSION.DEVICE_MILESTONE.toLocaleString()}</span>
              <span>מינימום חבילה: <strong>₪{COMMISSION.MIN_PACKAGE_PRICE}</strong></span>
            </div>
          </div>

          {loadingProf ? (
            <div className="text-center py-10 text-muted text-[12px]">טוען...</div>
          ) : (
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
                    <tr><td colSpan={7} className="p-4 text-center text-muted">אין עובדים במערכת.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===================== TAB: LEADERBOARD ===================== */}
      {activeTab === "leaderboard" && (
        <div>
          {/* Month picker */}
          <div className="flex items-center gap-2 mb-4">
            <input
              type="month"
              className="input text-[12px]"
              value={lbMonth}
              onChange={e => setLbMonth(e.target.value)}
              style={{ maxWidth: 180 }}
            />
          </div>

          {loadingLB ? (
            <div className="text-center py-10 text-muted text-[12px]">טוען...</div>
          ) : leaderboard.length === 0 ? (
            <div className="card text-center py-10 text-muted text-[12px]">אין נתוני מכירות לחודש זה</div>
          ) : (
            <>
              {/* Top 3 Podium */}
              <div className="grid gap-3 mb-4" style={{ gridTemplateColumns: scr.mobile ? "1fr" : "repeat(3, 1fr)" }}>
                {leaderboard.slice(0, 3).map((entry, i) => (
                  <div
                    key={entry.name}
                    className="card text-center"
                    style={{
                      padding: 16,
                      borderTop: `3px solid ${podiumColors[i]}`,
                      position: "relative",
                    }}
                  >
                    <div style={{ fontSize: 28, marginBottom: 4 }}>{podiumLabels[i]}</div>
                    <div className="font-bold text-[14px] mb-1">{entry.name}</div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: "#22c55e" }}>
                      ₪{entry.totalCommission.toLocaleString()}
                    </div>
                    <div className="flex justify-center gap-3 mt-2 text-[10px] text-muted">
                      <span>{entry.linesCount} קווים</span>
                      <span>{entry.devicesCount} מכשירים</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Full ranking table */}
              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <table className="w-full text-[11px]">
                  <thead>
                    <tr className="border-b border-surface-border" style={{ background: "#18181b" }}>
                      <th className="p-2 text-center w-8">#</th>
                      <th className="p-2 text-right">שם</th>
                      <th className="p-2 text-center">קווים</th>
                      <th className="p-2 text-center">עמלת קווים</th>
                      <th className="p-2 text-center">מכשירים</th>
                      <th className="p-2 text-center">עמלת מכשירים</th>
                      <th className="p-2 text-center font-bold">סה״כ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((entry, i) => (
                      <tr key={entry.name} className="border-b border-surface-border hover:bg-surface-hover">
                        <td className="p-2 text-center font-bold" style={{ color: i < 3 ? podiumColors[i] : "#a1a1aa" }}>
                          {i + 1}
                        </td>
                        <td className="p-2 font-bold">{entry.name}</td>
                        <td className="p-2 text-center">{entry.linesCount}</td>
                        <td className="p-2 text-center">₪{entry.lineCommission.toLocaleString()}</td>
                        <td className="p-2 text-center">{entry.devicesCount}</td>
                        <td className="p-2 text-center">₪{entry.deviceCommission.toLocaleString()}</td>
                        <td className="p-2 text-center font-bold" style={{ color: "#22c55e" }}>
                          ₪{entry.totalCommission.toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}

      {/* ===================== EDIT PROFILE MODAL ===================== */}
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
