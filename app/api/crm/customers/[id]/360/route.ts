import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { buildCustomerTimeline } from "@/lib/crm/customer-timeline";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withPermission(
  "crm",
  "view",
  async (req: NextRequest, db: SupabaseClient) => {
    const parts = req.nextUrl.pathname.split("/").filter(Boolean);
    // /api/crm/customers/:id/360 → parts = ["api","crm","customers",":id","360"]
    const id = parts[parts.length - 2];

    // Verify customer exists
    const { data: customer, error: custError } = await db
      .from("customers")
      .select("*")
      .eq("id", id)
      .single();

    if (custError || !customer) {
      return apiError("العميل غير موجود", 404);
    }

    // Parallel fetch: orders, deals, conversations, notes, hot accounts
    const [ordersRes, dealsRes, convoRes, notesRes, hotRes] = await Promise.all([
      db
        .from("orders")
        .select("*, order_items(*)")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("pipeline_deals")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("bot_conversations")
        .select("*")
        .eq("customer_id", id)
        .order("updated_at", { ascending: false }),
      db
        .from("customer_notes")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false }),
      db
        .from("customer_hot_accounts")
        .select("*")
        .eq("customer_id", id)
        .is("ended_at", null)
        .order("is_primary", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

    const hotAccountIds = (hotRes.data || []).map((account: any) => account.id);
    const [customerAuditRes, hotAuditRes] = await Promise.all([
      db
        .from("audit_log")
        .select("id, user_name, action, module, entity_type, entity_id, details, created_at")
        .eq("entity_type", "customer")
        .eq("entity_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
      hotAccountIds.length > 0
        ? db
            .from("audit_log")
            .select("id, user_name, action, module, entity_type, entity_id, details, created_at")
            .eq("entity_type", "customer_hot_account")
            .in("entity_id", hotAccountIds)
            .order("created_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [] as any[] }),
    ]);

    const timeline = buildCustomerTimeline({
      orders: ordersRes.data || [],
      deals: dealsRes.data || [],
      conversations: convoRes.data || [],
      notes: notesRes.data || [],
      hotAccounts: hotRes.data || [],
      audits: [...(customerAuditRes.data || []), ...(hotAuditRes.data || [])],
    });

    return apiSuccess({
      customer,
      orders: ordersRes.data || [],
      deals: dealsRes.data || [],
      conversations: convoRes.data || [],
      notes: notesRes.data || [],
      hotAccounts: hotRes.data || [],
      timeline,
    });
  },
);
