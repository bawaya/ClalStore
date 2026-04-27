// =====================================================
// Admin: Price-update tool API
//   POST ?step=parse   (multipart) -> reads Excel, AI-detects columns, returns rows
//   POST ?step=match   (json)      -> matches names to existing products, classifies new ones, runs validations + batch anomaly
//   POST ?step=apply   (json)      -> updates existing / inserts new, writes price_change_log entries
//   POST ?step=revert  (json)      -> reverts a batch by batch_id
//   GET  ?action=last  -> returns metadata about the most recent (non-reverted) batch
// =====================================================

import { NextRequest, NextResponse } from "next/server";
import { revalidatePath, revalidateTag } from "next/cache";
import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";

import { requireAdmin } from "@/lib/admin/auth";
import { apiError, apiSuccess } from "@/lib/api-response";
import { createAdminSupabase } from "@/lib/supabase";
import {
  type MatchCandidate,
  type MatchStatus,
  type PriceRow,
  type PriceWarning,
  type ProductLite,
  applyPriceToVariants,
  classifyMatchStatus,
  extractStorage,
  findCandidates,
  runValidations,
} from "@/lib/admin/price-update";
import {
  type AnomalyInputRow,
  type BatchAnomaly,
  type CategoryLite,
  type DetectedColumns,
  type NewProductDraft,
  classifyNewProducts,
  detectBatchAnomalies,
  detectColumns,
  pickCategory,
  resolveAmbiguous,
} from "@/lib/admin/price-update-ai";
import { INSTALLMENTS_BY_TYPE } from "@/lib/constants";

interface ParseResponse {
  rows: PriceRow[];
  detectedColumns: DetectedColumns | null;
  totalRows: number;
}

interface MatchInput {
  rows: PriceRow[];
}

interface MatchOutputRow {
  idx: number;
  name: string;
  cash: number;
  monthly: number;
  status: MatchStatus | "will-create";
  matched?: {
    productId: string;
    productName: string;
    brand: string;
    variantsCount: number;
    oldPrice: number;
    oldMonthly: number | null;
  };
  candidates: MatchCandidate[];
  newProductDraft?: NewProductDraft & { category_id: string | null };
  warnings: PriceWarning[];
  installments: number;
}

interface MatchResponse {
  rows: MatchOutputRow[];
  anomalies: BatchAnomaly[];
}

interface ApplyInput {
  rows: Array<
    | {
        kind: "update";
        productId: string;
        cash: number;
        monthly: number;
      }
    | {
        kind: "create";
        cash: number;
        monthly: number;
        draft: NewProductDraft & { category_id?: string | null };
      }
  >;
}

interface ApplyResponse {
  batchId: string;
  updated: number;
  inserted: number;
  failed: Array<{ productId?: string; name?: string; error: string }>;
}

// =====================================================
// Helpers
// =====================================================

function toSafeNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (typeof value === "string") {
    const cleaned = value.replace(/,/g, "").replace(/[^\d.-]/g, "");
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function getInstallmentsFor(type: string | undefined | null): number {
  if (!type) return 36;
  return INSTALLMENTS_BY_TYPE[type] ?? 36;
}

async function loadAllProducts(): Promise<ProductLite[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("products")
    .select("id, name_ar, name_he, name_en, brand, model_number, price, cost, variants, type")
    .eq("active", true);
  if (error) {
    console.error("loadAllProducts error:", error.message);
    return [];
  }
  return (data || []).map((p: Record<string, unknown>) => ({
    id: String(p.id),
    name_ar: String(p.name_ar || ""),
    name_he: String(p.name_he || ""),
    name_en: (p.name_en as string | null) ?? null,
    brand: String(p.brand || ""),
    model_number: (p.model_number as string | null) ?? null,
    price: toSafeNumber(p.price),
    cost: toSafeNumber(p.cost),
    variants: Array.isArray(p.variants) ? (p.variants as ProductLite["variants"]) : [],
  }));
}

async function loadCategories(): Promise<CategoryLite[]> {
  const supabase = createAdminSupabase();
  if (!supabase) return [];
  const { data } = await supabase.from("categories").select("id, name_ar, name_he").eq("active", true);
  return (data || []).map((c: Record<string, unknown>) => ({
    id: String(c.id),
    name_ar: String(c.name_ar || ""),
    name_he: String(c.name_he || ""),
  }));
}

// =====================================================
// Step: parse
// =====================================================

async function handleParse(req: NextRequest): Promise<NextResponse> {
  const formData = await req.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) return apiError("ملف غير صالح", 400);

  const buffer = Buffer.from(await file.arrayBuffer());
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return apiError("الملف لا يحوي أوراق عمل", 400);

  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: null });
  if (matrix.length < 2) return apiError("الملف لا يحوي صفوف بيانات", 400);

  const detected = await detectColumns(matrix.slice(0, 5));
  if (!detected) {
    return apiError(
      "تعذّر اكتشاف أعمدة الاسم/السعر/القسط — تأكّد أن الصف الأول يحوي عناوين واضحة",
      400,
    );
  }

  const rows: PriceRow[] = [];
  for (let i = 1; i < matrix.length; i += 1) {
    const row = matrix[i];
    if (!row || row.length === 0) continue;
    const name = row[detected.name] != null ? String(row[detected.name]).trim() : "";
    if (!name) continue;
    const cash = toSafeNumber(row[detected.cash]);
    const monthly = toSafeNumber(row[detected.monthly]);
    if (cash <= 0 && monthly <= 0) continue;
    rows.push({ idx: rows.length, name, cash, monthly });
  }

  const body: ParseResponse = {
    rows,
    detectedColumns: detected,
    totalRows: rows.length,
  };
  return apiSuccess(body);
}

