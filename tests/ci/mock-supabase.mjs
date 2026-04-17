#!/usr/bin/env node
/**
 * Tiny Supabase mock server for CI E2E runs.
 *
 * Responds to Supabase REST / Auth / Storage / RPC paths with empty-but-valid
 * shapes so Server Components and API handlers render empty-state UI instead
 * of crashing on ECONNREFUSED.
 *
 * NOT a functional replacement for Supabase — only a trampoline that keeps
 * the page-render pipeline happy during E2E.
 *
 * Listens on http://127.0.0.1:54321 by default (override with PORT env).
 */

import http from "node:http";

const PORT = Number(process.env.PORT || 54321);

const server = http.createServer((req, res) => {
  const url = req.url || "/";
  const method = req.method || "GET";

  // CORS pre-flight
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "apikey, authorization, content-type, x-client-info, prefer",
  );
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  );

  if (method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  // Supabase REST — GET returns [], mutations echo {}
  if (url.startsWith("/rest/v1/")) {
    if (method === "GET") {
      res.writeHead(200);
      return res.end("[]");
    }
    res.writeHead(201);
    return res.end("[]");
  }

  // Supabase Auth
  if (url.startsWith("/auth/v1/user") || url.startsWith("/auth/v1/users")) {
    // Unauthenticated response — app should treat as "no user"
    res.writeHead(401);
    return res.end(JSON.stringify({ message: "not authenticated" }));
  }

  if (url.startsWith("/auth/v1/session") || url.startsWith("/auth/v1/token")) {
    res.writeHead(200);
    return res.end(JSON.stringify({ user: null, session: null }));
  }

  if (url.startsWith("/auth/")) {
    res.writeHead(200);
    return res.end(JSON.stringify({ ok: true }));
  }

  // Supabase Storage
  if (url.startsWith("/storage/v1/object/")) {
    res.writeHead(200);
    return res.end(JSON.stringify({ data: [], error: null }));
  }

  // Supabase Realtime / RPC
  if (url.startsWith("/realtime/") || url.startsWith("/rpc/")) {
    res.writeHead(200);
    return res.end("{}");
  }

  // Fallback — empty JSON object
  res.writeHead(200);
  res.end("{}");
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`[mock-supabase] listening on http://127.0.0.1:${PORT}`);
});

// Graceful shutdown
for (const sig of ["SIGINT", "SIGTERM"]) {
  process.on(sig, () => {
    console.log(`[mock-supabase] ${sig} received, closing`);
    server.close(() => process.exit(0));
  });
}
