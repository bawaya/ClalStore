/**
 * POST /api/admin/sales-requests/:id/approve
 * Super-admin-only action.
 *
 * On approval, commission_sales rows are created: one per device (with
 * its price) and N per package (where N = lines_count, each row being a
 * single-line sale at the package's monthly price). Rows are credited to
 * the employee who submitted the request.
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import { approveSalesRequest } from "@/lib/sales-requests/service";
import type {
  SalesRequestRow,
  SalesRequestDeviceRow,
  SalesRequestPackageRow,
} from "@/lib/sales-requests/service";
import { logEmployeeActivity } from "@/lib/employee/activity-log";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const adminAuth = auth as unknown as { role: string; id: string; appUserId?: string };

    // Only super_admin can approve (product decision — Q4 in the design spec)
    if (adminAuth.role !== "super_admin") {
      return apiError("الموافقة تتطلب صلاحية Super Admin", 403);
    }
    const reviewerId = adminAuth.appUserId || adminAuth.id;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { id } = await params;
    const requestId = Number(id);
    if (!Number.isFinite(requestId)) return apiError("invalid id", 400);

    const body = await req.json().catch(() => ({}));
    const note = typeof (body as { note?: string }).note === "string"
      ? ((body as { note: string }).note.trim() || null)
      : null;

    // Load request + children
    const [reqRes, devRes, pkgRes] = await Promise.all([
      db.from("sales_requests").select("*").eq("id", requestId).is("deleted_at", null).maybeSingle(),
      db.from("sales_request_devices").select("*").eq("request_id", requestId).order("position"),
      db.from("sales_request_packages").select("*").eq("request_id", requestId).order("position"),
    ]);
    if (reqRes.error) return safeError(reqRes.error, "approve/load");
    if (!reqRes.data) return apiError("الطلب غير موجود", 404);

    const request = reqRes.data as unknown as SalesRequestRow;
    const devices = (devRes.data || []) as unknown as SalesRequestDeviceRow[];
    const packages = (pkgRes.data || []) as unknown as SalesRequestPackageRow[];

    if (devices.length === 0) {
      return apiError("لا يمكن اعتماد طلب بدون أجهزة", 400);
    }

    const result = await approveSalesRequest(db, {
      request,
      devices,
      packages,
      reviewerId,
      reviewerRole: adminAuth.role,
      note,
    });

    // Notify the employee
    void logEmployeeActivity(db, {
      employeeId: request.employee_id,
      eventType: "sales_request_approved",
      title: "تم اعتماد طلبك",
      description: `طلب #${request.id} — ${devices.length} جهاز + ${packages.reduce((s, p) => s + p.lines_count, 0)} خط. عمولتك: ₪${result.totalEmployeeCommission.toLocaleString()}`,
      metadata: {
        request_id: request.id,
        sale_ids: result.createdSaleIds,
        total_employee_commission: result.totalEmployeeCommission,
      },
    });

    return apiSuccess({
      id: request.id,
      status: "approved",
      created_sale_ids: result.createdSaleIds,
      total_employee_commission: result.totalEmployeeCommission,
      total_contract_commission: result.totalContractCommission,
    });
  } catch (err) {
    return safeError(err, "AdminSalesRequestApprove", "فشل في اعتماد الطلب", 500);
  }
}
