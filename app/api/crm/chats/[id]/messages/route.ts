import { NextRequest, NextResponse } from "next/server";
import { getChatMessages, closeConversation, escalateConversation } from "@/lib/crm/queries";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }
    const messages = await getChatMessages(id);
    return NextResponse.json({ data: messages });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id) {
      return NextResponse.json({ error: "Missing conversation id" }, { status: 400 });
    }
    const { action } = await req.json();
    if (action === "close") {
      await closeConversation(id);
      return NextResponse.json({ success: true });
    }
    if (action === "escalate") {
      await escalateConversation(id);
      return NextResponse.json({ success: true });
    }
    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
