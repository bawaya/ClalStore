export const runtime = 'edge';

// =====================================================
// ClalMobile — Sub Pages CRUD API
// GET: list all | POST: create | PUT: update | DELETE: remove
// Uses dedicated sub_pages table
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { z } from "zod";

const subPageSchema = z.object({
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  title_ar: z.string().min(1).max(200),
  title_he: z.string().max(200).default(""),
  content_ar: z.string().max(50000).default(""),
  content_he: z.string().max(50000).default(""),
  image_url: z.string().max(1000).nullable().optional(),
  is_visible: z.boolean().default(true),
  sort_order: z.number().int().min(0).default(0),
});

const subPageUpdateSchema = subPageSchema.partial();

export async function GET() {
  try {
    const db = createAdminSupabase();
    const { data, error } = await db
      .from("sub_pages")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return apiSuccess(data || []);
  } catch (err: unknown) {
    return apiError("Failed to load sub-pages");
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    const body = await req.json();
    const parsed = subPageSchema.safeParse(body);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid data", 400);

    const { data, error } = await db
      .from("sub_pages")
      .insert(parsed.data)
      .select()
      .single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError("Failed to create sub-page");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("id required", 400);

    const parsed = subPageUpdateSchema.safeParse(updates);
    if (!parsed.success) return apiError(parsed.error.issues[0]?.message || "Invalid data", 400);

    const payload = { ...parsed.data, updated_at: new Date().toISOString() };
    const { data, error } = await db
      .from("sub_pages")
      .update(payload)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError("Failed to update sub-page");
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return apiError("id required", 400);
    const { error } = await db
      .from("sub_pages")
      .delete()
      .eq("id", id);
    if (error) throw error;
    return apiSuccess(null);
  } catch (err: unknown) {
    return apiError("Failed to delete sub-page");
  }
}
