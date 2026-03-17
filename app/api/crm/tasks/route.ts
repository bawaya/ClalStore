export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMTasks, createTask, updateTask, deleteTask } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const filters = { status: searchParams.get("status") || undefined, assignedTo: searchParams.get("assignedTo") || undefined };
    const data = await getCRMTasks(filters);
    return NextResponse.json({ data });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const task = await createTask(body);
    return NextResponse.json({ data: task });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id, ...updates } = await req.json();
    await updateTask(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteTask(id);
    return NextResponse.json({ success: true });
  } catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}
