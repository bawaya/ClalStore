export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMTasks, createTask, updateTask, deleteTask } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const filters = { status: searchParams.get("status") || undefined, assignedTo: searchParams.get("assignedTo") || undefined };
    const data = await getCRMTasks(filters);
    return apiSuccess(data);
  } catch (err: unknown) { return apiError(errMsg(err), 500); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const task = await createTask(body);
    return apiSuccess(task);
  } catch (err: unknown) { return apiError(errMsg(err), 500); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id, ...updates } = await req.json();
    await updateTask(id, updates);
    return apiSuccess({ ok: true });
  } catch (err: unknown) { return apiError(errMsg(err), 500); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiError("Missing id", 400);
    await deleteTask(id);
    return apiSuccess({ ok: true });
  } catch (err: unknown) { return apiError(errMsg(err), 500); }
}
