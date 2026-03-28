export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getPipelineDeals, createDeal, updateDeal, deleteDeal } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    return apiSuccess(await getPipelineDeals());
  }
  catch (err: unknown) { return apiError(errMsg(err), 500); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    return apiSuccess(await createDeal(await req.json()));
  }
  catch (err: unknown) { return apiError(errMsg(err), 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id, ...u } = await req.json(); await updateDeal(id, u); return apiSuccess({ ok: true });
  }
  catch (err: unknown) { return apiError(errMsg(err), 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const id = new URL(req.url).searchParams.get("id"); if (!id) return apiError("Missing id", 400); await deleteDeal(id); return apiSuccess({ ok: true });
  }
  catch (err: unknown) { return apiError(errMsg(err), 500); }
}
