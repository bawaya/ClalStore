/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for scripts/weekly-employee-summary.ts — Sunday WhatsApp
 * summary for active non-customer employees with phone numbers.
 *
 * The script is top-level executable: `main()` runs on module import
 * and calls `process.exit()` at the end. We stub process.exit, env,
 * createClient, and global fetch, then re-import the module per-test
 * with `vi.resetModules()`.
 *
 * Key behaviours under test:
 *   - WEEKLY_SUMMARY_DRY_RUN default + explicit true/false
 *   - Query filters (status=active, role!=customer, phone present)
 *   - Zero-activity skip
 *   - yCloud payload shape + Hebrew message body content
 *   - yCloud HTTP error does not crash the loop
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Hoisted mock state ──────────────────────────────────────
// Using vi.hoisted() so the state is available to vi.mock factories
// (vi.mock hoists above import; plain module-scope `let` wouldn't be
// initialised when the factory runs).
const hoisted = vi.hoisted(() => {
  return {
    // The active Supabase double that each test configures before
    // importing the script.
    dbImpl: null as null | {
      from: (table: string) => any;
    },
    createClientSpy: null as null | ReturnType<typeof vi.fn>,
    getTargetSpy: null as null | ReturnType<typeof vi.fn>,
    calcSummarySpy: null as null | ReturnType<typeof vi.fn>,
    calcLoyaltyBonusSpy: null as null | ReturnType<typeof vi.fn>,
    countWorkingDaysSpy: null as null | ReturnType<typeof vi.fn>,
    lastDayOfMonthSpy: null as null | ReturnType<typeof vi.fn>,
  };
});

vi.mock("@supabase/supabase-js", () => {
  const createClient = vi.fn((..._args: unknown[]) => hoisted.dbImpl);
  hoisted.createClientSpy = createClient;
  return { createClient };
});

vi.mock("../../../lib/commissions/calculator", () => {
  const calcMonthlySummary = vi.fn(() => ({
    linesCommission: 0,
    devicesCommission: 0,
    loyaltyBonus: 0,
    grossCommission: 0,
    totalSanctions: 0,
    netCommission: 1234,
    targetAmount: 0,
    targetProgress: 0,
    autoSyncedCount: 0,
    manualEntryCount: 0,
  }));
  const calcLoyaltyBonus = vi.fn(() => ({ earnedSoFar: 0, pendingFuture: 0 }));
  hoisted.calcSummarySpy = calcMonthlySummary;
  hoisted.calcLoyaltyBonusSpy = calcLoyaltyBonus;
  return { calcMonthlySummary, calcLoyaltyBonus };
});

vi.mock("../../../lib/commissions/ledger", () => {
  const getCommissionTarget = vi.fn(async () => ({ target_total: 10000 }));
  const lastDayOfMonth = vi.fn((month: string) => `${month}-28`);
  hoisted.getTargetSpy = getCommissionTarget;
  hoisted.lastDayOfMonthSpy = lastDayOfMonth;
  return { getCommissionTarget, lastDayOfMonth };
});

vi.mock("../../../lib/commissions/date-utils", () => {
  const countWorkingDays = vi.fn(() => 5);
  hoisted.countWorkingDaysSpy = countWorkingDays;
  return { countWorkingDays };
});

// ── Per-test scaffolding helpers ────────────────────────────
type Recipient = {
  id: string;
  name: string | null;
  phone: string | null;
  role: string;
  status: string;
};

/**
 * Build a Supabase double that responds to the 4 query patterns used
 * by the script:
 *   - `.from("users").select(...).eq("status","active").neq("role","customer")`
 *   - `.from("commission_sales").select(...).eq(...).is(...).gte(...).lte(...)`
 *     (called twice per user — week range, then month range)
 *   - `.from("commission_sanctions").select(...).eq(...).is(...).gte(...).lte(...)`
 */
