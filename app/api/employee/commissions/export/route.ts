/**
 * GET /api/employee/commissions/export?month=YYYY-MM
 *
 * Generates a PDF commission statement for the authed employee for the
 * requested month. Returns the PDF as an attachment download.
 *
 * Notes on fonts:
 *   pdf-lib ships with StandardFonts.Helvetica which only supports
 *   WinAnsi (Latin-1) — it cannot render Arabic or Hebrew. Embedding a
 *   TTF font that supports RTL scripts adds ~400KB per request and
 *   Cloudflare Workers' bundle hits the 1MB free-tier limit quickly.
 *
 *   v1 compromise: all headings/labels are English; only numeric data
 *   and ISO dates appear in the PDF. Customer names with Hebrew/Arabic
 *   characters are stripped down to their ASCII portion (mostly the
 *   phone number stays intact) so we never fail to encode a glyph.
 *
 *   TODO(fonts): once we have R2 space, embed a Noto Naskh / Rubik TTF
 *   and render the Arabic/Hebrew variant directly. Tracked separately.
 */

import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import { requireEmployee } from "@/lib/pwa/auth";
import { createAdminSupabase } from "@/lib/supabase";
import { apiError, safeError } from "@/lib/api-response";
import { lastDayOfMonth } from "@/lib/commissions/ledger";
import {
  calcMonthlySummary,
  calcLoyaltyBonus,
  COMMISSION,
} from "@/lib/commissions/calculator";

/** Test whether a string contains any Arabic or Hebrew code points. */
function containsRTL(s: string): boolean {
  // Arabic: 0600-06FF, Hebrew: 0590-05FF
  return /[\u0590-\u06FF\u0750-\u077F\uFB50-\uFDFF\uFE70-\uFEFF]/.test(s);
}

/** pdf-lib has no RTL layout. For short labels/names we visually reverse
 * Arabic/Hebrew runs so they display right-to-left when drawn left-to-right. */
function rtlFriendly(s: string): string {
  if (!containsRTL(s)) return s;
  return s.split("").reverse().join("");
}

/** Legacy ASCII fallback — used only when Cairo font isn't available. */
function asciiSafe(value: string | null | undefined): string {
  if (!value) return "";
  // eslint-disable-next-line no-control-regex
  return String(value).replace(/[^\x20-\x7E]/g, "?").trim();
}

/** Try to load the Cairo TTF font bytes.
 *
 * Three strategies, in priority:
 *   1. Same-origin HTTPS fetch against `/fonts/cairo-regular.ttf` — works on
 *      Cloudflare Workers (where we serve the font from the assets binding).
 *   2. Node fs readFileSync for local dev / Vitest (gracefully handled when
 *      fs is absent — e.g. inside the CF Workers runtime `fs` throws).
 *   3. null — the caller falls back to Helvetica (English-only PDF).
 *
 * Returns a Uint8Array that pdf-lib can consume directly. Node Buffers
 * technically extend Uint8Array but pdf-lib's type check rejects them
 * under some bundlers, so we always normalise to a fresh Uint8Array.
 */
