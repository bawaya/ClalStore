export const runtime = "edge";

import { NextResponse } from "next/server";
import { generateCsrfToken, setCsrfCookie } from "@/lib/csrf";
import { apiSuccess } from "@/lib/api-response";

// GET /api/csrf — Returns a fresh CSRF token and sets it as a cookie
export async function GET() {
  const token = generateCsrfToken();
  const response = apiSuccess({ token });
  setCsrfCookie(response as NextResponse, token);
  return response;
}