function buildDb(opts: {
  users: Recipient[];
  weekSales?: Array<{ sale_type: string; commission_amount: number; package_price: number; device_sale_amount: number }>;
  monthSales?: Array<{ sale_type: string; package_price: number; device_sale_amount: number; commission_amount: number; source: string | null; loyalty_start_date: string | null; loyalty_status: string | null }>;
  sanctions?: Array<{ amount: number }>;
  capturedFilters?: { status?: string; role?: string };
}) {
  const weekSales = opts.weekSales ?? [];
  const monthSales = opts.monthSales ?? [];
  const sanctions = opts.sanctions ?? [];
  const captured = opts.capturedFilters ?? {};

  // commission_sales is called twice per user — first weekRes, then monthRes.
  // We build a stateful counter to return them in order.
  let commissionSalesCallIndex = 0;

  return {
    from: (table: string) => {
      if (table === "users") {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn((col: string, val: string) => {
            if (col === "status") captured.status = val;
            return builder;
          }),
          neq: vi.fn((col: string, val: string) => {
            if (col === "role") captured.role = val;
            return builder;
          }),
          then: (resolve: any) => resolve({ data: opts.users, error: null }),
        };
        return builder;
      }
      if (table === "commission_sales") {
        const which = commissionSalesCallIndex;
        commissionSalesCallIndex += 1;
        const data = which % 2 === 0 ? weekSales : monthSales;
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data, error: null }),
        };
        return builder;
      }
      if (table === "commission_sanctions") {
        const builder: any = {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          is: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
          then: (resolve: any) => resolve({ data: sanctions, error: null }),
        };
        return builder;
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };
}

// ── Lifecycle ───────────────────────────────────────────────
let exitSpy: ReturnType<typeof vi.spyOn>;
let logSpy: ReturnType<typeof vi.spyOn>;
let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();

  // Required env for getEnv() inside main().
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("YCLOUD_API_KEY", "test-ycloud-key");
  vi.stubEnv("WHATSAPP_PHONE_ID", "+972500000000");

  // Stub process.exit so main()'s final call doesn't terminate vitest.
  // Throw a tagged error so the top-level `main().catch(...)` sees
  // something to log — but we'll also swallow it below.
  exitSpy = vi.spyOn(process, "exit").mockImplementation(((_code?: number) => {
    return undefined as never;
  }) as typeof process.exit);

  logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  // Default: no active-activity users — tests that need users override via buildDb.
  hoisted.dbImpl = buildDb({ users: [] });

  // Global fetch stub — individual tests override as needed.
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
    ok: true,
    status: 200,
    text: async () => "ok",
  }));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  exitSpy.mockRestore();
  logSpy.mockRestore();
  errorSpy.mockRestore();
});

/**
 * Import the script under test. The import is awaited so `main()`
 * runs to completion (it's invoked at top level). Any rejection
 * inside the script's own `main().catch(...)` is handled there.
 */
async function runScript(): Promise<void> {
  await import("../../../scripts/weekly-employee-summary");
  // Give the top-level main() promise a tick to resolve.
  await new Promise((r) => setImmediate(r));
}

// ── Tests ───────────────────────────────────────────────────

describe("weekly-employee-summary — dry-run default", () => {
  it("defaults WEEKLY_SUMMARY_DRY_RUN to true when unset → no fetch calls", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "");

    hoisted.dbImpl = buildDb({
      users: [{ id: "u1", name: "Alice", phone: "0501234567", role: "employee", status: "active" }],
      weekSales: [{ sale_type: "line", commission_amount: 100, package_price: 500, device_sale_amount: 0 }],
    });

    await runScript();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("honours WEEKLY_SUMMARY_DRY_RUN=true explicitly → no fetch calls", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "true");

    hoisted.dbImpl = buildDb({
      users: [{ id: "u1", name: "Alice", phone: "0501234567", role: "employee", status: "active" }],
      weekSales: [{ sale_type: "line", commission_amount: 100, package_price: 500, device_sale_amount: 0 }],
    });

    await runScript();

    expect(global.fetch).not.toHaveBeenCalled();
  });
});

