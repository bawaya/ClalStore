// =====================================================
// ClalMobile — HOT Mobile Commission Calculator Engine
// Contract-based commission calculations
// =====================================================

import { countWorkingDays } from "./date-utils";

export const COMMISSION = {
  LINE_MULTIPLIER: 4,
  MIN_PACKAGE_PRICE: 19.90,
  LOYALTY_PERIOD_DAYS: 150,
  DEVICE_RATE: 0.05,
  DEVICE_MILESTONE: 50000,
  DEVICE_MILESTONE_BONUS: 2500,
  LOYALTY_BONUSES: { 5: 80, 9: 30, 12: 20, 15: 50 } as Record<number, number>,
  SANCTIONS: {
    FAKE_PAYMENT: { label: 'אמצעי תשלום פיקטיבי / לא תקין', amount: 2500, withOffset: true },
    FALSE_PROMISE: { label: 'הבטחת מוכר בניגוד לתנאי התוכניות', amount: 2500, withOffset: true },
    NO_PROOF: { label: 'הכנסת מכירה ללא אסמכתא', amount: 2500, withOffset: true },
    ILLEGAL_DIALER: { label: 'שימוש בחיוגי אשראי בניגוד לחוק', amount: 2500, withOffset: true },
    DOUBLE_CONNECTION: { label: 'חיבור כפול', amount: 2500, withOffset: true },
    UNAUTHORIZED_AD: { label: 'פרסום מטעם המשווק ללא אישור החברה', amount: 2500, withOffset: false },
    HARASSMENT: { label: 'הטרדות – פניות חוזרות ונשנות', amount: 1000, withOffset: false },
    NO_DNC_REMOVAL: { label: 'אי הסרת מספר מרשימות ההתקשרות', amount: 1000, withOffset: false },
    UNAUTHORIZED_VISOR: { label: 'שימוש בויזר ללא הרשאה', amount: 2500, withOffset: true },
  },
} as const;

export type SanctionKey = keyof typeof COMMISSION.SANCTIONS;

// Employee commission profile (custom rates)
export interface EmployeeProfile {
  line_multiplier: number;
  device_rate: number;
  device_milestone_bonus: number;
  min_package_price: number;
  loyalty_bonuses: Record<number, number>;
}

export const DEFAULT_EMPLOYEE_PROFILE: EmployeeProfile = {
  line_multiplier: COMMISSION.LINE_MULTIPLIER,
  device_rate: COMMISSION.DEVICE_RATE,
  device_milestone_bonus: COMMISSION.DEVICE_MILESTONE_BONUS,
  min_package_price: COMMISSION.MIN_PACKAGE_PRICE,
  loyalty_bonuses: { ...COMMISSION.LOYALTY_BONUSES },
};

// Employee line commission (custom multiplier)
export function calcEmployeeLineCommission(packagePrice: number, profile: EmployeeProfile): number {
  if (packagePrice < profile.min_package_price) return 0;
  return packagePrice * profile.line_multiplier;
}

// Employee device commission (custom rate + milestone)
export function calcEmployeeDeviceCommission(totalNetSales: number, profile: EmployeeProfile): {
  basePct: number;
  milestoneCount: number;
  milestoneBonus: number;
  total: number;
} {
  const basePct = totalNetSales * profile.device_rate;
  const milestoneCount = profile.device_milestone_bonus > 0
    ? Math.floor(totalNetSales / COMMISSION.DEVICE_MILESTONE)
    : 0;
  const milestoneBonus = milestoneCount * profile.device_milestone_bonus;
  return { basePct, milestoneCount, milestoneBonus, total: basePct + milestoneBonus };
}

// Calculate both contract and employee commission for a single sale.
// Important: device rows compute ONLY the base % here; milestone bonuses are
// applied later by allocateDeviceCommissionRows (ledger) on a contract-wide
// running total, per decision 4.
export function calcDualCommission(
  saleType: 'line' | 'device',
  value: number,
  hasValidHK: boolean,
  profile: EmployeeProfile | null,
): { contractCommission: number; employeeCommission: number } {
  if (saleType === 'line') {
    // Absolute minimum package price — profile cannot go below contract floor
    // (fixes audit issue 4.9: profile with lower min_package_price was producing
    //  negative owner profit).
    const effectiveMin = Math.max(
      COMMISSION.MIN_PACKAGE_PRICE,
      profile?.min_package_price ?? COMMISSION.MIN_PACKAGE_PRICE,
    );

    if (!hasValidHK || value < effectiveMin) {
      return { contractCommission: 0, employeeCommission: 0 };
    }

    const contractCommission = value * COMMISSION.LINE_MULTIPLIER;
    const employeeCommission = profile
      ? value * profile.line_multiplier
      : contractCommission;
    return { contractCommission, employeeCommission };
  }

  // device — base % only; milestone applied by ledger recalc
  const contractCommission = value * COMMISSION.DEVICE_RATE;
  const employeeCommission = profile
    ? value * profile.device_rate
    : contractCommission;
  return { contractCommission, employeeCommission };
}