// =====================================================
// Step: match
// =====================================================

async function handleMatch(req: NextRequest): Promise<NextResponse> {
  const body = (await req.json()) as MatchInput;
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return apiError("لا يوجد صفوف للمطابقة", 400);
  }

  const products = await loadAllProducts();
  const productById = new Map(products.map((p) => [p.id, p]));
  const productTypeById = new Map<string, string>();

  // Need product type → installments lookup. Fetch separately to avoid changing ProductLite.
  const supabase = createAdminSupabase();
  if (supabase) {
    const { data } = await supabase.from("products").select("id, type").eq("active", true);
    (data || []).forEach((p: Record<string, unknown>) => {
      productTypeById.set(String(p.id), String(p.type || ""));
    });
  }

  const out: MatchOutputRow[] = [];
  const ambiguousJobs: Array<{ idxInOut: number; row: PriceRow; candidates: MatchCandidate[] }> = [];
  const newProductJobs: Array<{ idxInOut: number; name: string; row: PriceRow }> = [];

  for (const row of body.rows) {
    const candidates = findCandidates(row.name, products, 8);
    const status = classifyMatchStatus(candidates);
    const installments = candidates[0]
      ? getInstallmentsFor(productTypeById.get(candidates[0].productId))
      : 36;

    if (status === "exact" || status === "high") {
      const top = candidates[0];
      const product = productById.get(top.productId);
      const variantMonthly = product?.variants[0]?.monthly_price ?? null;
      const warnings = runValidations(row, product, installments);
      out.push({
        idx: row.idx,
        name: row.name,
        cash: row.cash,
        monthly: row.monthly,
        status,
        matched: {
          productId: top.productId,
          productName: top.productName,
          brand: top.brand,
          variantsCount: product?.variants.length ?? 0,
          oldPrice: product?.price ?? 0,
          oldMonthly: variantMonthly,
        },
        candidates,
        warnings,
        installments,
      });
    } else if (status === "ambiguous" || status === "low") {
      // Defer to AI to pick the best one
      out.push({
        idx: row.idx,
        name: row.name,
        cash: row.cash,
        monthly: row.monthly,
        status,
        candidates,
        warnings: runValidations(row, null, installments),
        installments,
      });
      ambiguousJobs.push({ idxInOut: out.length - 1, row, candidates });
    } else {
      // none → will create new product
      out.push({
        idx: row.idx,
        name: row.name,
        cash: row.cash,
        monthly: row.monthly,
        status: "will-create",
        candidates: [],
        warnings: runValidations(row, null, 36),
        installments: 36,
      });
      newProductJobs.push({ idxInOut: out.length - 1, name: row.name, row });
    }
  }

  // Resolve ambiguous via AI in parallel-friendly chunks (each call independent)
  await Promise.all(
    ambiguousJobs.map(async (job) => {
      const resolved = await resolveAmbiguous(job.row.name, job.candidates);
      const target = out[job.idxInOut];
      if (resolved && resolved.productId && resolved.confidence >= 60) {
        const product = productById.get(resolved.productId);
        if (product) {
          const installments = getInstallmentsFor(productTypeById.get(product.id));
          target.status = "high";
          target.matched = {
            productId: product.id,
            productName: product.name_ar || product.name_he || "",
            brand: product.brand,
            variantsCount: product.variants.length,
            oldPrice: product.price,
            oldMonthly: product.variants[0]?.monthly_price ?? null,
          };
          target.warnings = runValidations(job.row, product, installments);
          target.installments = installments;
          return;
        }
      }
      // AI couldn't resolve → fall through to create
      target.status = "will-create";
      newProductJobs.push({ idxInOut: job.idxInOut, name: job.row.name, row: job.row });
    }),
  );

  // Classify new products in batch
  if (newProductJobs.length > 0) {
    const drafts = await classifyNewProducts(newProductJobs.map((j) => j.name));
    const categories = await loadCategories();

    newProductJobs.forEach((job, i) => {
      const draft = drafts[i];
      if (!draft) return;
      const storageFromName = extractStorage(job.row.name);
      const draftWithCategory = {
        ...draft,
        storage_label: storageFromName || draft.storage_label || "default",
        category_id: pickCategory(draft.category_hint, categories),
      };
      const installments = getInstallmentsFor(draft.type);
      out[job.idxInOut].newProductDraft = draftWithCategory;
      out[job.idxInOut].installments = installments;
      out[job.idxInOut].warnings = runValidations(job.row, null, installments);
    });
  }

  // Run batch anomaly detection
  const anomalyInput: AnomalyInputRow[] = out.map((r) => ({
    name: r.name,
    cash: r.cash,
    monthly: r.monthly,
    oldPrice: r.matched?.oldPrice ?? null,
    matched: !!r.matched,
  }));
  const anomalies = await detectBatchAnomalies(anomalyInput).catch(() => [] as BatchAnomaly[]);

  const response: MatchResponse = { rows: out, anomalies };
  return apiSuccess(response);
}

