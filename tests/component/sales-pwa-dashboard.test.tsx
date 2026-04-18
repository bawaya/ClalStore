/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Sales PWA daily-dashboard page (app/sales-pwa/page.tsx).
 * Shows:
 *   - today card (salesCount / totalAmount / commission)
 *   - target card (percent + pacingColor + dailyRequired + workingDaysLeft)
 *   - milestones card
 *   - recent sales
 *   - unread announcements peek
 *   - recent activity (limit=3)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";

vi.mock("next/link", () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

// ─── Fetch routing helper ────────────────────────────────────────────────
type Route = { ok?: boolean; body: unknown };

function buildFetch(routes: Record<string, Route>): typeof fetch {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === "string" ? input : input.toString();
    for (const [pattern, def] of Object.entries(routes)) {
      if (url.startsWith(pattern)) {
        return {
          ok: def.ok !== false,
          json: async () => def.body,
        } as unknown as Response;
      }
    }
    return {
      ok: false,
      json: async () => ({}),
    } as unknown as Response;
  }) as unknown as typeof fetch;
}

// ─── Fixture builder ─────────────────────────────────────────────────────
type PacingColor = "green" | "yellow" | "red";

function dashboardFixture(
  overrides: Partial<{
    pacingColor: PacingColor;
    targetProgress: number;
    dailyRequired: number;
    workingDaysLeft: number;
    recentSalesCount: number;
  }> = {},
) {
  const pacingColor: PacingColor = overrides.pacingColor ?? "green";
  const targetProgress = overrides.targetProgress ?? 72;
  const dailyRequired = overrides.dailyRequired ?? 1500;
  const workingDaysLeft = overrides.workingDaysLeft ?? 12;
  const recentSalesCount = overrides.recentSalesCount ?? 5;

  const recentSales = Array.from({ length: recentSalesCount }, (_, i) => ({
    id: 1000 + i,
    sale_date: "2026-04-15",
    sale_type: "line" as const,
    package_price: 199,
    device_sale_amount: null,
    commission_amount: 50 + i,
    source: "pwa",
  }));

  return {
    today: {
      date: "2026-04-18",
      salesCount: 7,
      totalAmount: 1234,
      commission: 456,
    },
    month: {
      month: "2026-04",
      salesCount: 30,
      totalAmount: 45000,
      totalCommission: 4500,
      sanctions: 0,
      netCommission: 4500,
      target: 60000,
      targetProgress,
      remainingAmount: 15000,
      workingDaysLeft,
      dailyRequired,
      pacingColor,
    },
    milestones: {
      currentTotal: 12000,
      nextMilestoneAt: 20000,
      milestonesReached: 2,
      bonusEarned: 300,
    },
    recentSales,
  };
}

import SalesPwaDashboardPage from "@/app/sales-pwa/page";

