import { NextRequest, NextResponse } from "next/server";
import { getPipelineDeals, createDeal, updateDeal, deleteDeal } from "@/lib/crm/queries";

export async function GET() {
  try { return NextResponse.json({ data: await getPipelineDeals() }); }
  catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function POST(req: NextRequest) {
  try { return NextResponse.json({ data: await createDeal(await req.json()) }); }
  catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function PUT(req: NextRequest) {
  try { const { id, ...u } = await req.json(); await updateDeal(id, u); return NextResponse.json({ success: true }); }
  catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}

export async function DELETE(req: NextRequest) {
  try { const id = new URL(req.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 }); await deleteDeal(id); return NextResponse.json({ success: true }); }
  catch (err: any) { return NextResponse.json({ error: err.message }, { status: 500 }); }
}
