
import { NextRequest, NextResponse } from "next/server";
import { getChatMessages, closeConversation, escalateConversation } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    if (!id) {
      return apiError("Missing conversation id", 400);
    }
    const messages = await getChatMessages(id);
    return apiSuccess(messages);
  } catch (err: unknown) {
    console.error("Chat messages GET error:", err);
    return apiError("فشل في جلب الرسائل", 500);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id } = await params;
    if (!id) {
      return apiError("Missing conversation id", 400);
    }
    const { action } = await req.json();
    if (action === "close") {
      await closeConversation(id);
      return apiSuccess({ ok: true });
    }
    if (action === "escalate") {
      await escalateConversation(id);
      return apiSuccess({ ok: true });
    }
    return apiError("Unknown action", 400);
  } catch (err: unknown) {
    console.error("Chat messages PUT error:", err);
    return apiError("فشل في تحديث المحادثة", 500);
  }
}