// Line commission: package × multiplier(4)
export function calcLineCommission(packagePrice: number, hasValidHK: boolean): number {
  if (!hasValidHK) return 0;
  if (packagePrice < COMMISSION.MIN_PACKAGE_PRICE) return 0;
  return packagePrice * COMMISSION.LINE_MULTIPLIER;
}

// Device commission breakdown
export function calcDeviceCommission(totalNetSales: number): {
  basePct: number;
  milestoneCount: number;
  milestoneBonus: number;
  total: number;
  nextMilestoneAt: number;
  nextMilestoneProgress: number;
} {
  const basePct = totalNetSales * COMMISSION.DEVICE_RATE;
  const milestoneCount = Math.floor(totalNetSales / COMMISSION.DEVICE_MILESTONE);
  const milestoneBonus = milestoneCount * COMMISSION.DEVICE_MILESTONE_BONUS;
  const total = basePct + milestoneBonus;

  const currentInMilestone = totalNetSales % COMMISSION.DEVICE_MILESTONE;
  const nextMilestoneAt = COMMISSION.DEVICE_MILESTONE - currentInMilestone;
  const nextMilestoneProgress = (currentInMilestone / COMMISSION.DEVICE_MILESTONE) * 100;

  return { basePct, milestoneCount, milestoneBonus, total, nextMilestoneAt, nextMilestoneProgress };
}

// Loyalty bonus calculator per line
export function calcLoyaltyBonus(loyaltyStartDate: string, now?: string): {
  monthsActive: number;
  earnedSoFar: number;
  nextBonus: { months: number; amount: number; date: string } | null;
  isInLoyaltyPeriod: boolean;
  daysRemaining: number;
} {
  const start = new Date(loyaltyStartDate);
  const current = now ? new Date(now) : new Date();
  const diffMs = current.getTime() - start.getTime();
  const diffDays = Math.floor(diffMs / 86400000);
  // Calendar-based month calculation (accurate for 12-15 month loyalty periods)
  const monthsActive =
    (current.getFullYear() - start.getFullYear()) * 12 +
    (current.getMonth() - start.getMonth()) +
    (current.getDate() >= start.getDate() ? 0 : -1);
  const isInLoyaltyPeriod = diffDays <= COMMISSION.LOYALTY_PERIOD_DAYS;
  const daysRemaining = Math.max(0, COMMISSION.LOYALTY_PERIOD_DAYS - diffDays);

  // Calculate earned bonuses
  let earnedSoFar = 0;
  const milestones = Object.entries(COMMISSION.LOYALTY_BONUSES)
    .map(([m, a]) => ({ months: Number(m), amount: a }))
    .sort((a, b) => a.months - b.months);

  for (const m of milestones) {
    if (monthsActive >= m.months) {
      earnedSoFar += m.amount;
    }
  }

  // Next bonus
  let nextBonus: { months: number; amount: number; date: string } | null = null;
  for (const m of milestones) {
    if (monthsActive < m.months) {
      const nextDate = new Date(start);
      nextDate.setMonth(nextDate.getMonth() + m.months);
      nextBonus = { months: m.months, amount: m.amount, date: nextDate.toISOString().slice(0, 10) };
      break;
    }
  }

  return { monthsActive, earnedSoFar, nextBonus, isInLoyaltyPeriod, daysRemaining };
}

