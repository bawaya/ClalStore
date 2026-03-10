export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getPipelineDeals, createDeal, updateDeal, deleteDeal } from "@/lib/crm/queries";
import { requireAdmin } from "@/lib/admin/auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ data: await getPipelineDeals() });
  }
  catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    return NextResponse.json({ data: await createDeal(await req.json()) });
  }
  catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { id, ...u } = await req.json(); await updateDeal(id, u); return NextResponse.json({ success: true });
  }
  catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const id = new URL(req.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 }); await deleteDeal(id); return NextResponse.json({ success: true });
  }
  catch (err: any) { return NextResponse.json({ success: false, error: err.message }, { status: 500 }); }
}