async function loadCairoFontBytes(req: NextRequest): Promise<Uint8Array | null> {
  // Strategy 1: runtime same-origin fetch (Cloudflare Workers)
  try {
    const fontUrl = new URL("/fonts/cairo-regular.ttf", req.url);
    const res = await fetch(fontUrl);
    if (res.ok) {
      const ab = await res.arrayBuffer();
      if (ab.byteLength > 0) return new Uint8Array(ab);
    }
  } catch {
    // fetch failed — try fs fallback
  }

  // Strategy 2: Node fs (local dev / Vitest). Wrap in dynamic import so it
  // doesn't blow up the Cloudflare Workers bundler.
  try {
    const fs = await import("fs");
    const path = await import("path");
    const filePath = path.join(process.cwd(), "public", "fonts", "cairo-regular.ttf");
    const buf = fs.readFileSync(filePath);
    // Re-wrap the Node Buffer into a plain Uint8Array — some pdf-lib
    // versions reject Buffer with "font must be of type string or
    // Uint8Array or ArrayBuffer" otherwise.
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

function fmtMoney(n: number): string {
  return `${n.toLocaleString("en-US", { maximumFractionDigits: 2 })} ILS`;
}

type SaleRow = {
  sale_date: string | null;
  sale_type: string;
  commission_amount: number | null;
  contract_commission: number | null;
  package_price: number | null;
  device_sale_amount: number | null;
  source: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  loyalty_start_date: string | null;
  loyalty_status: string | null;
};

type SanctionRow = {
  sanction_date: string | null;
  sanction_type: string;
  amount: number | null;
  description: string | null;
};

interface PageCtx {
  doc: PDFDocument;
  font: PDFFont;
  fontBold: PDFFont;
  /** Optional Arabic/Hebrew-capable font; if present, we draw RTL strings
   * with it. When missing, we fall back to ASCII-only via `asciiSafe`. */
  arabicFont: PDFFont | null;
  page: ReturnType<PDFDocument["addPage"]>;
  y: number;
}

function newPage(ctx: PageCtx): PageCtx {
  const page = ctx.doc.addPage([595.28, 841.89]); // A4 portrait
  return { ...ctx, page, y: 800 };
}

function ensureSpace(ctx: PageCtx, needed: number): PageCtx {
  if (ctx.y - needed < 50) return newPage(ctx);
  return ctx;
}

function drawText(
  ctx: PageCtx,
  text: string,
  opts: { x?: number; size?: number; bold?: boolean; color?: [number, number, number] } = {},
): PageCtx {
  const size = opts.size ?? 10;
  const x = opts.x ?? 50;
  const color = opts.color ?? [0, 0, 0];
  const hasRTL = containsRTL(text);
  // If the string contains RTL chars AND we loaded a proper Arabic-capable font,
  // use that font + visually-reverse the run. Otherwise, fall back to ASCII.
  const useArabic = hasRTL && ctx.arabicFont !== null;
  const body = useArabic ? rtlFriendly(text) : asciiSafe(text);
  const font = useArabic
    ? (ctx.arabicFont as PDFFont)
    : opts.bold
      ? ctx.fontBold
      : ctx.font;
  ctx.page.drawText(body, {
    x,
    y: ctx.y,
    size,
    font,
    color: rgb(color[0], color[1], color[2]),
  });
  return ctx;
}

function drawLine(ctx: PageCtx, y?: number): PageCtx {
  const lineY = y ?? ctx.y - 4;
  ctx.page.drawLine({
    start: { x: 50, y: lineY },
    end: { x: 545, y: lineY },
    thickness: 0.5,
    color: rgb(0.7, 0.7, 0.7),
  });
  return ctx;
}

export async function GET(req: NextRequest) {
  try {
    const authed = await requireEmployee(req);
    if (authed instanceof NextResponse) return authed;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const { searchParams } = new URL(req.url);
    const requested = searchParams.get("month")?.trim();
    const nowIL = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
    const defaultMonth = `${nowIL.getFullYear()}-${String(nowIL.getMonth() + 1).padStart(2, "0")}`;
    const month = requested && /^\d{4}-\d{2}$/.test(requested) ? requested : defaultMonth;
    const monthStart = `${month}-01`;
    const monthEnd = lastDayOfMonth(month);

    const [salesRes, sanctionsRes] = await Promise.all([
      db
        .from("commission_sales")
        .select(
          "sale_date, sale_type, commission_amount, contract_commission, package_price, device_sale_amount, source, customer_name, customer_phone, loyalty_start_date, loyalty_status",
        )
        .eq("employee_id", authed.appUserId)
        .is("deleted_at", null)
        .gte("sale_date", monthStart)
        .lte("sale_date", monthEnd)
        .order("sale_date", { ascending: true })
        .limit(2000),
      db
        .from("commission_sanctions")
        .select("sanction_date, sanction_type, amount, description")
        .eq("user_id", authed.appUserId)
        .is("deleted_at", null)
        .gte("sanction_date", monthStart)
        .lte("sanction_date", monthEnd)
        .order("sanction_date", { ascending: true }),
    ]);

    if (salesRes.error) return safeError(salesRes.error, "export/sales");
    if (sanctionsRes.error) return safeError(sanctionsRes.error, "export/sanctions");

    const sales = (salesRes.data || []) as SaleRow[];
    const sanctions = (sanctionsRes.data || []) as SanctionRow[];

    const loyaltyBonuses = sales
      .filter((s) => s.sale_type === "line" && s.loyalty_start_date && s.loyalty_status === "active")
      .reduce((sum, line) => sum + calcLoyaltyBonus(line.loyalty_start_date!).earnedSoFar, 0);

    const summary = calcMonthlySummary(
      sales.map((s) => ({
        sale_type: s.sale_type,
        commission_amount: Number(s.commission_amount || 0),
        source: s.source || "",
        device_sale_amount: Number(s.device_sale_amount || 0),
      })),
      sanctions.map((s) => ({ amount: Number(s.amount || 0) })),
      loyaltyBonuses,
      null,
    );

    // Contract-wide milestone reached this month (approximation: uses this
    // employee's device totals; actual contract-wide milestone is applied
    // in the ledger. For the PDF we just show how many 50K bands this
    // employee's device sales covered, as an informational summary.)
    const deviceTotal = sales
      .filter((s) => s.sale_type === "device")
      .reduce((sum, s) => sum + Number(s.device_sale_amount || 0), 0);
    const milestonesReached = Math.floor(deviceTotal / COMMISSION.DEVICE_MILESTONE);
    const milestoneBonus = milestonesReached * COMMISSION.DEVICE_MILESTONE_BONUS;

    // Build PDF
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

    // Try to load the Cairo TTF for Arabic/Hebrew text. Graceful fallback:
    // if the font file is missing (e.g. first-time deploy), we still
    // produce a usable English-only PDF.
    let arabicFont: PDFFont | null = null;
    const cairoBytes = await loadCairoFontBytes(req);
    if (cairoBytes) {
      try {
        doc.registerFontkit(fontkit);
        arabicFont = await doc.embedFont(cairoBytes, { subset: true });
      } catch (fontErr) {
        console.warn("[pdf-export] Cairo font embed failed:", fontErr);
        arabicFont = null;
      }
    } else {
      console.warn("[pdf-export] Cairo font unavailable — using Helvetica fallback");
    }

    let ctx: PageCtx = {
      doc,
      font,
      fontBold,
      arabicFont,
      page: doc.addPage([595.28, 841.89]),
      y: 800,
    };

    const genDate = new Date().toISOString().slice(0, 10);

    // Header — English + Arabic (when Cairo font loaded)
    drawText(ctx, "Commission Statement - ClalMobile", { size: 18, bold: true });
    ctx.y -= 22;
    if (ctx.arabicFont) {
      drawText(ctx, "كشف عمولات", { size: 14, x: 420 });
    }
    ctx.y -= 14;
    drawText(ctx, `Month: ${month}`, { size: 11 });
    ctx.y -= 14;
    drawText(ctx, `Employee: ${authed.name}`, { size: 11 });
    ctx.y -= 14;
    drawText(ctx, `Generated: ${genDate}`, { size: 11 });
    ctx.y -= 10;
    drawLine(ctx);
    ctx.y -= 18;

    if (!ctx.arabicFont) {
      // Only show the note when the font is unavailable
      drawText(ctx, "Arabic/Hebrew text rendered as ASCII (font not loaded).", {
        size: 9,
        color: [0.45, 0.45, 0.45],
      });
      ctx.y -= 14;
    }
    ctx.y -= 20;

    // Summary
    drawText(ctx, "Summary", { size: 14, bold: true });
    ctx.y -= 18;

    const summaryRows: Array<[string, string]> = [
      ["Lines total", fmtMoney(summary.linesCommission)],
      ["Devices total", fmtMoney(summary.devicesCommission)],
      ["Loyalty bonus", fmtMoney(summary.loyaltyBonus)],
      ["Milestone bonus", fmtMoney(milestoneBonus)],
      ["Gross", fmtMoney(summary.grossCommission)],
      ["Sanctions total", fmtMoney(-summary.totalSanctions)],
      ["NET", fmtMoney(summary.netCommission)],
    ];
    for (const [label, value] of summaryRows) {
      ctx = ensureSpace(ctx, 16);
      const isNet = label === "NET";
      drawText(ctx, label, { size: 10, bold: isNet });
      drawText(ctx, value, { x: 400, size: 10, bold: isNet });
      ctx.y -= 14;
    }

    ctx.y -= 6;
    drawLine(ctx);
    ctx.y -= 18;

    // Sales table
    ctx = ensureSpace(ctx, 40);
    drawText(ctx, `Sales (${sales.length})`, { size: 14, bold: true });
    ctx.y -= 18;

    // Header row
    ctx = ensureSpace(ctx, 20);
    drawText(ctx, "Date", { x: 50, size: 9, bold: true });
    drawText(ctx, "Type", { x: 120, size: 9, bold: true });
    drawText(ctx, "Amount", { x: 170, size: 9, bold: true });
    drawText(ctx, "Commission", { x: 250, size: 9, bold: true });
    drawText(ctx, "Source", { x: 340, size: 9, bold: true });
    drawText(ctx, "Customer", { x: 410, size: 9, bold: true });
    ctx.y -= 4;
    drawLine(ctx);
    ctx.y -= 12;

    for (const s of sales) {
      ctx = ensureSpace(ctx, 14);
      const amount = s.sale_type === "line"
        ? Number(s.package_price || 0)
        : Number(s.device_sale_amount || 0);
      const commission = Number(s.commission_amount || 0);
      const customer = asciiSafe(s.customer_name) || asciiSafe(s.customer_phone) || "-";
      drawText(ctx, (s.sale_date || "").slice(0, 10), { x: 50, size: 9 });
      drawText(ctx, s.sale_type, { x: 120, size: 9 });
      drawText(ctx, amount.toFixed(2), { x: 170, size: 9 });
      drawText(ctx, commission.toFixed(2), { x: 250, size: 9 });
      drawText(ctx, (s.source || "").slice(0, 12), { x: 340, size: 9 });
      drawText(ctx, customer.slice(0, 28), { x: 410, size: 9 });
      ctx.y -= 12;
    }

    if (sales.length === 0) {
      ctx = ensureSpace(ctx, 16);
      drawText(ctx, "No sales for this month.", { size: 10, color: [0.5, 0.5, 0.5] });
      ctx.y -= 14;
    }

    // Sanctions table
    ctx.y -= 10;
    drawLine(ctx);
    ctx.y -= 18;
    ctx = ensureSpace(ctx, 40);
    drawText(ctx, `Sanctions (${sanctions.length})`, { size: 14, bold: true });
    ctx.y -= 18;

    if (sanctions.length > 0) {
      ctx = ensureSpace(ctx, 20);
      drawText(ctx, "Date", { x: 50, size: 9, bold: true });
      drawText(ctx, "Type", { x: 120, size: 9, bold: true });
      drawText(ctx, "Amount", { x: 250, size: 9, bold: true });
      drawText(ctx, "Description", { x: 340, size: 9, bold: true });
      ctx.y -= 4;
      drawLine(ctx);
      ctx.y -= 12;
      for (const s of sanctions) {
        ctx = ensureSpace(ctx, 14);
        drawText(ctx, (s.sanction_date || "").slice(0, 10), { x: 50, size: 9 });
        drawText(ctx, (s.sanction_type || "").slice(0, 18), { x: 120, size: 9 });
        drawText(ctx, Number(s.amount || 0).toFixed(2), { x: 250, size: 9 });
        drawText(ctx, (s.description || "").slice(0, 30), { x: 340, size: 9 });
        ctx.y -= 12;
      }
    } else {
      ctx = ensureSpace(ctx, 16);
      drawText(ctx, "No sanctions for this month.", { size: 10, color: [0.5, 0.5, 0.5] });
      ctx.y -= 14;
    }

    // Milestones reached
    ctx.y -= 10;
    drawLine(ctx);
    ctx.y -= 18;
    ctx = ensureSpace(ctx, 40);
    drawText(ctx, "Milestones Reached", { size: 14, bold: true });
    ctx.y -= 18;

    if (milestonesReached > 0) {
      for (let i = 1; i <= milestonesReached; i++) {
        ctx = ensureSpace(ctx, 14);
        drawText(
          ctx,
          `Milestone ${i}: ${(i * COMMISSION.DEVICE_MILESTONE).toLocaleString("en-US")} ILS -> bonus ${COMMISSION.DEVICE_MILESTONE_BONUS} ILS`,
          { size: 10 },
        );
        ctx.y -= 14;
      }
    } else {
      ctx = ensureSpace(ctx, 16);
      drawText(ctx, "No milestones reached this month.", { size: 10, color: [0.5, 0.5, 0.5] });
      ctx.y -= 14;
    }

    // Footer
    ctx.y -= 20;
    drawLine(ctx);
    ctx.y -= 14;
    drawText(
      ctx,
      `Issued by the ClalMobile system on ${genDate}. For inquiries, please contact your manager.`,
      { size: 9, color: [0.45, 0.45, 0.45] },
    );

    const bytes = await doc.save();
    return new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="commission-${month}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    return safeError(err, "EmployeeCommissionExport", "فشل إنشاء الكشف", 500);
  }
}
