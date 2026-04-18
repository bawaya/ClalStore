/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tests for lib/employee/activity-log.ts — non-throwing activity
 * logger used by commission register, cancel flows, sanctions, etc.
 *
 * Covers: exact insert shape, default fallbacks (description→null,
 * metadata→{}), non-throw-on-error semantics, warn format, all 11
 * ActivityEventType values, bulk mapping + bulk error paths.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  logEmployeeActivity,
  logEmployeeActivityBulk,
  type ActivityEventType,
  type LogActivityInput,
} from "@/lib/employee/activity-log";

// ── Shared mock scaffolding ─────────────────────────────────
function makeDb(opts: {
  insertResult?: { error: { message: string } | null };
  fromThrows?: Error;
} = {}) {
  const { insertResult = { error: null }, fromThrows } = opts;
  const insert = vi.fn().mockResolvedValue(insertResult);
  const from = vi.fn().mockImplementation((_table: string) => {
    if (fromThrows) throw fromThrows;
    return { insert };
  });
  return { db: { from } as unknown as SupabaseClient, from, insert };
}

let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

// ── logEmployeeActivity — happy path ────────────────────────
describe("logEmployeeActivity — happy path", () => {
  it("inserts exact shape with default description=null and metadata={}", async () => {
    const { db, from, insert } = makeDb();

    await logEmployeeActivity(db, {
      employeeId: "emp-1",
      eventType: "sale_registered",
      title: "New sale registered",
    });

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("employee_activity_log");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith({
      employee_id: "emp-1",
      event_type: "sale_registered",
      title: "New sale registered",
      description: null,
      metadata: {},
    });
  });

  it("returns undefined (void) on success — not a wrapped value", async () => {
    const { db } = makeDb();

    const result = await logEmployeeActivity(db, {
      employeeId: "emp-1",
      eventType: "sale_registered",
      title: "ok",
    });

    expect(result).toBeUndefined();
  });

  it("passes through explicit description and metadata verbatim", async () => {
    const { db, insert } = makeDb();

    await logEmployeeActivity(db, {
      employeeId: "emp-2",
      eventType: "sanction_added",
      title: "Sanction added",
      description: "Late arrival",
      metadata: { amount: 50, reason_code: "LATE", nested: { tier: 2 } },
    });

    expect(insert).toHaveBeenCalledWith({
      employee_id: "emp-2",
      event_type: "sanction_added",
      title: "Sanction added",
      description: "Late arrival",
      metadata: { amount: 50, reason_code: "LATE", nested: { tier: 2 } },
    });
  });

  it("preserves Arabic/Hebrew UTF-8 in description without escaping", async () => {
    const { db, insert } = makeDb();
    const arabicDesc = "تم تسجيل عملية بيع جديدة";

    await logEmployeeActivity(db, {
      employeeId: "emp-3",
      eventType: "sale_registered",
      title: "بيع جديد",
      description: arabicDesc,
    });

    const call = insert.mock.calls[0]?.[0] as { description: string; title: string };
    expect(call.description).toBe(arabicDesc);
    expect(call.title).toBe("بيع جديد");
  });
});

