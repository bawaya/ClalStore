import { NextRequest, NextResponse } from "next/server";
import { getCRMUsers, updateUser, getAuditLog } from "@/lib/crm/queries";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Fetch audit log
    if (searchParams.get("audit") === "true") {
      const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;
      const data = await getAuditLog(limit);
      return NextResponse.json({ data });
    }

    // Fetch users list
    const data = await getCRMUsers();
    return NextResponse.json({ data });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const { id, ...updates } = await req.json();
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await updateUser(id, updates);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
