export const runtime = 'edge';

// =====================================================
// ClalMobile — Sub Pages CRUD API
// GET: list all | POST: create | PUT: update | DELETE: remove
// Uses dedicated sub_pages table
// =====================================================

import { NextRequest } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

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
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function POST(req: NextRequest) {
  try {
    const db = createAdminSupabase();
    const body = await req.json();
    const { data, error } = await db
      .from("sub_pages")
      .insert(body)
      .select()
      .single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function PUT(req: NextRequest) {
  try {
    const db = createAdminSupabase();
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("id required", 400);
    updates.updated_at = new Date().toISOString();
    const { data, error } = await db
      .from("sub_pages")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return apiSuccess(data);
  } catch (err: unknown) {
    return apiError(errMsg(err, "Unknown error"));
  }
}

export async function DELETE(req: NextRequest) {
  try {
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
    return apiError(errMsg(err, "Unknown error"));
  }
}