// ── logEmployeeActivity — error handling ────────────────────
describe("logEmployeeActivity — error handling", () => {
  it("does not throw when DB insert returns an error; warns with event_type + message", async () => {
    const { db } = makeDb({ insertResult: { error: { message: "rls_violation" } } });

    await expect(
      logEmployeeActivity(db, {
        employeeId: "emp-1",
        eventType: "sale_cancelled",
        title: "cancel",
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[activity-log] insert failed (sale_cancelled):",
      "rls_violation",
    );
  });

  it("does not throw when db.from() itself throws; warns with unexpected-error prefix", async () => {
    const boom = new Error("connection lost");
    const { db } = makeDb({ fromThrows: boom });

    await expect(
      logEmployeeActivity(db, {
        employeeId: "emp-1",
        eventType: "sale_registered",
        title: "boom",
      }),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[activity-log] unexpected error:", boom);
  });
});

// ── All 11 ActivityEventType values ─────────────────────────
describe("logEmployeeActivity — all ActivityEventType values", () => {
  const allEventTypes: ActivityEventType[] = [
    "sale_registered",
    "sale_cancelled",
    "sanction_added",
    "sanction_removed",
    "target_set",
    "target_updated",
    "month_locked",
    "correction_submitted",
    "correction_resolved",
    "profile_updated",
    "milestone_reached",
  ];

  it.each(allEventTypes)("accepts event_type=%s and inserts it verbatim", async (eventType) => {
    const { db, insert } = makeDb();

    await logEmployeeActivity(db, {
      employeeId: "emp-ev",
      eventType,
      title: `Event: ${eventType}`,
    });

    expect(insert).toHaveBeenCalledTimes(1);
    const call = insert.mock.calls[0]?.[0] as { event_type: ActivityEventType };
    expect(call.event_type).toBe(eventType);
  });

  it("covers all 11 documented event types (guards against union drift)", () => {
    expect(allEventTypes).toHaveLength(11);
  });
});

// ── logEmployeeActivityBulk ─────────────────────────────────
describe("logEmployeeActivityBulk", () => {
  it("is a no-op for an empty rows[] — does not call .from() or .insert()", async () => {
    const { db, from, insert } = makeDb();

    const result = await logEmployeeActivityBulk(db, []);

    expect(result).toBeUndefined();
    expect(from).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
  });

  it("bulk-inserts multiple rows in a single insert() call with mapped shapes", async () => {
    const { db, from, insert } = makeDb();

    const rows: LogActivityInput[] = [
      {
        employeeId: "emp-1",
        eventType: "sale_registered",
        title: "first",
        description: "first-desc",
        metadata: { idx: 1 },
      },
      {
        employeeId: "emp-2",
        eventType: "target_updated",
        title: "second",
        description: "second-desc",
        metadata: { idx: 2 },
      },
    ];

    await logEmployeeActivityBulk(db, rows);

    expect(from).toHaveBeenCalledTimes(1);
    expect(from).toHaveBeenCalledWith("employee_activity_log");
    expect(insert).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledWith([
      {
        employee_id: "emp-1",
        event_type: "sale_registered",
        title: "first",
        description: "first-desc",
        metadata: { idx: 1 },
      },
      {
        employee_id: "emp-2",
        event_type: "target_updated",
        title: "second",
        description: "second-desc",
        metadata: { idx: 2 },
      },
    ]);
  });

  it("defaults missing description→null and missing metadata→{} in bulk mapping", async () => {
    const { db, insert } = makeDb();

    await logEmployeeActivityBulk(db, [
      { employeeId: "emp-1", eventType: "profile_updated", title: "only-required" },
      { employeeId: "emp-2", eventType: "milestone_reached", title: "also-only" },
    ]);

    expect(insert).toHaveBeenCalledWith([
      {
        employee_id: "emp-1",
        event_type: "profile_updated",
        title: "only-required",
        description: null,
        metadata: {},
      },
      {
        employee_id: "emp-2",
        event_type: "milestone_reached",
        title: "also-only",
        description: null,
        metadata: {},
      },
    ]);
  });

  it("warns with bulk-insert-failed prefix when DB returns an error and does not throw", async () => {
    const { db } = makeDb({ insertResult: { error: { message: "unique_violation" } } });

    await expect(
      logEmployeeActivityBulk(db, [
        { employeeId: "e1", eventType: "sale_registered", title: "t" },
      ]),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(
      "[activity-log] bulk insert failed:",
      "unique_violation",
    );
  });

  it("warns with bulk-unexpected-error prefix when db.from() itself throws", async () => {
    const boom = new Error("pool exhausted");
    const { db } = makeDb({ fromThrows: boom });

    await expect(
      logEmployeeActivityBulk(db, [
        { employeeId: "e1", eventType: "sale_registered", title: "t" },
      ]),
    ).resolves.toBeUndefined();

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith("[activity-log] bulk unexpected error:", boom);
  });
});