describe("weekly-employee-summary — zero activity skip", () => {
  it("skips a user with 0 weekly sales AND 0 month amount, logs a 'skip' message, no fetch", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "false");

    hoisted.dbImpl = buildDb({
      users: [{ id: "u1", name: "Idle", phone: "0509999999", role: "employee", status: "active" }],
      weekSales: [],
      monthSales: [],
      sanctions: [],
    });

    await runScript();

    expect(global.fetch).not.toHaveBeenCalled();

    const logCalls: string[] = logSpy.mock.calls.map((c: unknown[]) => String(c[0]));
    expect(logCalls.some((line: string) => line.includes("skip") && line.includes("no activity"))).toBe(true);
  });
});

describe("weekly-employee-summary — live-send payload", () => {
  it("calls yCloud with exact URL + headers + JSON body (type: text, nested text.body)", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "false");

    hoisted.dbImpl = buildDb({
      users: [{ id: "u1", name: "Alice", phone: "0501234567", role: "employee", status: "active" }],
      weekSales: [
        { sale_type: "line", commission_amount: 100, package_price: 500, device_sale_amount: 0 },
      ],
      monthSales: [
        {
          sale_type: "line",
          package_price: 500,
          device_sale_amount: 0,
          commission_amount: 100,
          source: "manual",
          loyalty_start_date: null,
          loyalty_status: null,
        },
      ],
      sanctions: [],
    });

    await runScript();

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as any).mock.calls[0];
    expect(url).toBe("https://api.ycloud.com/v2/whatsapp/messages/sendDirectly");

    const headers = (init as { headers: Record<string, string> }).headers;
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers["X-API-Key"]).toBe("test-ycloud-key");

    const body = JSON.parse((init as { body: string }).body);
    expect(body.from).toBe("+972500000000");
    expect(body.to).toBe("0501234567");
    expect(body.type).toBe("text");
    expect(typeof body.text).toBe("object");
    expect(typeof body.text.body).toBe("string");
    expect(body.text.body.length).toBeGreaterThan(0);
  });

  it("message body contains Hebrew emojis/labels, week range, weekly total, MTD, target %, daily required", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "false");

    hoisted.dbImpl = buildDb({
      users: [{ id: "u1", name: "Alice", phone: "0501234567", role: "employee", status: "active" }],
      weekSales: [
        { sale_type: "line", commission_amount: 100, package_price: 500, device_sale_amount: 0 },
        { sale_type: "line", commission_amount: 100, package_price: 500, device_sale_amount: 0 },
      ],
      monthSales: [
        {
          sale_type: "line",
          package_price: 500,
          device_sale_amount: 0,
          commission_amount: 100,
          source: "manual",
          loyalty_start_date: null,
          loyalty_status: null,
        },
      ],
      sanctions: [],
    });

    await runScript();

    const [, init] = (global.fetch as any).mock.calls[0];
    const body = JSON.parse((init as { body: string }).body);
    const msg: string = body.text.body;

    // Fixed Hebrew strings from formatMessage()
    expect(msg).toContain("📊 סיכום שבועי");
    expect(msg).toContain("💰");
    expect(msg).toContain("🎯");
    expect(msg).toContain("📅");
    expect(msg).toContain("עמלה");
    expect(msg).toContain("יעד חודשי");
    expect(msg).toContain("בהצלחה");

    // Week range — ISO dates of form YYYY-MM-DD ... YYYY-MM-DD.
    expect(msg).toMatch(/שבוע \d{4}-\d{2}-\d{2} – \d{4}-\d{2}-\d{2}/);

    // Weekly total (1000 = 2 × 500) and transaction count (2 עסקאות).
    expect(msg).toContain("(2 עסקאות)");
    // Hebrew locale-formatted 1,000 uses U+002C comma by default in node.
    expect(msg).toMatch(/1,?000₪/);

    // Progress percent — target_total mock = 10000, monthAmount = 500 → 5%.
    expect(msg).toContain("5%");

    // Daily required exists as "נדרש ליום: XXX₪" — the mock sets
    // workingDaysLeft=5 and remaining=9500, so dailyRequired=ceil(9500/5)=1900.
    expect(msg).toMatch(/נדרש ליום: 1,?900₪/);

    // User name (no Arabic fallback).
    expect(msg).toContain("Alice");
  });
});

