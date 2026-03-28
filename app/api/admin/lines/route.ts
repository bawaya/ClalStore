export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminLines, createLine, updateLine, deleteLine, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { lineSchema, lineUpdateSchema, validateBody } from "@/lib/admin/validators";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const lines = await getAdminLines();
    return apiSuccess(lines);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, lineSchema);
    if (v.error) return apiError(v.error, 400);
    const data = v.data!;
    const line = await createLine(data);
    await logAction("مدير", `إضافة باقة: ${data.name_ar}`, "line_plan", line.id);
    return apiSuccess(line);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing id", 400);
    const v = validateBody(updates, lineUpdateSchema);
    if (v.error) return apiError(v.error, 400);
    const line = await updateLine(id, v.data!);
    await logAction("مدير", `تعديل باقة: ${id}`, "line_plan", id);
    return apiSuccess(line);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("Missing id", 400);
    await deleteLine(id);
    await logAction("مدير", `حذف باقة: ${id}`, "line_plan", id);
    return apiSuccess(null);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}
