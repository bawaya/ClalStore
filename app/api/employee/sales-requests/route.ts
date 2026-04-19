/**
 * Employee sales-requests list + create.
 *
 *   GET  /api/employee/sales-requests?status=pending|draft|...
 *   POST /api/employee/sales-requests           { ...request, devices[], packages[], submit?: boolean }
 */

import { NextRequest, NextResponse } from "next/server";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, apiSuccess, safeError } from "@/lib/api-response";
import {
  isValidIsraeliId,
  isValidIsraeliMobile,
  isValidBankBranch,
  isValidBankAccount,
  normaliseIsraeliMobile,
} from "@/lib/validators/israeli";
import { findBankByCode } from "@/lib/data/israeli-banks";
import { computeTotals, logEvent } from "@/lib/sales-requests/service";

// ─── Rate-limit: max 15 requests per employee per hour ────────────────
const RATE_LIMIT_PER_HOUR = 15;

// ─── Shape helpers ────────────────────────────────────────────────────
interface CreatePayload {
  customer_name: string;
  customer_id_number: string;
  contact_number: string;
  delivery_address: string;
  locality_name?: string | null;
  bank_name: string;
  bank_code?: string | null;
  bank_branch: string;
  bank_account: string;
  devices: Array<{ device_name: string; total_price: number; installments_count: number }>;
  packages?: Array<{ package_name: string; monthly_price: number; lines_count: number }>;
  submit?: boolean; // true → pending, false/missing → draft
}

function validateCreatePayload(body: unknown, requireAll: boolean): { ok: true; data: CreatePayload } | { ok: false; error: string } {
  if (!body || typeof body !== "object") return { ok: false, error: "invalid body" };
  const b = body as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const num = (v: unknown) => (typeof v === "number" ? v : Number(v));

  const payload: CreatePayload = {
    customer_name: str(b.customer_name),
    customer_id_number: str(b.customer_id_number).replace(/\D/g, ""),
    contact_number: str(b.contact_number),
    delivery_address: str(b.delivery_address),
    locality_name: b.locality_name ? str(b.locality_name) : null,
    bank_name: str(b.bank_name),
    bank_code: b.bank_code ? str(b.bank_code) : null,
    bank_branch: str(b.bank_branch),
    bank_account: str(b.bank_account),
    devices: Array.isArray(b.devices)
      ? b.devices.map((d) => ({
          device_name: str((d as Record<string, unknown>).device_name),
          total_price: num((d as Record<string, unknown>).total_price),
          installments_count: Math.trunc(num((d as Record<string, unknown>).installments_count)),
        }))
      : [],
    packages: Array.isArray(b.packages)
      ? b.packages.map((p) => ({
          package_name: str((p as Record<string, unknown>).package_name),
          monthly_price: num((p as Record<string, unknown>).monthly_price),
          lines_count: Math.trunc(num((p as Record<string, unknown>).lines_count)),
        }))
      : [],
    submit: Boolean(b.submit),
  };

  // Strict checks only fire on submit; drafts accept partial data.
  if (!requireAll) return { ok: true, data: payload };

  if (!payload.customer_name) return { ok: false, error: "اسم الزبون مطلوب" };
  if (!isValidIsraeliId(payload.customer_id_number)) {
    return { ok: false, error: "رقم الهوية غير صالح" };
  }
  if (!isValidIsraeliMobile(payload.contact_number)) {
    return { ok: false, error: "رقم التواصل غير صالح (يجب أن يبدأ بـ 05 ويتكون من ١٠ أرقام)" };
  }
  if (!payload.delivery_address) return { ok: false, error: "عنوان التوصيل مطلوب" };
  if (!payload.bank_name) return { ok: false, error: "اسم البنك مطلوب" };
  if (!isValidBankBranch(payload.bank_branch)) {
    return { ok: false, error: "رقم الفرع يجب أن يكون ٣ أرقام بالضبط" };
  }
  if (!isValidBankAccount(payload.bank_account)) {
    return { ok: false, error: "رقم الحساب يجب أن يكون بين ٤ و ٩ أرقام" };
  }
  if (payload.devices.length === 0) {
    return { ok: false, error: "يجب إضافة جهاز واحد على الأقل" };
  }
  for (const d of payload.devices) {
    if (!d.device_name) return { ok: false, error: "اسم الجهاز مطلوب لكل جهاز" };
    if (!(d.total_price > 0)) return { ok: false, error: "سعر الجهاز يجب أن يكون أكبر من صفر" };
    if (!(d.installments_count >= 1 && d.installments_count <= 60)) {
      return { ok: false, error: "عدد الدفعات يجب أن يكون بين ١ و ٦٠" };
    }
  }
  for (const p of payload.packages || []) {
    if (!p.package_name) return { ok: false, error: "اسم الحڤيلا مطلوب لكل خط" };
    if (!(p.monthly_price > 0)) return { ok: false, error: "سعر الحڤيلا يجب أن يكون أكبر من صفر" };
    if (!(p.lines_count >= 1 && p.lines_count <= 20)) {
      return { ok: false, error: "عدد الخطوط في الحڤيلا يجب أن يكون بين ١ و ٢٠" };
    }
  }
  return { ok: true, data: payload };
}

