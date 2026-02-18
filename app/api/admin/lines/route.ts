import { NextRequest, NextResponse } from "next/server";
import { getAdminLines, createLine, updateLine, deleteLine, logAction } from "@/lib/admin/queries";

export async function GET() {
  try {
    const lines = await getAdminLines();
    return NextResponse.json({ data: lines });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const line = await createLine(body);
    await logAction("مدير", `إضافة باقة: ${body.name_ar}`, "line_plan", line.id);
    return NextResponse.json({ data: line });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const line = await updateLine(id, updates);
    await logAction("مدير", `تعديل باقة: ${id}`, "line_plan", id);
    return NextResponse.json({ data: line });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
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
