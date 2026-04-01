
// =====================================================
// ClalMobile — Admin Products API
// GET: list all | POST: create | PUT: update | DELETE
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { getAdminProducts, createProduct, updateProduct, deleteProduct, logAction } from "@/lib/admin/queries";
import { requireAdmin } from "@/lib/admin/auth";
import { productSchema, productUpdateSchema, validateBody } from "@/lib/admin/validators";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import type { Product, ProductVariant } from "@/types/database";

type ProductPayload = Partial<Omit<Product, "id" | "created_at" | "updated_at">>;

function parseStorageRank(storage: string): number {
  const s = String(storage || "").toUpperCase().replace(/\s/g, "");
  const m = s.match(/(\d+)(GB|TB)/);
  if (!m) return Number.MAX_SAFE_INTEGER;
  const value = Number(m[1]);
  return m[2] === "TB" ? value * 1024 : value;
}

function normalizePricingPayload(input: ProductPayload): ProductPayload {
  const data: ProductPayload = { ...input };
  const rawVariants = Array.isArray(data.variants) ? data.variants : null;

  if (rawVariants) {
    const normalized: ProductVariant[] = rawVariants
      .map((v) => {
        const storage = String(v?.storage || "").trim();
        if (!storage) return null;
        const price = Math.max(0, Number(v?.price || 0));
        const oldRaw = v?.old_price == null ? undefined : Math.max(0, Number(v.old_price));
        const oldPrice =
          oldRaw == null
            ? undefined
            : oldRaw < price
              ? price
              : oldRaw === price
                ? undefined
                : oldRaw;

        return {
          ...v,
          storage,
          price,
          old_price: oldPrice,
        } as ProductVariant;
      })
      .filter((v): v is ProductVariant => v !== null);

    normalized.sort((a, b) => parseStorageRank(a.storage) - parseStorageRank(b.storage));
    data.variants = normalized;
    data.storage_options = [...new Set(normalized.map((v) => v.storage))];

    const prices = normalized.map((v) => v.price).filter((p) => p > 0);
    if (prices.length > 0) data.price = Math.min(...prices);
  }

  if (data.price != null) data.price = Math.max(0, Number(data.price));
  if (data.old_price != null) {
    const old = Math.max(0, Number(data.old_price));
    data.old_price = old > (data.price ?? 0) ? old : undefined;
  }

  return data;
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const { searchParams } = new URL(req.url);
    const limit = Math.min(Math.max(0, Number(searchParams.get("limit")) || 0), 200);
    const offset = Math.max(0, Number(searchParams.get("offset")) || 0);

    const { data: products, total } = await getAdminProducts(limit > 0 ? { limit, offset } : undefined);
    return apiSuccess(
      products,
      limit > 0 ? { limit, offset, total, totalPages: Math.ceil(total / limit) } : undefined,
    );
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const v = validateBody(body, productSchema);
    if (v.error) return apiError(v.error, 400);
    const data = normalizePricingPayload(v.data!);
    const product = await createProduct(data as Omit<Product, "id" | "created_at" | "updated_at">);
    await logAction("مدير", `إضافة منتج: ${data.name_ar}`, "product", product.id);
    return apiSuccess(product);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const body = await req.json();
    const { id, ...updates } = body;
    if (!id) return apiError("Missing id", 400);
    const v = validateBody(updates, productUpdateSchema);
    if (v.error) return apiError(v.error, 400);
    const data = normalizePricingPayload(v.data!);
    const product = await updateProduct(id, data as Partial<Omit<Product, "id">>);
    await logAction("مدير", `تعديل منتج: ${data.name_ar || id}`, "product", id);
    return apiSuccess(product);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const ids = searchParams.get("ids");

    if (ids) {
      const idList = ids.split(",").map((s) => s.trim()).filter(Boolean);
      if (idList.length === 0) return apiError("No IDs provided", 400);
      if (idList.length > 50) return apiError("Max 50 items per batch", 400);
      let deleted = 0;
      for (const pid of idList) {
        try {
          await deleteProduct(pid);
          deleted++;
        } catch (e) {
          console.error(`Failed to delete product ${pid}:`, e);
        }
      }
      await logAction("مدير", `حذف جماعي: ${deleted} منتج`, "product", idList[0]);
      return apiSuccess({ deleted });
    }

    if (!id) return apiError("Missing id", 400);
    await deleteProduct(id);
    await logAction("مدير", `حذف منتج: ${id}`, "product", id);
    return apiSuccess(null);
  } catch (err: unknown) {
    return apiError(errMsg(err), 500);
  }
}
