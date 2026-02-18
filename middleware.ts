import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_API = ["/api/webhook", "/api/health", "/api/payment/callback"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === CORS for webhooks ===
  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    if (request.method === "OPTIONS") {
      return new NextResponse(null, {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
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

  if (PUBLIC_API.some((p) => pathname.startsWith(p))) {
    response.headers.set("Access-Control-Allow-Origin", "*");
    return response;
  }

  // === Auth for protected routes ===
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
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
    url.pathname = "/crm";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/:path*", "/crm/:path*", "/login",
    "/api/admin/:path*", "/api/crm/:path*",
    "/api/webhook/:path*", "/api/health", "/api/payment/callback",
  ],
};