// Reverse calculator: given target, what do I need?
export function calcRequiredForTarget(
  targetAmount: number,
  periodStart: string,
  periodEnd: string,
  currentProgress?: {
    linesCommission: number;
    devicesCommission: number;
    loyaltyBonus: number;
    sanctions: number;
  }
): {
  remaining: number;
  totalDays: number;
  workingDays: number;
  daysLeft: number;
  workingDaysLeft: number;
  scenarios: {
    linesOnly: { count: number; perDay: number; packagePrice: number };
    devicesOnly: { salesNeeded: number; perDay: number };
    mixed: { lines: number; linesPerDay: number; deviceSales: number; devicePerDay: number };
  };
} {
  const start = new Date(periodStart);
  const end = new Date(periodEnd);
  const now = new Date();

  const totalDays = Math.ceil((end.getTime() - start.getTime()) / 86400000) + 1;
  const workingDays = countWorkingDays(start, end);

  const effectiveNow = now < start ? start : now > end ? end : now;
  const daysLeft = Math.max(0, Math.ceil((end.getTime() - effectiveNow.getTime()) / 86400000));
  const workingDaysLeft = now > end ? 0 : countWorkingDays(effectiveNow, end);

  const currentTotal = currentProgress
    ? currentProgress.linesCommission + currentProgress.devicesCommission + currentProgress.loyaltyBonus - currentProgress.sanctions
    : 0;
  const remaining = Math.max(0, targetAmount - currentTotal);

  const avgPackagePrice = 25; // reasonable default
  const lineCommPerLine = avgPackagePrice * COMMISSION.LINE_MULTIPLIER; // 100

  const safeWorkingDays = Math.max(1, workingDaysLeft);

  // Scenario: lines only
  const linesCount = Math.ceil(remaining / lineCommPerLine);
  const linesPerDay = Math.ceil(linesCount / safeWorkingDays);

  // Scenario: devices only
  const deviceSalesNeeded = remaining / COMMISSION.DEVICE_RATE;
  const devicePerDay = deviceSalesNeeded / safeWorkingDays;

  // Scenario: mixed (60% lines, 40% devices)
  const mixedLinesTarget = remaining * 0.6;
  const mixedDevicesTarget = remaining * 0.4;
  const mixedLines = Math.ceil(mixedLinesTarget / lineCommPerLine);
  const mixedLinesPerDay = Math.ceil(mixedLines / safeWorkingDays);
  const mixedDeviceSales = mixedDevicesTarget / COMMISSION.DEVICE_RATE;
  const mixedDevicePerDay = mixedDeviceSales / safeWorkingDays;

  return {
    remaining,
    totalDays,
    workingDays,
    daysLeft,
    workingDaysLeft,
    scenarios: {
      linesOnly: { count: linesCount, perDay: linesPerDay, packagePrice: avgPackagePrice },
      devicesOnly: { salesNeeded: Math.round(deviceSalesNeeded), perDay: Math.round(devicePerDay) },
      mixed: {
        lines: mixedLines,
        linesPerDay: mixedLinesPerDay,
        deviceSales: Math.round(mixedDeviceSales),
        devicePerDay: Math.round(mixedDevicePerDay),
      },
    },
  };
}

// Total monthly summary
// Monthly summaries should read the persisted ledger values directly.
// Device rows are already allocated month-by-month during sync/update flows.
export function calcMonthlySummary(
  sales: Array<{ sale_type: string; commission_amount: number; source: string; device_sale_amount?: number }>,
  sanctions: Array<{ amount: number }>,
  loyaltyBonuses: number,
  target: { target_total: number } | null
): {
  linesCommission: number;
  devicesCommission: number;
  loyaltyBonus: number;
  grossCommission: number;
  totalSanctions: number;
  netCommission: number;
  targetAmount: number;
  targetProgress: number;
  autoSyncedCount: number;
  manualEntryCount: number;
} {
  const linesCommission = sales
    .filter((s) => s.sale_type === 'line')
    .reduce((sum, s) => sum + s.commission_amount, 0);

  const devicesCommission = sales
    .filter((s) => s.sale_type === 'device')
    .reduce((sum, s) => sum + (s.commission_amount || 0), 0);

  const grossCommission = linesCommission + devicesCommission + loyaltyBonuses;
  const totalSanctions = sanctions.reduce((sum, s) => sum + s.amount, 0);
  const netCommission = grossCommission - totalSanctions;

  const targetAmount = target?.target_total || 0;
  const targetProgress = targetAmount > 0 ? Math.min(100, Math.round((netCommission / targetAmount) * 100)) : 0;

  const autoSyncedCount = sales.filter((s) => s.source === 'auto_sync').length;
  const manualEntryCount = sales.filter((s) => s.source !== 'auto_sync').length;

  return {
    linesCommission,
    devicesCommission,
    loyaltyBonus: loyaltyBonuses,
    grossCommission,
    totalSanctions,
    netCommission,
    targetAmount,
    targetProgress,
    autoSyncedCount,
    manualEntryCount,
  };
}
