import { NextRequest } from "next/server";
import { withAdminAuth } from "@/lib/admin/auth";
import { apiSuccess, apiError } from "@/lib/api-response";
import { syncOrdersToCommissions, getLastSyncInfo } from "@/lib/commissions/sync-orders";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withAdminAuth(async (_req: NextRequest, _db: SupabaseClient) => {
  const info = await getLastSyncInfo();
  return apiSuccess(info);
});

export const POST = withAdminAuth(async (req: NextRequest, _db: SupabaseClient) => {
  const body = await req.json();
  const { startDate, endDate } = body;

  if (!startDate || !endDate) return apiError("startDate and endDate required", 400);

  const result = await syncOrdersToCommissions(startDate, endDate);
  return apiSuccess(result);
});