// =====================================================
// Step: apply
// =====================================================

async function handleApply(req: NextRequest, adminId: string): Promise<NextResponse> {
  const supabase = createAdminSupabase();
  if (!supabase) return apiError("supabase غير مفعّل", 503);

  const body = (await req.json()) as ApplyInput;
  if (!Array.isArray(body.rows) || body.rows.length === 0) {
    return apiError("لا يوجد صفوف للتطبيق", 400);
  }

  const batchId = randomUUID();
  const failed: ApplyResponse["failed"] = [];
  let updated = 0;
  let inserted = 0;

  for (const item of body.rows) {
    if (item.kind === "update") {
      try {
        const { data: existing, error: readErr } = await supabase
          .from("products")
          .select("id, price, variants")
          .eq("id", item.productId)
          .single();
        if (readErr || !existing) {
          failed.push({ productId: item.productId, error: readErr?.message || "not_found" });
          continue;
        }
        const oldVariants = Array.isArray(existing.variants) ? existing.variants : [];
        const newVariants =
          oldVariants.length > 0
            ? applyPriceToVariants(oldVariants as ProductLite["variants"], item.cash, item.monthly)
            : oldVariants;
        const { error: updErr } = await supabase
          .from("products")
          .update({
            price: Math.round(item.cash),
            variants: newVariants,
            updated_at: new Date().toISOString(),
          })
          .eq("id", item.productId);
        if (updErr) {
          failed.push({ productId: item.productId, error: updErr.message });
          continue;
        }

        await supabase.from("price_change_log").insert({
          batch_id: batchId,
          product_id: item.productId,
          action: "update",
          old_price: existing.price,
          new_price: Math.round(item.cash),
          old_monthly: oldVariants[0]?.monthly_price ?? null,
          new_monthly: item.monthly > 0 ? Math.round(item.monthly) : null,
          old_variants: oldVariants,
          new_variants: newVariants,
          admin_id: adminId,
        });
        updated += 1;
      } catch (e) {
        failed.push({
          productId: item.productId,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    } else {
      try {
        const draft = item.draft;
        const storageLabel = draft.storage_label || "default";
        const newVariants = [
          {
            storage: storageLabel,
            price: Math.round(item.cash),
            monthly_price: item.monthly > 0 ? Math.round(item.monthly) : undefined,
            cost: Math.round(item.cash * 0.65),
            stock: 0,
          },
        ];

        const { data: ins, error: insErr } = await supabase
          .from("products")
          .insert({
            type: draft.type,
            brand: draft.brand,
            name_ar: draft.name_ar,
            name_he: draft.name_he,
            name_en: draft.name_en || null,
            description_ar: draft.description_ar || null,
            description_he: draft.description_he || null,
            price: Math.round(item.cash),
            cost: Math.round(item.cash * 0.65),
            stock: 0,
            sold: 0,
            image_url: null,
            gallery: [],
            colors: [],
            storage_options: [storageLabel],
            variants: newVariants,
            specs: draft.specs || {},
            category_id: draft.category_id || null,
            active: false, // start hidden — admin reviews and toggles after adding images
            featured: false,
            warranty_months: draft.warranty_months,
            model_number: null,
            variant_kind: draft.variant_kind,
            appliance_kind: draft.type === "appliance" ? draft.appliance_kind : null,
            subkind: draft.type !== "appliance" ? (draft.subkind ?? null) : null,
          })
          .select("id")
          .single();

        if (insErr || !ins) {
          failed.push({ name: draft.name_ar, error: insErr?.message || "insert_failed" });
          continue;
        }

        await supabase.from("price_change_log").insert({
          batch_id: batchId,
          product_id: ins.id,
          action: "insert",
          old_price: null,
          new_price: Math.round(item.cash),
          old_monthly: null,
          new_monthly: item.monthly > 0 ? Math.round(item.monthly) : null,
          old_variants: null,
          new_variants: newVariants,
          admin_id: adminId,
        });
        inserted += 1;
      } catch (e) {
        failed.push({
          name: item.draft?.name_ar,
          error: e instanceof Error ? e.message : "unknown",
        });
      }
    }
  }

  // Cache invalidation
  revalidateTag("products");
  revalidatePath("/store");
  revalidatePath("/api/store/featured");

  const response: ApplyResponse = { batchId, updated, inserted, failed };
  return apiSuccess(response);
}

// =====================================================
// Step: revert
// =====================================================

async function handleRevert(req: NextRequest, adminId: string): Promise<NextResponse> {
  const supabase = createAdminSupabase();
  if (!supabase) return apiError("supabase غير مفعّل", 503);

  const body = (await req.json()) as { batchId?: string };
  const batchId = body.batchId?.trim();
  if (!batchId) return apiError("batchId مطلوب", 400);

  const { data: entries, error: readErr } = await supabase
    .from("price_change_log")
    .select("id, product_id, action, old_price, old_variants, reverted_at")
    .eq("batch_id", batchId);

  if (readErr) return apiError(readErr.message, 500);
  if (!entries || entries.length === 0) return apiError("الدفعة غير موجودة", 404);

  const active = entries.filter((e: Record<string, unknown>) => !e.reverted_at);
  if (active.length === 0) return apiError("الدفعة معكوسة بالفعل", 400);

  let reverted = 0;
  const failed: Array<{ productId: string; error: string }> = [];

  for (const entry of active as Array<Record<string, unknown>>) {
    const productId = String(entry.product_id);
    try {
      if (entry.action === "insert") {
        // Undo insert by deactivating; we don't hard-delete because the row may have FKs (orders, reviews).
        const { error } = await supabase
          .from("products")
          .update({ active: false })
          .eq("id", productId);
        if (error) {
          failed.push({ productId, error: error.message });
          continue;
        }
      } else if (entry.action === "update") {
        const oldVariants = entry.old_variants as ProductLite["variants"] | null;
        const { error } = await supabase
          .from("products")
          .update({
            price: entry.old_price,
            variants: oldVariants ?? [],
            updated_at: new Date().toISOString(),
          })
          .eq("id", productId);
        if (error) {
          failed.push({ productId, error: error.message });
          continue;
        }
      }

      await supabase
        .from("price_change_log")
        .update({ reverted_at: new Date().toISOString() })
        .eq("id", entry.id);

      // Add a revert audit entry
      await supabase.from("price_change_log").insert({
        batch_id: batchId,
        product_id: productId,
        action: "revert",
        admin_id: adminId,
      });

      reverted += 1;
    } catch (e) {
      failed.push({ productId, error: e instanceof Error ? e.message : "unknown" });
    }
  }

  revalidateTag("products");
  revalidatePath("/store");

  return apiSuccess({ batchId, reverted, failed });
}

// =====================================================
// GET: last batch info
// =====================================================

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const supabase = createAdminSupabase();
  if (!supabase) return apiError("supabase غير مفعّل", 503);

  const url = new URL(req.url);
  if (url.searchParams.get("action") === "last") {
    const { data } = await supabase
      .from("price_change_log")
      .select("batch_id, action, created_at, reverted_at")
      .neq("action", "revert")
      .is("reverted_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    const row = data?.[0];
    if (!row) return apiSuccess({ batch: null });

    const { count } = await supabase
      .from("price_change_log")
      .select("id", { count: "exact", head: true })
      .eq("batch_id", row.batch_id)
      .neq("action", "revert");

    return apiSuccess({
      batch: {
        batchId: row.batch_id,
        createdAt: row.created_at,
        rowCount: count ?? 0,
      },
    });
  }

  return apiError("action غير معروف", 400);
}

// =====================================================
// POST router
// =====================================================

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;

  const url = new URL(req.url);
  const step = url.searchParams.get("step");

  try {
    if (step === "parse") return await handleParse(req);
    if (step === "match") return await handleMatch(req);
    if (step === "apply") return await handleApply(req, auth.id);
    if (step === "revert") return await handleRevert(req, auth.id);
    return apiError("step غير معروف (parse | match | apply | revert)", 400);
  } catch (error: unknown) {
    console.error("price-update error:", error);
    const message = error instanceof Error ? error.message : "خطأ غير متوقع";
    return apiError(message, 500);
  }
}
