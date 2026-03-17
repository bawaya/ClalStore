export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminLines, createLine, updateLine, deleteLine, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { lineSchema, lineUpdateSchema, validateBody } from "@/lib/admin/validators";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const lines = await getAdminLines();
    return NextResponse.json({ data: lines });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, lineSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const data = v.data!;
    const line = await createLine(data);
    await logAction("مدير", `إضافة باقة: ${data.name_ar}`, "line_plan", line.id);
    return NextResponse.json({ data: line });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const v = validateBody(updates, lineUpdateSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const line = await updateLine(id, v.data!);
    await logAction("مدير", `تعديل باقة: ${id}`, "line_plan", id);
    return NextResponse.json({ data: line });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteLine(id);
    await logAction("مدير", `حذف باقة: ${id}`, "line_plan", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
