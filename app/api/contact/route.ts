import { NextRequest, NextResponse } from "next/server";
import { notifyAdminContactForm } from "@/lib/bot/admin-notify";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(req: NextRequest) {
  try {
    const clientIp =
      req.headers.get("cf-connecting-ip") ||
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      "unknown";

    const rl = checkRateLimit(getRateLimitKey(clientIp, "contact"), { maxRequests: 3, windowMs: 300_000 });
    if (!rl.allowed) {
      return NextResponse.json(
        { success: false, error: "طلبات كثيرة — حاول بعد 5 دقائق" },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { name, phone, email, subject, message } = body;

    if (!name || !phone || !message) {
      return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 });
    }

    if (typeof name !== "string" || name.length > 100 || typeof message !== "string" || message.length > 2000) {
      return NextResponse.json({ success: false, error: "Invalid input" }, { status: 400 });
    }

    await notifyAdminContactForm({ name, phone, email, subject, message });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Contact API error:", err);
    return NextResponse.json({ success: false, error: "Failed" }, { status: 500 });
  }
}