describe("SalesPwaDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the loading skeleton initially (before fetch resolves)", () => {
    // fetch never resolves — component stays in loading state
    global.fetch = vi.fn(
      () => new Promise(() => {}),
    ) as unknown as typeof fetch;
    const { container } = render(<SalesPwaDashboardPage />);
    // Three animate-pulse placeholders
    expect(container.querySelectorAll(".animate-pulse").length).toBe(3);
  });

  it("today card shows salesCount, totalAmount, and commission", async () => {
    const dash = dashboardFixture();
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("7")).toBeInTheDocument();
    });
    // totalAmount via formatCurrency
    expect(screen.getByText("₪1,234")).toBeInTheDocument();
    // commission via formatCurrency
    expect(screen.getByText("₪456")).toBeInTheDocument();
  });

  it("target card shows target progress as a percent number", async () => {
    const dash = dashboardFixture({ targetProgress: 72 });
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("72%")).toBeInTheDocument();
    });
    // Progress-bar role value reflects percent too
    const bars = screen.getAllByRole("progressbar");
    // The first progressbar is the target bar, aria-valuenow = 72
    expect(bars[0]).toHaveAttribute("aria-valuenow", "72");
  });

  it("target card progress-bar color matches pacingColor (green/yellow/red)", async () => {
    const cases: Array<{
      color: PacingColor;
      expected: RegExp;
    }> = [
      { color: "green", expected: /bg-emerald-500/ },
      { color: "yellow", expected: /bg-amber-500/ },
      { color: "red", expected: /bg-rose-500/ },
    ];
    for (const c of cases) {
      const dash = dashboardFixture({ pacingColor: c.color });
      global.fetch = buildFetch({
        "/api/employee/commissions/dashboard": { body: dash },
        "/api/employee/announcements": { body: { unreadCount: 0 } },
        "/api/employee/activity": { body: { activities: [] } },
      });
      const { container, unmount } = render(<SalesPwaDashboardPage />);
      await waitFor(() => {
        expect(screen.getByText("72%")).toBeInTheDocument();
      });
      const bars = container.querySelectorAll('[role="progressbar"]');
      expect(bars.length).toBeGreaterThanOrEqual(1);
      const classes = Array.from(bars).map((b) => b.className).join(" ");
      expect(classes).toMatch(c.expected);
      unmount();
    }
  });

  it("target card shows dailyRequired and workingDaysLeft", async () => {
    const dash = dashboardFixture({
      dailyRequired: 1500,
      workingDaysLeft: 12,
    });
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("₪1,500")).toBeInTheDocument();
    });
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("مطلوب يومياً")).toBeInTheDocument();
    expect(screen.getByText("أيام عمل باقية")).toBeInTheDocument();
  });

  it("milestones card shows current total and next milestone at", async () => {
    const dash = dashboardFixture();
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      // currentTotal (12000) in small amber chip
      expect(screen.getByText("₪12,000")).toBeInTheDocument();
    });
    // next milestone at 20000
    expect(screen.getByText("₪20,000")).toBeInTheDocument();
  });

  it("recent sales shows 5 rows", async () => {
    const dash = dashboardFixture({ recentSalesCount: 5 });
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    const { container } = render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("آخر المبيعات")).toBeInTheDocument();
    });
    // The `<ul>` contains the rows — count `<li>` inside it
    const salesList = container.querySelector("ul.divide-y");
    expect(salesList).not.toBeNull();
    expect(salesList!.querySelectorAll("li").length).toBe(5);
  });

  it("'New sale' button links to /sales-pwa/new", async () => {
    const dash = dashboardFixture();
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("بيعة جديدة")).toBeInTheDocument();
    });
    const newSale = screen.getByText("بيعة جديدة").closest("a");
    expect(newSale).toHaveAttribute("href", "/sales-pwa/new");
  });

  it("shows unread announcements peek with the count", async () => {
    const dash = dashboardFixture();
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 4 } },
      "/api/employee/activity": { body: { activities: [] } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(
        screen.getByText("لديك 4 إعلانات غير مقروءة"),
      ).toBeInTheDocument();
    });
  });

  it("activity peek shows the 3 latest entries", async () => {
    const dash = dashboardFixture();
    const activities = [
      {
        id: 1,
        event_type: "sale",
        title: "نشاط أول",
        description: "desc A",
        created_at: new Date(Date.now() - 60_000).toISOString(),
      },
      {
        id: 2,
        event_type: "sale",
        title: "نشاط ثاني",
        description: "desc B",
        created_at: new Date(Date.now() - 120_000).toISOString(),
      },
      {
        id: 3,
        event_type: "sale",
        title: "نشاط ثالث",
        description: null,
        created_at: new Date(Date.now() - 180_000).toISOString(),
      },
    ];
    global.fetch = buildFetch({
      "/api/employee/commissions/dashboard": { body: dash },
      "/api/employee/announcements": { body: { unreadCount: 0 } },
      "/api/employee/activity": { body: { activities } },
    });
    render(<SalesPwaDashboardPage />);
    await waitFor(() => {
      expect(screen.getByText("نشاط أول")).toBeInTheDocument();
    });
    expect(screen.getByText("نشاط ثاني")).toBeInTheDocument();
    expect(screen.getByText("نشاط ثالث")).toBeInTheDocument();
    // Exactly 3 rows (no 4th)
    expect(screen.queryByText("نشاط رابع")).not.toBeInTheDocument();
  });
});