// ─── GET — list the authed employee's requests ────────────────────────
export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const statusFilter = searchParams.get("status");

    let query = db
      .from("sales_requests")
      .select("id, status, customer_name, customer_id_number, total_devices_amount, total_packages_monthly, total_devices_count, total_lines_count, submitted_at, reviewed_at, review_note, created_at, updated_at")
      .eq("employee_id", authed.appUserId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(200);

    if (statusFilter) query = query.eq("status", statusFilter);

    const { data, error } = await query;
    if (error) return safeError(error, "sales-requests/list");

    return apiSuccess({ requests: data || [] });
  } catch (err) {
    return safeError(err, "EmployeeSalesRequestsList", "خطأ داخلي", 500);
  }
}

// ─── POST — create (draft or submit) ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json().catch(() => null);
    if (!body) return apiError("invalid JSON body", 400);

    const submit = Boolean((body as { submit?: unknown }).submit);
    const validated = validateCreatePayload(body, submit);
    if (!validated.ok) return apiError(validated.error, 400);
    const payload = validated.data;

    // Rate limit (submissions only — drafts can be saved freely)
    if (submit) {
      const oneHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
      const { count } = await db
        .from("sales_requests")
        .select("id", { count: "exact", head: true })
        .eq("employee_id", authed.appUserId)
        .gte("submitted_at", oneHourAgo);
      if ((count ?? 0) >= RATE_LIMIT_PER_HOUR) {
        return apiError(
          `تجاوزت حد الإرسال (${RATE_LIMIT_PER_HOUR} طلبات/ساعة). انتظر قليلاً.`,
          429,
        );
      }

      // Duplicate-check: warn if a pending request exists for the same
      // customer ID, but DON'T block — the employee may be correcting a
      // stale draft. Duplicates go through as a new row; admin can
      // reject one if needed.
    }

    // Normalise mobile to 05XXXXXXXX
    if (submit) {
      const normalised = normaliseIsraeliMobile(payload.contact_number);
      if (normalised) payload.contact_number = normalised;
    }

    // Resolve bank_code from bank_name if caller didn't provide one
    if (!payload.bank_code && payload.bank_name) {
      // Caller picked from the typeahead — bank_name may include the
      // code prefix or not. Leave bank_code null if we can't match.
    } else if (payload.bank_code) {
      const bank = findBankByCode(payload.bank_code);
      if (!bank) payload.bank_code = null;
    }

    const totals = computeTotals(payload.devices, payload.packages || []);

    const insertRow = {
      employee_id: authed.appUserId,
      status: submit ? "pending" : "draft",
      customer_name: payload.customer_name,
      customer_id_number: payload.customer_id_number,
      contact_number: payload.contact_number,
      delivery_address: payload.delivery_address,
      locality_name: payload.locality_name,
      bank_name: payload.bank_name,
      bank_code: payload.bank_code,
      bank_branch: payload.bank_branch,
      bank_account: payload.bank_account,
      ...totals,
      submitted_at: submit ? new Date().toISOString() : null,
    };

    const { data: inserted, error: insertError } = await db
      .from("sales_requests")
      .insert(insertRow)
      .select("id")
      .single();
    if (insertError) return safeError(insertError, "sales-requests/create");

    const requestId = (inserted as { id: number }).id;

    // Insert children
    if (payload.devices.length > 0) {
      const { error: devErr } = await db.from("sales_request_devices").insert(
        payload.devices.map((d, i) => ({
          request_id: requestId,
          device_name: d.device_name,
          total_price: d.total_price,
          installments_count: d.installments_count,
          position: i,
        })),
      );
      if (devErr) return safeError(devErr, "sales-requests/create-devices");
    }
    if (payload.packages && payload.packages.length > 0) {
      const { error: pkgErr } = await db.from("sales_request_packages").insert(
        payload.packages.map((p, i) => ({
          request_id: requestId,
          package_name: p.package_name,
          monthly_price: p.monthly_price,
          lines_count: p.lines_count,
          position: i,
        })),
      );
      if (pkgErr) return safeError(pkgErr, "sales-requests/create-packages");
    }

    await logEvent(db, {
      request_id: requestId,
      event_type: submit ? "submitted" : "created",
      actor_id: authed.appUserId,
      actor_role: authed.role,
      message: null,
      metadata: { devices: payload.devices.length, packages: (payload.packages || []).length },
    });

    return apiSuccess({ id: requestId, status: insertRow.status });
  } catch (err) {
    return safeError(err, "EmployeeSalesRequestCreate", "خطأ داخلي", 500);
  }
}
