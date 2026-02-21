export const runtime = "edge";

// =====================================================
// ClalMobile — Inbox Templates & Quick Replies
// GET/POST/PUT/DELETE /api/crm/inbox/templates
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";

export async function GET(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");

    let tplQuery = supabase
      .from("inbox_templates")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("usage_count", { ascending: false });

    if (category && category !== "all") {
      tplQuery = tplQuery.eq("category", category);
    }

    const { data: templates } = await tplQuery;

    const { data: quick_replies } = await supabase
      .from("inbox_quick_replies")
      .select("*")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });

    return NextResponse.json({
      success: true,
      templates: templates || [],
      quick_replies: quick_replies || [],
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const body = await req.json();
    const { name, category, content, variables, type } = body;

    if (!name || !content) {
      return NextResponse.json({ success: false, error: "الاسم والمحتوى مطلوبان" }, { status: 400 });
    }

    if (type === "quick_reply") {
      const { data, error } = await supabase
        .from("inbox_quick_replies")
        .insert({
          shortcut: body.shortcut || `/${name}`,
          title: name,
          content,
          category: category || "general",
        } as any)
        .select("*")
        .single();
      if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
      return NextResponse.json({ success: true, quick_reply: data });
    }

    const { data, error } = await supabase
      .from("inbox_templates")
      .insert({
        name,
        category: category || "general",
        content,
        variables: variables || [],
      } as any)
      .select("*")
      .single();

    if (error) return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, template: data });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const body = await req.json();
    const { id, name, category, content, variables, is_active, type } = body;
    if (!id) return NextResponse.json({ success: false, error: "ID مطلوب" }, { status: 400 });

    if (type === "quick_reply") {
      const updates: Record<string, any> = {};
      if (name !== undefined) { updates.title = name; updates.shortcut = body.shortcut || `/${name}`; }
      if (content !== undefined) updates.content = content;
      if (category !== undefined) updates.category = category;
      if (is_active !== undefined) updates.is_active = is_active;
      await supabase.from("inbox_quick_replies").update(updates).eq("id", id);
      return NextResponse.json({ success: true });
    }

    const updates: Record<string, any> = {};
    if (name !== undefined) updates.name = name;
    if (category !== undefined) updates.category = category;
    if (content !== undefined) updates.content = content;
    if (variables !== undefined) updates.variables = variables;
    if (is_active !== undefined) updates.is_active = is_active;

    await supabase.from("inbox_templates").update(updates).eq("id", id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabase = createAdminSupabase();
    if (!supabase) return NextResponse.json({ success: false, error: "DB error" }, { status: 500 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const type = searchParams.get("type");
    if (!id) return NextResponse.json({ success: false, error: "ID مطلوب" }, { status: 400 });

    if (type === "quick_reply") {
      await supabase.from("inbox_quick_replies").delete().eq("id", id);
    } else {
      await supabase.from("inbox_templates").delete().eq("id", id);
    }

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: "خطأ في السيرفر" }, { status: 500 });
  }
}
