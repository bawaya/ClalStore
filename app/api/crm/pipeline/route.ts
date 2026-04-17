import { NextRequest } from "next/server";
import { withPermission } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { pipelineDealSchema, pipelineDealUpdateSchema, validateBody } from "@/lib/admin/validators";
import {
  createPipelineDealRecord,
  deletePipelineDealRecord,
  getPipelineSnapshot,
  updatePipelineDealRecord,
} from "@/lib/crm/pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";

export const GET = withPermission(
  "crm",
  "view",
  async (_req: NextRequest, db: SupabaseClient) => {
    const data = await getPipelineSnapshot(db);
    return apiSuccess(data);
  },
);

export const POST = withPermission(
  "crm",
  "create",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const body = await req.json();
    const validation = validateBody(body, pipelineDealSchema);
    if (validation.error) {
      return apiError(validation.error, 400);
    }

    const deal = await createPipelineDealRecord(db, user, validation.data!);
    return apiSuccess(deal, undefined, 201);
  },
);

export const PUT = withPermission(
  "crm",
  "edit",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const body = await req.json();
    const validation = validateBody(body, pipelineDealUpdateSchema);
    if (validation.error) {
      return apiError(validation.error, 400);
    }

    const deal = await updatePipelineDealRecord(db, user, validation.data!);
    return apiSuccess(deal);
  },
);

export const DELETE = withPermission(
  "crm",
  "delete",
  async (req: NextRequest, db: SupabaseClient, user) => {
    const id = req.nextUrl.searchParams.get("id");
    if (!id) {
      return apiError("Missing id", 400);
    }

    await deletePipelineDealRecord(db, user, id);
    return apiSuccess({ ok: true });
  },
);
