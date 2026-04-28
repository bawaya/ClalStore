// =====================================================
// ClalMobile — Sentry edge runtime config (Next.js middleware + edge
// route handlers). Note: this is unrelated to Vercel Edge — it's the
// "edge" Webpack target that Next.js uses for middleware.ts. On
// OpenNext-Cloudflare the same code path runs inside a Worker.
//
// ⚠️  DO NOT RE-RUN `npx @sentry/wizard` — it will silently overwrite this
//     file with PII-leaking defaults. See sentry.server.config.ts for the
//     full warning + AGREEMENTS.md §5.3.
// =====================================================

import * as Sentry from "@sentry/nextjs";
import { scrubEvent, sentryDsn, tracesSampleRate } from "@/lib/sentry-helpers";

Sentry.init({
  dsn: sentryDsn(),
  tracesSampleRate: tracesSampleRate(),
  enableLogs: true,

  // Privacy — see sentry.server.config.ts for rationale.
  sendDefaultPii: false,

  beforeSend(event) {
    return scrubEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubEvent(event);
  },
});
