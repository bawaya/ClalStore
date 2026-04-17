import { NextRequest } from "next/server";
import { withPermission, logAudit } from "@/lib/admin/auth";
import { apiSuccess, apiError, safeError } from "@/lib/api-response";
import { customerNoteSchema, validateBody } from "@/lib/admin/validators";
import type { SupabaseClient } from "@supabase/supabase-js";

function extractCustomerId(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split("/").filter(Boolean);
  // /api/crm/customers/:id/notes → parts = ["api","crm","customers",":id","notes"]
  return parts[parts.length - 2];
}

export const GET = withPermission(
  "crm",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const id = extractCustomerId(req);

    const { data, error } = await db
      .from("customer_notes")
      .select("*")
      .eq("customer_id", id)
      .order("created_at", { ascending: false });

    if (error) return safeError(error, "fetch notes");
    return apiSuccess({ notes: data || [] });
  },
);

export const POST = withPermission(
  "crm",
  "create",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const id = extractCustomerId(req);
    const body = await req.json();
    const validation = validateBody(body, customerNoteSchema);
    if (validation.error) {
      return apiError(validation.error, 400);
    }

    const { data, error } = await db
      .from("customer_notes")
      .insert({
        customer_id: id,
        user_id: user.appUserId || null,
        user_name: user.name || "Admin",
        text: validation.data!.text,
      })
      .select()
      .single();

    if (error || !data) {
      return safeError(error, "create note");
    }

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name || "Admin",
      userRole: user.role,
      action: "create",
      module: "crm",
      entityType: "customer_note",
      entityId: data.id,
      details: { customer_id: id },
    });

    return apiSuccess(data, undefined, 201);
  },
);
