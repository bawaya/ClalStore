import { NextRequest } from "next/server";
import { withPermission, logAudit } from "@/lib/admin/auth";
import { apiSuccess, apiError, safeError } from "@/lib/api-response";
import { customerUpdateSchema, validateBody } from "@/lib/admin/validators";
import type { SupabaseClient } from "@supabase/supabase-js";

function extractId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  // /api/crm/customers/:id → parts = ["api","crm","customers",":id"]
  return parts[parts.length - 1];
}

export const GET = withPermission(
  "crm",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const id = extractId(req);

    const { data: customer, error } = await db
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (error || !customer) {
      return apiError("العميل غير موجود", 404);
    }

    return apiSuccess(customer);
  },
);

export const PUT = withPermission(
  "crm",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const id = extractId(req);
    const body = await req.json();
    const validation = validateBody(body, customerUpdateSchema);
    if (validation.error) {
      return apiError(validation.error, 400);
    }

    const d = validation.data!;
    if (d.phone) d.phone = d.phone.replace(/[-\s]/g, "");

    const { data, error } = await db
      .from("customers")
      .update({ ...d, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return safeError(error, "update customer");
    }

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "update",
      module: "crm",
      entityType: "customer",
      entityId: id,
      details: d,
    });

    return apiSuccess(data);
  },
);

export const DELETE = withPermission(
  "crm",
  "delete",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const id = extractId(req);

    // Check customer exists
    const { data: customer } = await db
      .from("customers")
      .select("id, name")
      .eq("id", id)
      .single();

    if (!customer) {
      return apiError("العميل غير موجود", 404);
    }

    // Delete notes first
    await db.from("customer_notes").delete().eq("customer_id", id);

    const { error } = await db.from("customers").delete().eq("id", id);
    if (error) {
      return safeError(error, "delete customer");
    }

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "delete",
      module: "crm",
      entityType: "customer",
      entityId: id,
      details: { name: customer.name },
    });

    return apiSuccess({ ok: true });
  },
);
