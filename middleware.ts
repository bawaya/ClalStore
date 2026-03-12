import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, getRateLimitKey, RATE_LIMITS } from "@/lib/rate-limit";

const PUBLIC_API = ["/api/webhook", "/api/health", "/api/payment/callback", "/api/contact", "/api/auth", "/api/email", "/api/store", "/api/chat", "/api/reports"];
const WEBHOOK_ORIGINS = [
  "https://api.ycloud.com",
  "https://api.twilio.com",
];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === CORS for webhooks (restricted origins) ===
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("origin") || "";
      const allowedOrigin = WEBHOOK_ORIGINS.includes(origin) ? origin : WEBHOOK_ORIGINS[0];
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": allowedOrigin,
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, X-API-Key",
        },
      });
    }
  }

  // === Rate Limiting ===
  const clientIp = request.headers.get("cf-connecting-ip")
    || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || "unknown";

  let rlConfig = null;
  let rlPrefix = "";

  if (pathname.startsWith("/api/webhook")) {
    rlConfig = RATE_LIMITS.webhook;
    rlPrefix = "wh";
  } else if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    rlConfig = RATE_LIMITS.login;
    rlPrefix = "login";
  } else if (pathname === "/api/contact" || pathname.startsWith("/api/email")) {
    rlConfig = { maxRequests: 5, windowMs: 300_000 };
    rlPrefix = "contact";
  } else if (pathname === "/api/chat") {
    rlConfig = { maxRequests: 30, windowMs: 60_000 };
    rlPrefix = "chat";
  } else if (pathname.startsWith("/api/store/order-status")) {
    rlConfig = RATE_LIMITS.api;
    rlPrefix = "order-status";
  } else if (pathname.startsWith("/api/")) {
    rlConfig = RATE_LIMITS.api;
    rlPrefix = "api";
  }

  if (rlConfig) {
    const rl = checkRateLimit(getRateLimitKey(clientIp, rlPrefix), rlConfig);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "طلبات كثيرة — حاول بعد قليل" },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil((rl.resetAt - Date.now()) / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        }
      );
    }
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  // === Security Headers ===
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.googletagmanager.com https://connect.facebook.net https://www.google-analytics.com https://cdn.mxpnl.com https://*.mixpanel.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https: http:",
      "connect-src 'self' https://*.supabase.co https://api.ycloud.com https://api.anthropic.com https://www.google-analytics.com https://connect.facebook.net https://*.mixpanel.com https://api-js.mixpanel.com https://static.cloudflareinsights.com https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ")
  );

  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    const origin = request.headers.get("origin") || "";
    const allowedOrigin = WEBHOOK_ORIGINS.includes(origin) ? origin : "*";
    response.headers.set("Access-Control-Allow-Origin", allowedOrigin);
    return response;
  }

  // === Auth for protected routes ===
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[Middleware] Missing Supabase env vars");
    return NextResponse.json({ error: "Server configuration error" }, { status: 503 });
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          response.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          response.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  const isProtectedRoute =
    request.nextUrl.pathname.startsWith("/admin") ||
    request.nextUrl.pathname.startsWith("/crm");

  const isProtectedApi =
    request.nextUrl.pathname.startsWith("/api/admin") ||
    request.nextUrl.pathname.startsWith("/api/crm");

  const isAuthRoute = request.nextUrl.pathname.startsWith("/login");

  // API routes → return 401 JSON
  if (isProtectedApi && !user) {
    return NextResponse.json(
      { error: "غير مصرح — سجّل دخولك أولاً" },
      { status: 401 }
    );
  }

  // Page routes → redirect to login
  if (isProtectedRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("redirect", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = request.nextUrl.searchParams.get("redirect") || "/crm";
    url.searchParams.delete("redirect");
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*", "/crm/:path*", "/login",
    "/api/admin/:path*", "/api/crm/:path*",
    "/api/webhook/:path*", "/api/health", "/api/payment/callback",
    "/api/contact", "/api/auth/:path*", "/api/email/:path*", "/api/store/:path*",
    "/api/chat", "/api/reports/:path*", "/api/cron/:path*",
    "/api/push/:path*", "/api/orders", "/api/payment",
    "/api/coupons/:path*", "/api/customer/:path*",
    "/api/reviews/:path*", "/api/cart/:path*",
  ],
};
