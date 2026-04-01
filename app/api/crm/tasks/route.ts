
import { NextRequest, NextResponse } from "next/server";
import { getCRMTasks, createTask, updateTask, deleteTask } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { z } from "zod";

const taskSchema = z.object({
  title: z.string().min(1).max(300),
  description: z.string().max(5000).optional().nullable(),
  customer_id: z.string().max(100).optional().nullable(),
  order_id: z.string().max(100).optional().nullable(),
  assigned_to: z.string().max(100).optional().nullable(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z.enum(["todo", "in_progress", "done", "cancelled"]).default("todo"),
  due_date: z.string().optional().nullable(),
});

const taskUpdateSchema = taskSchema.partial();

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const filters = { status: searchParams.get("status") || undefined, assignedTo: searchParams.get("assignedTo") || undefined };
    const data = await getCRMTasks(filters);
    return apiSuccess(data);
  } catch (err: unknown) { return apiError("Failed to load tasks"); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const parsed = taskSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid data", 400);
    const task = await createTask(parsed.data);
    return apiSuccess(task);
  } catch (err: unknown) { return apiError("Failed to create task"); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id, ...updates } = await req.json();
    if (!id) return apiError("Missing id", 400);
    const parsed = taskUpdateSchema.safeParse(updates);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid data", 400);
    await updateTask(id, parsed.data);
    return apiSuccess({ ok: true });
  } catch (err: unknown) { return apiError("Failed to update task"); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return apiError("Missing id", 400);
    await deleteTask(id);
    return apiSuccess({ ok: true });
  } catch (err: unknown) { return apiError("Failed to delete task"); }
}
