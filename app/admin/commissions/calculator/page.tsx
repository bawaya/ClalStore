"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useScreen, useToast } from "@/lib/hooks";
import { FormField, ToastContainer } from "@/components/admin/shared";
import { formatCurrency } from "@/lib/utils";
import {
  calcLineCommission,
  calcDeviceCommission,
  calcRequiredForTarget,
  calcLoyaltyBonus,
  COMMISSION,
} from "@/lib/commissions/calculator";

type Tab = "lines" | "devices" | "target" | "loyalty" | "simulation";

export default function CalculatorPage() {
  const scr = useScreen();
  const { toasts, dismiss } = useToast();
  const [tab, setTab] = useState<Tab>("lines");

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "lines", label: "קווים", icon: "📡" },
    { key: "devices", label: "מכשירים", icon: "📱" },
    { key: "target", label: "יעדים", icon: "🎯" },
    { key: "loyalty", label: "נאמנות", icon: "🤝" },
    { key: "simulation", label: "מה אם", icon: "🔮" },
  ];

  return (
    <div dir="rtl" className="font-hebrew">
      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className="flex items-center justify-between mb-4">
        <h1 className="font-black" style={{ fontSize: scr.mobile ? 16 : 22 }}>🧮 מחשבון עמלות</h1>
        <Link href="/admin/commissions" className="chip">← חזור</Link>
      </div>

      {/* Sub-nav */}
      <div className="flex gap-2 mb-4 overflow-x-auto">
        <Link href="/admin/commissions" className="chip">לוח בקרה</Link>
        <Link href="/admin/commissions/calculator" className="chip chip-active">מחשבון</Link>
        <Link href="/admin/commissions/sanctions" className="chip">סנקציות</Link>
        <Link href="/admin/commissions/history" className="chip">היסטוריה</Link>
        <Link href="/admin/commissions/import" className="chip">ייבוא</Link>
        <Link href="/admin/commissions/analytics" className="chip">ניתוח</Link>
      </div>

      {/* Tabs */}
      <div className="flex rounded-xl overflow-hidden border border-surface-border mb-4">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className="flex-1 transition-colors border-0 cursor-pointer"
            style={{
              padding: scr.mobile ? "8px 4px" : "10px 16px",
              fontSize: scr.mobile ? 10 : 12,
              fontWeight: tab === t.key ? 700 : 400,
              background: tab === t.key ? "#c41040" : "transparent",
              color: tab === t.key ? "#fff" : "#a1a1aa",
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {tab === "lines" && <LinesCalculator />}
      {tab === "devices" && <DevicesCalculator />}
      {tab === "target" && <TargetCalculator />}
      {tab === "loyalty" && <LoyaltyTracker />}
      {tab === "simulation" && <SimulationCalculator />}
    </div>
  );
}

// ============ Lines Calculator ============
function LinesCalculator() {
  const scr = useScreen();
  const [count, setCount] = useState(1);
  const [price, setPrice] = useState(25);
  const [hasHK, setHasHK] = useState(true);

  const perLine = calcLineCommission(price, hasHK);
  const total = perLine * count;

  return (
    <div className="card" style={{ padding: scr.mobile ? 16 : 24 }}>
      <h3 className="font-bold mb-4 text-right" style={{ fontSize: 14 }}>📡 מחשבון קווים</h3>

      <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
        <div className="flex-1">
          <FormField label="מספר קווים">
            <input type="number" className="input" min={1} value={count} onChange={(e) => setCount(Math.max(1, parseInt(e.target.value) || 1))} />
          </FormField>
          <FormField label="מחיר חבילה (₪) — טווח: ₪20–₪120">
            <input type="number" className="input" step="0.1" min={0} max={500} value={price} onChange={(e) => setPrice(Math.min(500, parseFloat(e.target.value) || 0))} />
          </FormField>
          <div className="flex items-center gap-2 mb-3">
            <label className="text-muted text-xs">הו״ק תקינה</label>
            <button
              onClick={() => setHasHK(!hasHK)}
              className="rounded-full transition-all cursor-pointer border-0"
              style={{ width: 38, height: 20, background: hasHK ? "#c41040" : "#3f3f46", padding: 2 }}
            >
              <div className="w-4 h-4 rounded-full bg-white transition-transform" style={{ transform: hasHK ? "translateX(-18px)" : "translateX(0)" }} />
            </button>
          </div>

          {price < COMMISSION.MIN_PACKAGE_PRICE && price > 0 && (
            <div className="bg-state-warning/10 border border-state-warning/30 rounded-xl px-3 py-2 mb-3 text-[11px] text-state-warning font-bold text-right">
              מחיר חבילה מתחת למינימום (₪{COMMISSION.MIN_PACKAGE_PRICE})
            </div>
          )}
          {!hasHK && (
            <div className="bg-state-error/10 border border-state-error/30 rounded-xl px-3 py-2 mb-3 text-[11px] text-state-error font-bold text-right">
              ללא הו״ק תקינה — אין עמלה
            </div>
          )}
        </div>

        {/* Result */}
        <div className="card flex-1" style={{ padding: 16, background: "#18181b" }}>
          <h4 className="text-muted text-xs mb-3 text-right">תוצאה</h4>
          <div className="space-y-2 text-right">
            <div className="flex justify-between">
              <span className="font-bold" style={{ color: "#3b82f6" }}>{formatCurrency(perLine)}</span>
              <span className="text-muted text-xs">עמלה לכל קו</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted text-xs">{count}</span>
              <span className="text-muted text-xs">מספר קווים</span>
            </div>
            <div className="border-t border-surface-border pt-2 flex justify-between">
              <span className="font-black text-lg" style={{ color: "#22c55e" }}>{formatCurrency(total)}</span>
              <span className="text-muted text-sm font-bold">סה״כ עמלות</span>
            </div>
          </div>
          <div className="text-[9px] text-dim mt-3 text-right">
            נוסחה: {price} x {COMMISSION.LINE_MULTIPLIER} = {perLine} לקו
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Devices Calculator ============
function DevicesCalculator() {
  const scr = useScreen();
  const [mode, setMode] = useState<"total" | "daily">("total");
  const [totalSales, setTotalSales] = useState(0);
  const [dailyAmount, setDailyAmount] = useState(0);
  const [days, setDays] = useState(22);

  const effectiveTotal = mode === "total" ? totalSales : dailyAmount * days;
  const calc = calcDeviceCommission(effectiveTotal);

  return (
    <div className="card" style={{ padding: scr.mobile ? 16 : 24 }}>
      <h3 className="font-bold mb-4 text-right" style={{ fontSize: 14 }}>📱 מחשבון מכשירים</h3>

      <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
        <div className="flex-1">
          {/* Mode toggle */}
          <div className="flex rounded-lg overflow-hidden border border-surface-border mb-3">
            <button
              onClick={() => setMode("total")}
              className="flex-1 border-0 cursor-pointer transition-colors"
              style={{ padding: "6px 12px", fontSize: 11, fontWeight: mode === "total" ? 700 : 400, background: mode === "total" ? "#c41040" : "transparent", color: mode === "total" ? "#fff" : "#a1a1aa" }}
            >
              סכום כולל
            </button>
            <button
              onClick={() => setMode("daily")}
              className="flex-1 border-0 cursor-pointer transition-colors"
              style={{ padding: "6px 12px", fontSize: 11, fontWeight: mode === "daily" ? 700 : 400, background: mode === "daily" ? "#c41040" : "transparent", color: mode === "daily" ? "#fff" : "#a1a1aa" }}
            >
              יומי x ימים
            </button>
          </div>

          {mode === "total" ? (
            <FormField label="סה״כ מכירות נטו (₪)">
              <input type="number" className="input" value={totalSales || ""} onChange={(e) => setTotalSales(parseFloat(e.target.value) || 0)} placeholder="300000" />
            </FormField>
          ) : (
            <>
              <FormField label="סכום יומי (₪)">
                <input type="number" className="input" value={dailyAmount || ""} onChange={(e) => setDailyAmount(parseFloat(e.target.value) || 0)} />
              </FormField>
              <FormField label="מספר ימים">
                <input type="number" className="input" value={days} onChange={(e) => setDays(parseInt(e.target.value) || 1)} />
              </FormField>
              <div className="text-muted text-[10px] text-right mb-2">
                סה״כ: {formatCurrency(effectiveTotal)}
              </div>
            </>
          )}
        </div>

        {/* Result */}
        <div className="card flex-1" style={{ padding: 16, background: "#18181b" }}>
          <h4 className="text-muted text-xs mb-3 text-right">תוצאה</h4>
          <div className="space-y-2 text-right">
            <div className="flex justify-between">
              <span className="font-bold">{formatCurrency(calc.basePct)}</span>
              <span className="text-muted text-xs">עמלה 5%</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold">{calc.milestoneCount}</span>
              <span className="text-muted text-xs">מדרגות שהושגו (כל ₪50,000)</span>
            </div>
            <div className="flex justify-between">
              <span className="font-bold" style={{ color: "#f97316" }}>{formatCurrency(calc.milestoneBonus)}</span>
              <span className="text-muted text-xs">בונוס מדרגות ({calc.milestoneCount} x ₪2,500)</span>
            </div>
            <div className="border-t border-surface-border pt-2 flex justify-between">
              <span className="font-black text-lg" style={{ color: "#22c55e" }}>{formatCurrency(calc.total)}</span>
              <span className="text-muted text-sm font-bold">סה״כ עמלות מכשירים</span>
            </div>
          </div>

          {/* Progress to next milestone */}
          <div className="mt-3">
            <div className="text-[10px] text-muted text-right mb-1">{formatCurrency(calc.nextMilestoneAt)} למדרגה הבאה</div>
            <div className="w-full h-2 bg-surface-bg rounded-full overflow-hidden">
              <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${calc.nextMilestoneProgress}%` }} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Target Calculator ============
function TargetCalculator() {
  const scr = useScreen();
  const [target, setTarget] = useState(15000);
  const [periodStart, setPeriodStart] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [periodEnd, setPeriodEnd] = useState(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return last.toISOString().slice(0, 10);
  });
  const [existingLines, setExistingLines] = useState(0);
  const [avgLinePrice, setAvgLinePrice] = useState(25);
  const [existingDevices, setExistingDevices] = useState(0);

  const currentProgress = existingLines > 0 || existingDevices > 0
    ? {
        linesCommission: existingLines * calcLineCommission(avgLinePrice, true),
        devicesCommission: calcDeviceCommission(existingDevices).total,
        loyaltyBonus: 0,
        sanctions: 0,
      }
    : undefined;

  const result = calcRequiredForTarget(target, periodStart, periodEnd, currentProgress);

  return (
    <div className="card" style={{ padding: scr.mobile ? 16 : 24 }}>
      <h3 className="font-bold mb-4 text-right" style={{ fontSize: 14 }}>🎯 מחשבון יעדים</h3>

      <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
        <div className="flex-1">
          <FormField label="סכום יעד (₪)" required>
            <input type="number" className="input" value={target || ""} onChange={(e) => setTarget(parseFloat(e.target.value) || 0)} />
          </FormField>
          <div style={{ display: "flex", gap: 8 }}>
            <FormField label="מתאריך">
              <input type="date" className="input" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} />
            </FormField>
            <FormField label="עד תאריך">
              <input type="date" className="input" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} />
            </FormField>
          </div>
          <FormField label="קווים שכבר מכרתי (אופציונלי)">
            <input type="number" className="input" value={existingLines || ""} onChange={(e) => setExistingLines(parseInt(e.target.value) || 0)} placeholder="0" />
          </FormField>
          {existingLines > 0 && (
            <FormField label="ממוצע מחיר חבילה (₪)">
              <input type="number" className="input" step="0.1" value={avgLinePrice} onChange={(e) => setAvgLinePrice(parseFloat(e.target.value) || 25)} />
            </FormField>
          )}
          <FormField label="מכירות מכשירים שכבר מכרתי ₪ (אופציונלי)">
            <input type="number" className="input" value={existingDevices || ""} onChange={(e) => setExistingDevices(parseInt(e.target.value) || 0)} placeholder="0" />
          </FormField>
        </div>

        {/* Results */}
        <div className="flex-1 space-y-3">
          <div className="card" style={{ padding: 14, background: "#18181b" }}>
            <div className="text-muted text-[10px] mb-1 text-right">סיכום</div>
            <div className="flex justify-between text-sm mb-1">
              <span className="font-bold">{formatCurrency(result.remaining)}</span>
              <span className="text-muted text-xs">נותר להשגת היעד</span>
            </div>
            <div className="flex justify-between text-sm mb-1">
              <span>{result.workingDays}</span>
              <span className="text-muted text-xs">ימי עבודה (לא כולל שבתות)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-bold" style={{ color: result.workingDaysLeft <= 5 ? "#ef4444" : "#22c55e" }}>{result.workingDaysLeft}</span>
              <span className="text-muted text-xs">ימי עבודה שנותרו</span>
            </div>
          </div>

          {/* Scenario Cards */}
          <div className="card" style={{ padding: 14, background: "#18181b", borderRight: "3px solid #3b82f6" }}>
            <div className="text-right mb-1" style={{ fontSize: 12, fontWeight: 700 }}>רק קווים</div>
            <div className="text-muted text-[11px] text-right">
              {result.scenarios.linesOnly.count} קווים | {result.scenarios.linesOnly.perDay} ליום
            </div>
          </div>
          <div className="card" style={{ padding: 14, background: "#18181b", borderRight: "3px solid #ef4444" }}>
            <div className="text-right mb-1" style={{ fontSize: 12, fontWeight: 700 }}>רק מכשירים</div>
            <div className="text-muted text-[11px] text-right">
              {formatCurrency(result.scenarios.devicesOnly.salesNeeded)} מכירות | {formatCurrency(result.scenarios.devicesOnly.perDay)} ליום
            </div>
          </div>
          <div className="card" style={{ padding: 14, background: "#18181b", borderRight: "3px solid #eab308" }}>
            <div className="text-right mb-1" style={{ fontSize: 12, fontWeight: 700 }}>משולב</div>
            <div className="text-muted text-[11px] text-right">
              {result.scenarios.mixed.lines} קווים ({result.scenarios.mixed.linesPerDay}/יום) + {formatCurrency(result.scenarios.mixed.deviceSales)} מכשירים ({formatCurrency(result.scenarios.mixed.devicePerDay)}/יום)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ Loyalty Tracker ============
function LoyaltyTracker() {
  const scr = useScreen();
  const [lines, setLines] = useState<Array<{ name: string; phone: string; startDate: string; status: string }>>([]);
  const [newLine, setNewLine] = useState({ name: "", phone: "", startDate: new Date().toISOString().slice(0, 10) });
  const [showAdd, setShowAdd] = useState(false);

  const addLine = () => {
    if (!newLine.startDate) return;
    setLines([...lines, { ...newLine, status: "active" }]);
    setNewLine({ name: "", phone: "", startDate: new Date().toISOString().slice(0, 10) });
    setShowAdd(false);
  };

  const totalBonus = lines.reduce((sum, l) => {
    const lb = calcLoyaltyBonus(l.startDate);
    return sum + lb.earnedSoFar;
  }, 0);

  return (
    <div className="card" style={{ padding: scr.mobile ? 16 : 24 }}>
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setShowAdd(!showAdd)} className="btn-primary" style={{ fontSize: 11, padding: "6px 14px" }}>+ הוסף קו</button>
        <h3 className="font-bold" style={{ fontSize: 14 }}>🤝 מעקב נאמנות</h3>
      </div>

      {showAdd && (
        <div className="card mb-3" style={{ padding: 12, background: "#18181b" }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <FormField label="שם לקוח">
              <input className="input" value={newLine.name} onChange={(e) => setNewLine({ ...newLine, name: e.target.value })} />
            </FormField>
            <FormField label="טלפון">
              <input className="input" value={newLine.phone} onChange={(e) => setNewLine({ ...newLine, phone: e.target.value })} />
            </FormField>
            <FormField label="תאריך הפעלה">
              <input type="date" className="input" value={newLine.startDate} onChange={(e) => setNewLine({ ...newLine, startDate: e.target.value })} />
            </FormField>
          </div>
          <button onClick={addLine} className="btn-primary mt-2" style={{ fontSize: 11, padding: "6px 14px" }}>שמור</button>
        </div>
      )}

      {lines.length === 0 ? (
        <div className="text-center text-dim text-xs py-8">
          <div className="text-3xl mb-2">🤝</div>
          <div>אין קווים במעקב נאמנות</div>
          <div className="text-[10px] mt-1">הוסף קו כדי לעקוב אחר בונוסי נאמנות</div>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-right" style={{ fontSize: scr.mobile ? 10 : 12 }}>
              <thead>
                <tr className="text-muted border-b border-surface-border">
                  <th className="py-1.5 font-semibold">בונוס הבא</th>
                  <th className="py-1.5 font-semibold">בונוס שהתקבל</th>
                  <th className="py-1.5 font-semibold">סטטוס</th>
                  <th className="py-1.5 font-semibold">ימים שנותרו</th>
                  <th className="py-1.5 font-semibold">תאריך הפעלה</th>
                  <th className="py-1.5 font-semibold">טלפון</th>
                  <th className="py-1.5 font-semibold">לקוח</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => {
                  const lb = calcLoyaltyBonus(line.startDate);
                  const statusColor = lb.isInLoyaltyPeriod
                    ? lb.daysRemaining <= 30 ? "#eab308" : "#22c55e"
                    : "#ef4444";
                  const statusText = lb.isInLoyaltyPeriod
                    ? lb.daysRemaining <= 30 ? "קרוב לסיום" : "פעיל"
                    : "הסתיים";
                  return (
                    <tr key={i} className="border-b border-surface-border/50">
                      <td className="py-1.5">
                        {lb.nextBonus ? `₪${lb.nextBonus.amount} (${lb.nextBonus.months} חודשים)` : "—"}
                      </td>
                      <td className="py-1.5 font-bold" style={{ color: "#22c55e" }}>{formatCurrency(lb.earnedSoFar)}</td>
                      <td className="py-1.5">
                        <span className="text-[9px] font-bold" style={{ color: statusColor }}>{statusText}</span>
                      </td>
                      <td className="py-1.5">{lb.daysRemaining}</td>
                      <td className="py-1.5">{line.startDate}</td>
                      <td className="py-1.5">{line.phone || "—"}</td>
                      <td className="py-1.5 font-bold">{line.name || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-right text-sm font-bold">
            סה״כ בונוסי נאמנות צפויים: <span style={{ color: "#22c55e" }}>{formatCurrency(totalBonus)}</span>
          </div>
        </>
      )}
    </div>
  );
}

// ============ Simulation Calculator ("מה אם") ============
function SimulationCalculator() {
  const scr = useScreen();
  const { toasts, show, dismiss } = useToast();
  const [loading, setLoading] = useState(true);
  const [currentData, setCurrentData] = useState<{
    linesCommission: number;
    devicesCommission: number;
    loyaltyBonus: number;
    totalSanctions: number;
    netCommission: number;
    currentLinesSold: number;
    currentDevicesSalesAmount: number;
  } | null>(null);

  // Simulation inputs
  const [additionalLines, setAdditionalLines] = useState(0);
  const [linePackagePrice, setLinePackagePrice] = useState(25);
  const [additionalDeviceSales, setAdditionalDeviceSales] = useState(0);

  const month = new Date().toISOString().slice(0, 7);

  const fetchCurrent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/commissions/dashboard?month=${month}`);
      if (!res.ok) throw new Error();
      const json = await res.json();
      const d = json.data || json;
      const sales = d.recentSales || [];
      const deviceTotal = sales
        .filter((s: { sale_type: string }) => s.sale_type === "device")
        .reduce((sum: number, s: { device_sale_amount?: number }) => sum + (s.device_sale_amount || 0), 0);
      setCurrentData({
        linesCommission: d.summary.linesCommission,
        devicesCommission: d.summary.devicesCommission,
        loyaltyBonus: d.summary.loyaltyBonus,
        totalSanctions: d.summary.totalSanctions,
        netCommission: d.summary.netCommission,
        currentLinesSold: sales.filter((s: { sale_type: string }) => s.sale_type === "line").length,
        currentDevicesSalesAmount: deviceTotal,
      });
    } catch {
      show("שגיאה בטעינת הנתונים", "error");
    } finally {
      setLoading(false);
    }
  }, [month, show]);

  useEffect(() => { fetchCurrent(); }, [fetchCurrent]);

  if (loading) return <div className="text-center py-10 text-muted text-xs">טוען נתונים...</div>;
  if (!currentData) return <div className="text-center py-10 text-dim text-xs">אין נתונים</div>;

  // Calculate simulation
  const simLinesCommission = calcLineCommission(linePackagePrice, true) * additionalLines;
  const newTotalDeviceSales = currentData.currentDevicesSalesAmount + additionalDeviceSales;
  const currentDeviceCalc = calcDeviceCommission(currentData.currentDevicesSalesAmount);
  const newDeviceCalc = calcDeviceCommission(newTotalDeviceSales);
  const simDevicesCommission = newDeviceCalc.total - currentDeviceCalc.total;

  const simTotalAddition = simLinesCommission + simDevicesCommission;
  const newTotal = currentData.netCommission + simTotalAddition;

  return (
    <div className="card" style={{ padding: scr.mobile ? 16 : 24 }}>
      <ToastContainer toasts={toasts} onDismiss={dismiss} />
      <h3 className="font-bold mb-2 text-right" style={{ fontSize: 14 }}>🔮 סימולציה — מה אם?</h3>
      <div className="text-muted text-[10px] text-right mb-4">
        חישוב תיאורטי בלבד — לא נשמר. מראה כמה עוד תרוויח אם תמכור קווים/מכשירים נוספים.
      </div>

      <div style={{ display: scr.mobile ? "block" : "flex", gap: 16 }}>
        {/* Inputs */}
        <div className="flex-1">
          {/* Current status */}
          <div className="card mb-3" style={{ padding: 12, background: "#18181b" }}>
            <div className="text-muted text-[10px] mb-2 text-right font-bold">מצב נוכחי החודש</div>
            <div className="space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="font-bold" style={{ color: "#3b82f6" }}>{formatCurrency(currentData.linesCommission)}</span>
                <span className="text-muted">עמלות קווים</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold" style={{ color: "#ef4444" }}>{formatCurrency(currentData.devicesCommission)}</span>
                <span className="text-muted">עמלות מכשירים</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold" style={{ color: "#06b6d4" }}>{formatCurrency(currentData.loyaltyBonus)}</span>
                <span className="text-muted">בונוסי נאמנות</span>
              </div>
              <div className="flex justify-between">
                <span className="font-bold" style={{ color: "#f97316" }}>-{formatCurrency(currentData.totalSanctions)}</span>
                <span className="text-muted">סנקציות</span>
              </div>
              <div className="border-t border-surface-border pt-1 flex justify-between">
                <span className="font-bold" style={{ color: "#22c55e" }}>{formatCurrency(currentData.netCommission)}</span>
                <span className="text-muted font-bold">נטו נוכחי</span>
              </div>
            </div>
          </div>

          {/* Simulation inputs */}
          <div className="card" style={{ padding: 12, background: "#18181b", borderRight: "3px solid #8b5cf6" }}>
            <div className="text-right mb-2 font-bold text-[11px]" style={{ color: "#8b5cf6" }}>הוסף מכירות תיאורטיות</div>
            <FormField label="קווים נוספים">
              <input
                type="number"
                className="input"
                min={0}
                value={additionalLines || ""}
                onChange={(e) => setAdditionalLines(Math.max(0, parseInt(e.target.value) || 0))}
                placeholder="0"
              />
            </FormField>
            <FormField label="מחיר חבילה לקו (₪) — טווח: ₪20–₪120">
              <input
                type="number"
                className="input"
                step="0.1"
                min={0}
                max={500}
                value={linePackagePrice}
                onChange={(e) => {
                  const v = parseFloat(e.target.value) || 0;
                  setLinePackagePrice(Math.min(500, v));
                }}
                placeholder="25"
              />
              {linePackagePrice > 200 && (
                <div className="text-[10px] mt-1 font-bold" style={{ color: "#ef4444" }}>
                  ⚠ מחיר חבילה גבוה מדי — חבילות HOT בטווח ₪20–₪120
                </div>
              )}
            </FormField>
            <FormField label="מכירות מכשירים נוספות (₪)">
              <input
                type="number"
                className="input"
                min={0}
                value={additionalDeviceSales || ""}
                onChange={(e) => setAdditionalDeviceSales(Math.max(0, parseFloat(e.target.value) || 0))}
                placeholder="250000"
              />
            </FormField>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1">
          <div className="card" style={{ padding: 16, background: "#18181b" }}>
            <h4 className="text-muted text-xs mb-3 text-right">תוצאת סימולציה</h4>
            <div className="space-y-2 text-right">
              {/* Current */}
              <div className="flex justify-between">
                <span className="font-bold">{formatCurrency(currentData.netCommission)}</span>
                <span className="text-muted text-xs">עמלה נוכחית (נטו)</span>
              </div>

              {/* Simulated additions breakdown */}
              <div className="border-t border-surface-border pt-2">
                <div className="text-[10px] text-muted text-right mb-1 font-bold" style={{ color: "#8b5cf6" }}>תוספת מהסימולציה:</div>
              </div>

              {additionalLines > 0 && (
                <div className="flex justify-between">
                  <span className="font-bold" style={{ color: "#3b82f6" }}>+{formatCurrency(simLinesCommission)}</span>
                  <span className="text-muted text-xs" dir="ltr">{additionalLines} x ₪{linePackagePrice} x {COMMISSION.LINE_MULTIPLIER} = ₪{simLinesCommission.toLocaleString()}</span>
                </div>
              )}

              {additionalDeviceSales > 0 && (
                <>
                  <div className="flex justify-between">
                    <span className="font-bold" style={{ color: "#ef4444" }}>+{formatCurrency(simDevicesCommission)}</span>
                    <span className="text-muted text-xs">מכשירים ({formatCurrency(additionalDeviceSales)} נוספים)</span>
                  </div>
                  {newDeviceCalc.milestoneCount > currentDeviceCalc.milestoneCount && (
                    <div className="bg-state-success/10 border border-state-success/30 rounded-lg px-3 py-1.5 text-[10px] text-state-success font-bold text-right">
                      +{newDeviceCalc.milestoneCount - currentDeviceCalc.milestoneCount} מדרגות חדשות! (בונוס ₪{(newDeviceCalc.milestoneCount - currentDeviceCalc.milestoneCount) * COMMISSION.DEVICE_MILESTONE_BONUS})
                    </div>
                  )}
                </>
              )}

              {/* Total addition */}
              <div className="flex justify-between border-t border-surface-border pt-2">
                <span className="font-bold text-sm" style={{ color: "#8b5cf6" }}>+{formatCurrency(simTotalAddition)}</span>
                <span className="text-muted text-xs font-bold">סה״כ תוספת</span>
              </div>

              {/* New total */}
              <div className="flex justify-between border-t-2 border-surface-border pt-3">
                <span className="font-black text-xl" style={{ color: "#22c55e" }}>{formatCurrency(newTotal)}</span>
                <span className="text-muted text-sm font-bold">סה״כ חדש (נטו)</span>
              </div>
            </div>

            {/* Visual comparison */}
            <div className="mt-4">
              <div className="text-[9px] text-muted text-right mb-1">השוואה ויזואלית</div>
              <div className="space-y-1.5">
                <div>
                  <div className="flex justify-between text-[9px] text-muted mb-0.5">
                    <span>{formatCurrency(currentData.netCommission)}</span>
                    <span>נוכחי</span>
                  </div>
                  <div className="w-full h-3 bg-surface-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: newTotal > 0 ? `${Math.min(100, (currentData.netCommission / newTotal) * 100)}%` : "0%",
                        background: "#71717a",
                      }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[9px] text-muted mb-0.5">
                    <span>{formatCurrency(newTotal)}</span>
                    <span>אחרי סימולציה</span>
                  </div>
                  <div className="w-full h-3 bg-surface-bg rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: "100%",
                        background: "linear-gradient(90deg, #22c55e, #8b5cf6)",
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
