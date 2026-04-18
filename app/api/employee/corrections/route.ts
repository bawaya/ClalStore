/**
 * GET  /api/employee/corrections        — list the authed employee's requests
 * POST /api/employee/corrections        — submit a new correction request
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { logEmployeeActivity } from "@/lib/employee/activity-log";
import { z } from "zod";

const createSchema = z.object({
  commissionSaleId: z.number().int().positive().optional().nullable(),
  salesDocId: z.number().int().positive().optional().nullable(),
  requestType: z.enum([
    "amount_error",
    "wrong_type",
    "wrong_date",
    "wrong_customer",
    "missing_sale",
    "other",
  ]),
  description: z.string().min(10).max(2000),
});

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { data, error } = await db
      .from("commission_correction_requests")
      .select("*")
      .eq("employee_id", authed.appUserId)
      .order("created_at", { ascending: false })
      .limit(200);

    if (error) return safeError(error, "corrections/list");
    return apiSuccess({ requests: data || [] });
  } catch (err) {
    return safeError(err, "EmployeeCorrections/GET", "خطأ في السيرفر", 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json().catch(() => ({}));
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(parsed.error.issues.map((i) => i.message).join("; "), 400);
    }

    const { data, error } = await db
      .from("commission_correction_requests")
      .insert({
        employee_id: authed.appUserId,
        commission_sale_id: parsed.data.commissionSaleId ?? null,
        sales_doc_id: parsed.data.salesDocId ?? null,
        request_type: parsed.data.requestType,
        description: parsed.data.description,
        status: "pending",
      })
      .select()
      .single();

    if (error || !data) return safeError(error, "corrections/insert");

    void logEmployeeActivity(db, {
      employeeId: authed.appUserId,
      eventType: "correction_submitted",
      title: "طلب تصحيح مُقدَّم",
      description: parsed.data.description.slice(0, 200),
      metadata: { correction_id: data.id, type: parsed.data.requestType },
    });

    return apiSuccess({ request: data }, undefined, 201);
  } catch (err) {
    return safeError(err, "EmployeeCorrections/POST", "خطأ في السيرفر", 500);
  }
}
