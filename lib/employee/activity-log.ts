/**
 * Employee activity log helper — non-throwing wrapper around
 * INSERT INTO employee_activity_log. Used by commission register.ts,
 * cancel flows, sanctions, targets — basically every event that
 * the employee should see in their timeline.
 *
 * Non-throwing: activity logging is a best-effort side channel. If it
 * fails, the primary business operation must still succeed. Errors go
 * to console.warn for later investigation.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export type ActivityEventType =
  | "sale_registered"
  | "sale_cancelled"
  | "sanction_added"
  | "sanction_removed"
  | "target_set"
  | "target_updated"
  | "month_locked"
  | "correction_submitted"
  | "correction_resolved"
  | "profile_updated"
  | "milestone_reached";

export interface LogActivityInput {
  employeeId: string;
  eventType: ActivityEventType;
  title: string;
  description?: string | null;
  metadata?: Record<string, unknown>;
}

export async function logEmployeeActivity(
  db: SupabaseClient,
  input: LogActivityInput,
): Promise<void> {
  try {
    const { error } = await db.from("employee_activity_log").insert({
      employee_id: input.employeeId,
      event_type: input.eventType,
      title: input.title,
      description: input.description ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn(
        `[activity-log] insert failed (${input.eventType}):`,
        error.message,
      );
    }
  } catch (err) {
    console.warn("[activity-log] unexpected error:", err);
  }
}

/**
 * Bulk insert — used by weekly summary or bulk admin actions where
 * one atomic call is cheaper than N individual ones.
 */
export async function logEmployeeActivityBulk(
  db: SupabaseClient,
  rows: LogActivityInput[],
): Promise<void> {
  if (rows.length === 0) return;
  try {
    const { error } = await db.from("employee_activity_log").insert(
      rows.map((r) => ({
        employee_id: r.employeeId,
        event_type: r.eventType,
        title: r.title,
        description: r.description ?? null,
        metadata: r.metadata ?? {},
      })),
    );
    if (error) {
      console.warn("[activity-log] bulk insert failed:", error.message);
    }
  } catch (err) {
    console.warn("[activity-log] bulk unexpected error:", err);
  }
}