describe("weekly-employee-summary — filtering", () => {
  it("filters out users with no phone or phone shorter than 9 chars", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "false");

    hoisted.dbImpl = buildDb({
      users: [
        { id: "u1", name: "NoPhone", phone: null, role: "employee", status: "active" },
        { id: "u2", name: "ShortPhone", phone: "123", role: "employee", status: "active" },
      ],
    });

    await runScript();

    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("queries users with status=active AND role!=customer (checked via captured filter args)", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "true");

    const captured: { status?: string; role?: string } = {};
    hoisted.dbImpl = buildDb({ users: [], capturedFilters: captured });

    await runScript();

    expect(captured.status).toBe("active");
    expect(captured.role).toBe("customer");
  });

  it("excludes users returned by the query (e.g., status inactive/suspended) because the filter is server-side — only active employees surface", async () => {
    // Simulate: the server has already applied .eq("status","active"),
    // so the mock only returns active rows. A suspended user would
    // never arrive at the client. This test pins the documented
    // contract: any non-active row the mock *does* deliver with a
    // phone should be processed (the script relies on the server).
    //
    // The real-world inactive/suspended exclusion happens in the WHERE
    // clause; we've asserted that in the previous test via `captured.status`.
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "true");

    hoisted.dbImpl = buildDb({
      users: [
        // Only the active user is returned — inactive/suspended
        // would never reach this array in production.
        { id: "u1", name: "ActiveAlice", phone: "0501234567", role: "employee", status: "active" },
      ],
      weekSales: [
        { sale_type: "line", commission_amount: 50, package_price: 300, device_sale_amount: 0 },
      ],
    });

    await runScript();

    // Dry run → no fetch, but the user WAS processed (visible in logs).
    const allLogs: string = logSpy.mock.calls
      .map((c: unknown[]) => c.map((x) => String(x)).join(" "))
      .join("\n");
    expect(allLogs).toContain("ActiveAlice");
  });
});

describe("weekly-employee-summary — yCloud error resilience", () => {
  it("yCloud non-2xx response → error logged, script does not crash, continues to next user", async () => {
    vi.stubEnv("WEEKLY_SUMMARY_DRY_RUN", "false");

    hoisted.dbImpl = buildDb({
      users: [
        { id: "u1", name: "FailUser", phone: "0501111111", role: "employee", status: "active" },
        { id: "u2", name: "OkUser", phone: "0502222222", role: "employee", status: "active" },
      ],
      weekSales: [
        { sale_type: "line", commission_amount: 100, package_price: 500, device_sale_amount: 0 },
      ],
      monthSales: [
        {
          sale_type: "line",
          package_price: 500,
          device_sale_amount: 0,
          commission_amount: 100,
          source: "manual",
          loyalty_start_date: null,
          loyalty_status: null,
        },
      ],
    });

    // First fetch fails with 500, second succeeds.
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "server oops" })
      .mockResolvedValueOnce({ ok: true, status: 200, text: async () => "ok" });
    vi.stubGlobal("fetch", fetchMock);

    await runScript();

    // Second user's fetch still happened — loop didn't bail.
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Error log contains the failed user's name.
    const errorLines: string = errorSpy.mock.calls
      .map((c: unknown[]) => c.map((x) => String(x)).join(" "))
      .join("\n");
    expect(errorLines).toContain("failed for FailUser");
    expect(errorLines).toMatch(/yCloud 500/);

    // process.exit was called with 1 at the end (failed>0).
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
