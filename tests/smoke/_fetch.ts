/**
 * Shared fetch helper for smoke tests.
 * Wraps fetch with a timeout and uniform error reporting.
 */
export interface SmokeResult {
  url: string;
  status: number;
  ok: boolean;
  elapsedMs: number;
  body?: string;
  json?: unknown;
  error?: string;
}

export const BASE = process.env.SMOKE_TEST_URL || "https://clalmobile.com";

export async function smokeFetch(
  path: string,
  opts: { timeoutMs?: number; parseJson?: boolean; method?: string; headers?: Record<string, string>; body?: string } = {},
): Promise<SmokeResult> {
  const { timeoutMs = 10_000, parseJson = false, method = "GET", headers, body } = opts;
  const url = path.startsWith("http") ? path : `${BASE}${path}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const start = Date.now();
  try {
    const res = await fetch(url, { method, headers, body, signal: controller.signal });
    const elapsedMs = Date.now() - start;
    const text = await res.text();
    const json = parseJson ? safeParse(text) : undefined;
    return { url, status: res.status, ok: res.ok, elapsedMs, body: text, json };
  } catch (err) {
    return { url, status: 0, ok: false, elapsedMs: Date.now() - start, error: (err as Error).message };
  } finally {
    clearTimeout(timer);
  }
}

function safeParse(text: string): unknown {
  try { return JSON.parse(text); } catch { return null; }
}
