export const runtime = 'edge';

import { NextResponse } from "next/server";
import { getCRMDashboard } from "@/lib/crm/queries";

export async function GET() {
  try {
    const data = await getCRMDashboard();
    return NextResponse.json(data);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
