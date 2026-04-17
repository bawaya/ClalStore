/* eslint-disable @typescript-eslint/no-explicit-any */
import { vi } from "vitest";

/**
 * Lightweight NextRequest stand-in for unit / integration tests.
 * Works in jsdom (no need for the real Next.js server).
 */
export interface MockRequestOptions {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  searchParams?: Record<string, string>;
  cookies?: Record<string, string>;
  url?: string;
  ip?: string;
}

export function createMockRequest(opts: MockRequestOptions = {}): any {
  const {
    method = "GET",
    body,
    headers = {},
    searchParams = {},
    cookies = {},
    url: rawUrl,
    ip = "127.0.0.1",
  } = opts;

  // build URL
  const base = "http://localhost:3000";
  const pathname = rawUrl?.startsWith("/") ? rawUrl : rawUrl ?? "/api/test";
  const urlObj = new URL(pathname, base);
  for (const [k, v] of Object.entries(searchParams)) {
    urlObj.searchParams.set(k, v);
  }

  // headers map
  const headerMap = new Map<string, string>();
  for (const [k, v] of Object.entries(headers)) {
    headerMap.set(k.toLowerCase(), v);
  }
  if (body && !headerMap.has("content-type")) {
    headerMap.set("content-type", "application/json");
  }

  // cookie string
  const cookieString = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  if (cookieString) headerMap.set("cookie", cookieString);

  // cookies object (NextRequest-style)
  const cookiesObj = {
    get: vi.fn((name: string) => {
      const val = cookies[name];
      return val !== undefined ? { name, value: val } : undefined;
    }),
    getAll: vi.fn(() => Object.entries(cookies).map(([name, value]) => ({ name, value }))),
    has: vi.fn((name: string) => name in cookies),
    set: vi.fn(),
    delete: vi.fn(),
  };

  const request: any = {
    method,
    url: urlObj.toString(),
    nextUrl: urlObj,
    headers: {
      get: vi.fn((name: string) => headerMap.get(name.toLowerCase()) ?? null),
      has: vi.fn((name: string) => headerMap.has(name.toLowerCase())),
      forEach: vi.fn((cb: (v: string, k: string) => void) => headerMap.forEach(cb)),
      entries: vi.fn(() => headerMap.entries()),
      set: vi.fn((k: string, v: string) => headerMap.set(k.toLowerCase(), v)),
      delete: vi.fn((k: string) => headerMap.delete(k.toLowerCase())),
    },
    cookies: cookiesObj,
    json: vi.fn().mockResolvedValue(body ?? {}),
    text: vi.fn().mockResolvedValue(typeof body === "string" ? body : JSON.stringify(body ?? {})),
    formData: vi.fn().mockResolvedValue(new FormData()),
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
    ip,
    geo: { city: "Test", country: "IL" },
  };

  return request;
}

/**
 * Build params object for dynamic-route API handlers.
 * E.g. createRouteParams({ id: "abc" }) → { params: { id: "abc" } }
 */
export function createRouteParams(params: Record<string, string>) {
  return { params };
}
