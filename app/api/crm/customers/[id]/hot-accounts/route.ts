import { NextRequest } from "next/server";
import { withPermission, logAudit } from "@/lib/admin/auth";
import { apiSuccess, apiError, safeError } from "@/lib/api-response";
import { validateBody } from "@/lib/admin/validators";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";

// ===== Schemas =====

const hotAccountSchema = z.object({
  hot_mobile_id: z.string().max(50).optional().nullable(),
  hot_customer_code: z.string().max(50).optional().nullable(),
  line_phone: z.string().max(30).optional().nullable(),
  label: z.string().max(100).optional().nullable(),
  status: z
    .enum(["pending", "verified", "active", "inactive", "conflict", "transferred"])
    .default("pending"),
  is_primary: z.boolean().default(false),
  source: z.string().max(50).default("admin_manual"),
  source_order_id: z.string().optional().nullable(),
  notes: z.string().max(5000).optional().nullable(),
}).refine(
  (d) => Boolean(d.hot_mobile_id?.trim() || d.hot_customer_code?.trim()),
  { message: "يجب توفير معرّف HOT أو كود عميل HOT على الأقل" },
);

const hotAccountUpdateSchema = z.object({
  hot_mobile_id: z.string().max(50).optional().nullable(),
  hot_customer_code: z.string().max(50).optional().nullable(),
  line_phone: z.string().max(30).optional().nullable(),
  label: z.string().max(100).optional().nullable(),
  status: z
    .enum(["pending", "verified", "active", "inactive", "conflict", "transferred"])
    .optional(),
  is_primary: z.boolean().optional(),
  notes: z.string().max(5000).optional().nullable(),
});

function extractCustomerId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  // /api/crm/customers/:id/hot-accounts → ["api","crm","customers",":id","hot-accounts"]
  return parts[3];
}

// GET — list HOT accounts for a customer
export const GET = withPermission(
  "crm",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const customerId = extractCustomerId(req);

    const { data, error } = await db
      .from("customer_hot_accounts")
      .select("*")
      .eq("customer_id", customerId)
      .is("ended_at", null)
      .order("is_primary", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return safeError(error, "list hot accounts");

    return apiSuccess({ hotAccounts: data || [] });
  },
);

// POST — create a new HOT account link
export const POST = withPermission(
  "crm",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const customerId = extractCustomerId(req);
    const body = await req.json();
    const validation = validateBody(body, hotAccountSchema);
    if (validation.error) return apiError(validation.error, 400);

    const d = validation.data!;

    // Verify customer exists
    const { data: customer } = await db
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .single();

    if (!customer) return apiError("العميل غير موجود", 404);

    // If marking as primary, unset other primaries for this customer
    if (d.is_primary) {
      await db
        .from("customer_hot_accounts")
        .update({ is_primary: false })
        .eq("customer_id", customerId)
        .is("ended_at", null);
    }

    const { data, error } = await db
      .from("customer_hot_accounts")
      .insert({
        customer_id: customerId,
        hot_mobile_id: d.hot_mobile_id || null,
        hot_customer_code: d.hot_customer_code || null,
        line_phone: d.line_phone || null,
        label: d.label || null,
        status: d.status,
        is_primary: d.is_primary,
        source: d.source,
        source_order_id: d.source_order_id || null,
        notes: d.notes || null,
        created_by_id: user.appUserId || null,
        created_by_name: user.name || null,
      })
      .select()
      .single();

    if (error || !data) return safeError(error, "create hot account");

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "create",
      module: "crm",
      entityType: "customer_hot_account",
      entityId: data.id,
      details: {
        customer_id: customerId,
        hot_mobile_id: d.hot_mobile_id,
        hot_customer_code: d.hot_customer_code,
      },
    });

    return apiSuccess(data, undefined, 201);
  },
);

// PUT — update an existing HOT account (pass ?accountId= in query)
export const PUT = withPermission(
  "crm",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const customerId = extractCustomerId(req);
    const accountId = new URL(req.url).searchParams.get("accountId");
    if (!accountId) return apiError("accountId مطلوب", 400);

    const body = await req.json();
    const validation = validateBody(body, hotAccountUpdateSchema);
    if (validation.error) return apiError(validation.error, 400);

    const d = validation.data!;

    // If marking as primary, unset other primaries
    if (d.is_primary) {
      await db
        .from("customer_hot_accounts")
        .update({ is_primary: false })
        .eq("customer_id", customerId)
        .is("ended_at", null)
        .neq("id", accountId);
    }

    const { data, error } = await db
      .from("customer_hot_accounts")
      .update({ ...d, updated_at: new Date().toISOString() })
      .eq("id", accountId)
      .eq("customer_id", customerId)
      .select()
      .single();

    if (error || !data) return safeError(error, "update hot account");

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "update",
      module: "crm",
      entityType: "customer_hot_account",
      entityId: accountId,
      details: d,
    });

    return apiSuccess(data);
  },
);

// DELETE — archive (soft-delete) a HOT account (pass ?accountId= in query)
export const DELETE = withPermission(
  "crm",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const customerId = extractCustomerId(req);
    const accountId = new URL(req.url).searchParams.get("accountId");
    if (!accountId) return apiError("accountId مطلوب", 400);

    const { data, error } = await db
      .from("customer_hot_accounts")
      .update({
        ended_at: new Date().toISOString(),
        status: "inactive",
        is_primary: false,
      })
      .eq("id", accountId)
      .eq("customer_id", customerId)
      .select()
      .single();

    if (error || !data) return safeError(error, "archive hot account");

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "delete",
      module: "crm",
      entityType: "customer_hot_account",
      entityId: accountId,
      details: { customer_id: customerId, archived: true },
    });

    return apiSuccess({ ok: true });
  },
);
