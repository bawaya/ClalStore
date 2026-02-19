export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getCRMChats, getChatStats } from "@/lib/crm/queries";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);

    // Fetch stats
    if (searchParams.get("stats") === "true") {
      const stats = await getChatStats();
      return NextResponse.json(stats);
    }

    // Fetch conversations list (with last_message, customer join, total count)
    const filters = {
      channel: searchParams.get("channel") || undefined,
      status: searchParams.get("status") || undefined,
      search: searchParams.get("search") || undefined,
      limit: searchParams.get("limit") ? Number(searchParams.get("limit")) : 50,
      offset: searchParams.get("offset") ? Number(searchParams.get("offset")) : 0,
    };
    const result = await getCRMChats(filters);
    return NextResponse.json({ conversations: result.data, total: result.total });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
