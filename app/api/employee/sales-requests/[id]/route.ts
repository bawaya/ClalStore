/**
 * Employee single-request: fetch + edit.
 *
 *   GET   /api/employee/sales-requests/:id       → full request + devices + packages + events
 *   PATCH /api/employee/sales-requests/:id       → edit (only if status in draft|needs_info)
 *   DELETE /api/employee/sales-requests/:id      → soft-delete a draft
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import {
  isValidIsraeliId,
  isValidIsraeliMobile,
  isValidBankBranch,
  isValidBankAccount,
  normaliseIsraeliMobile,
} from "@/lib/validators/israeli";
import { computeTotals, logEvent } from "@/lib/sales-requests/service";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId)) return apiError("invalid id", 400);

    const [reqRes, devRes, pkgRes, evRes] = await Promise.all([
      db.from("sales_requests").select("*").eq("id", requestId).eq("employee_id", authed.appUserId).is("deleted_at", null).maybeSingle(),
      db.from("sales_request_devices").select("*").eq("request_id", requestId).order("position"),
      db.from("sales_request_packages").select("*").eq("request_id", requestId).order("position"),
      db.from("sales_request_events").select("id, event_type, actor_id, actor_role, message, created_at").eq("request_id", requestId).order("created_at", { ascending: true }),
    ]);

    if (reqRes.error) return safeError(reqRes.error, "sales-request/get");
    if (!reqRes.data) return apiError("الطلب غير موجود أو ليس لديك صلاحية", 404);

    return apiSuccess({
      request: reqRes.data,
      devices: devRes.data || [],
      packages: pkgRes.data || [],
      events: evRes.data || [],
    });
  } catch (err) {
    return safeError(err, "EmployeeSalesRequestGet", "خطأ داخلي", 500);
  }
}

// Editable statuses for the employee
const EDITABLE_STATUSES = new Set(["draft", "needs_info"]);

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId)) return apiError("invalid id", 400);

    const body = await req.json().catch(() => null);
    if (!body || typeof body !== "object") return apiError("invalid body", 400);
    const b = body as Record<string, unknown>;
    const submit = Boolean(b.submit);

    // Load to check ownership + status
    const { data: existing, error: loadError } = await db
      .from("sales_requests")
      .select("id, employee_id, status")
      .eq("id", requestId)
      .eq("employee_id", authed.appUserId)
      .is("deleted_at", null)
      .maybeSingle();
    if (loadError) return safeError(loadError, "sales-request/edit-load");
    if (!existing) return apiError("الطلب غير موجود", 404);

    if (!EDITABLE_STATUSES.has((existing as { status: string }).status)) {
      return apiError(
        "لا يمكن تعديل الطلب في حالته الحالية. اتصل بالإدارة إن كنت بحاجة للتعديل.",
        409,
      );
    }

    // Build updates (keep it explicit; drafts can partially update)
    const str = (v: unknown) => (typeof v === "string" ? v.trim() : null);
    const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

    const updates: Record<string, unknown> = {};
    const fieldMap: Array<[keyof typeof updates, unknown]> = [
      ["customer_name", str(b.customer_name)],
      ["customer_id_number", typeof b.customer_id_number === "string" ? b.customer_id_number.replace(/\D/g, "") : null],
      ["contact_number", str(b.contact_number)],
      ["delivery_address", str(b.delivery_address)],
      ["locality_name", str(b.locality_name)],
      ["bank_name", str(b.bank_name)],
      ["bank_code", str(b.bank_code)],
      ["bank_branch", str(b.bank_branch)],
      ["bank_account", str(b.bank_account)],
    ];
    for (const [k, v] of fieldMap) if (v !== null && v !== undefined && v !== "") updates[k as string] = v;

    const devicesIn = Array.isArray(b.devices)
      ? b.devices.map((d) => ({
          device_name: str((d as Record<string, unknown>).device_name) || "",
          total_price: num((d as Record<string, unknown>).total_price),
          installments_count: Math.trunc(num((d as Record<string, unknown>).installments_count)),
        }))
      : null;
    const packagesIn = Array.isArray(b.packages)
      ? b.packages.map((p) => ({
          package_name: str((p as Record<string, unknown>).package_name) || "",
          monthly_price: num((p as Record<string, unknown>).monthly_price),
          lines_count: Math.trunc(num((p as Record<string, unknown>).lines_count)),
        }))
      : null;

    if (submit) {
      // Require full validation when submitting
      const mergedDevices = devicesIn || [];
      const mergedPackages = packagesIn || [];
      const mergedCustomerId = typeof updates.customer_id_number === "string" ? updates.customer_id_number : "";
      const mergedMobile = typeof updates.contact_number === "string" ? updates.contact_number : "";

      if (!updates.customer_name) return apiError("اسم الزبون مطلوب", 400);
      if (!isValidIsraeliId(mergedCustomerId)) return apiError("رقم الهوية غير صالح", 400);
      if (!isValidIsraeliMobile(mergedMobile)) return apiError("رقم التواصل غير صالح", 400);
      if (!updates.delivery_address) return apiError("عنوان التوصيل مطلوب", 400);
      if (!updates.bank_name) return apiError("اسم البنك مطلوب", 400);
      if (!isValidBankBranch(String(updates.bank_branch || ""))) {
        return apiError("رقم الفرع يجب ٣ أرقام", 400);
      }
      if (!isValidBankAccount(String(updates.bank_account || ""))) {
        return apiError("رقم الحساب بين ٤-٩ أرقام", 400);
      }
      if (mergedDevices.length === 0) return apiError("يجب إضافة جهاز واحد على الأقل", 400);
      for (const d of mergedDevices) {
        if (!d.device_name || !(d.total_price > 0) || !(d.installments_count >= 1 && d.installments_count <= 60)) {
          return apiError("بيانات الجهاز غير مكتملة", 400);
        }
      }
      for (const p of mergedPackages) {
        if (!p.package_name || !(p.monthly_price > 0) || !(p.lines_count >= 1 && p.lines_count <= 20)) {
          return apiError("بيانات الحڤيلا غير مكتملة", 400);
        }
      }
      const normMobile = normaliseIsraeliMobile(mergedMobile);
      if (normMobile) updates.contact_number = normMobile;
    }

    // Re-compute totals only if devices/packages were provided
    if (devicesIn || packagesIn) {
      // Fetch the current children if caller only updated one side
      const [curDev, curPkg] = await Promise.all([
        devicesIn ? null : db.from("sales_request_devices").select("device_name, total_price, installments_count").eq("request_id", requestId),
        packagesIn ? null : db.from("sales_request_packages").select("package_name, monthly_price, lines_count").eq("request_id", requestId),
      ]);
      const effDevices = devicesIn || (curDev?.data as never) || [];
      const effPackages = packagesIn || (curPkg?.data as never) || [];
      const totals = computeTotals(effDevices, effPackages);
      Object.assign(updates, totals);
    }

    if (submit) {
      updates.status = "pending";
      updates.submitted_at = new Date().toISOString();
    }

    // Update main row
    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await db
        .from("sales_requests")
        .update(updates)
        .eq("id", requestId);
      if (updateError) return safeError(updateError, "sales-request/edit");
    }

    // Replace children if caller sent them
    if (devicesIn) {
      await db.from("sales_request_devices").delete().eq("request_id", requestId);
      if (devicesIn.length > 0) {
        await db.from("sales_request_devices").insert(
          devicesIn.map((d, i) => ({
            request_id: requestId,
            device_name: d.device_name,
            total_price: d.total_price,
            installments_count: d.installments_count,
            position: i,
          })),
        );
      }
    }
    if (packagesIn) {
      await db.from("sales_request_packages").delete().eq("request_id", requestId);
      if (packagesIn.length > 0) {
        await db.from("sales_request_packages").insert(
          packagesIn.map((p, i) => ({
            request_id: requestId,
            package_name: p.package_name,
            monthly_price: p.monthly_price,
            lines_count: p.lines_count,
            position: i,
          })),
        );
      }
    }

    await logEvent(db, {
      request_id: requestId,
      event_type: submit
        ? ((existing as { status: string }).status === "needs_info" ? "info_provided" : "submitted")
        : "edited",
      actor_id: authed.appUserId,
      actor_role: authed.role,
    });

    return apiSuccess({ id: requestId, status: updates.status ?? (existing as { status: string }).status });
  } catch (err) {
    return safeError(err, "EmployeeSalesRequestEdit", "خطأ داخلي", 500);
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId)) return apiError("invalid id", 400);

    // Only allow deletion of drafts
    const { data: existing } = await db
      .from("sales_requests")
      .select("id, status")
      .eq("id", requestId)
      .eq("employee_id", authed.appUserId)
      .is("deleted_at", null)
      .maybeSingle();
    if (!existing) return apiError("الطلب غير موجود", 404);
    if ((existing as { status: string }).status !== "draft") {
      return apiError("يمكن حذف المسوّدات فقط", 409);
    }

    await db
      .from("sales_requests")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", requestId);

    await logEvent(db, {
      request_id: requestId,
      event_type: "deleted",
      actor_id: authed.appUserId,
      actor_role: authed.role,
    });

    return apiSuccess({ id: requestId, deleted: true });
  } catch (err) {
    return safeError(err, "EmployeeSalesRequestDelete", "خطأ داخلي", 500);
  }
}
