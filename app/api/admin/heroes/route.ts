export const runtime = 'nodejs';

import { NextRequest, NextResponse } from "next/server";
import { getAdminHeroes, createHero, updateHero, deleteHero, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { heroSchema, heroUpdateSchema, validateBody } from "@/lib/admin/validators";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const heroes = await getAdminHeroes();
    return NextResponse.json({ data: heroes });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, heroSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const data = v.data!;
    const hero = await createHero(data);
    await logAction("مدير", `إضافة بنر: ${data.title_ar}`, "hero", hero.id);
    return NextResponse.json({ data: hero });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
    const v = validateBody(updates, heroUpdateSchema);
    if (v.error) return NextResponse.json({ error: v.error }, { status: 400 });
    const hero = await updateHero(id, v.data!);
    await logAction("مدير", `تعديل بنر: ${id}`, "hero", id);
    return NextResponse.json({ data: hero });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
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
