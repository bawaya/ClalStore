export const runtime = 'edge';

import { NextRequest, NextResponse } from "next/server";
import { getAdminHeroes, createHero, updateHero, deleteHero, logAction } from "@/lib/admin/queries";

export async function GET() {
  try {
    const heroes = await getAdminHeroes();
    return NextResponse.json({ data: heroes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const hero = await createHero(body);
    await logAction("مدير", `إضافة بنر: ${body.title_ar}`, "hero", hero.id);
    return NextResponse.json({ data: hero });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const hero = await updateHero(id, updates);
    await logAction("مدير", `تعديل بنر: ${id}`, "hero", id);
    return NextResponse.json({ data: hero });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    await deleteHero(id);
    await logAction("مدير", `حذف بنر: ${id}`, "hero", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
