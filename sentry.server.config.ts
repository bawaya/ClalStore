// =====================================================
// ClalMobile — Sentry server runtime (Node.js / Cloudflare Workers via OpenNext).
// Sample rates, PII scrub, and the DSN env var live in lib/sentry-helpers.ts
// so all three runtimes (server / edge / client) stay aligned.
//
// ⚠️  DO NOT RE-RUN `npx @sentry/wizard` — it will silently overwrite this
//     file with PII-leaking defaults (`sendDefaultPii: true`, full
//     `tracesSampleRate: 1`, hardcoded DSN). Privacy posture decisions
//     are pinned in `docs/testing/AGREEMENTS.md` §5.3 (Israeli Privacy
//     Protection Law Amendment 13). Edit by hand only.
// =====================================================

import * as Sentry from "@sentry/nextjs";
import { scrubEvent, sentryDsn, tracesSampleRate } from "@/lib/sentry-helpers";

Sentry.init({
  dsn: sentryDsn(),

  // Sample rate is dynamic — see lib/sentry-helpers.ts.
  tracesSampleRate: tracesSampleRate(),

  // Send our own structured logs to Sentry.
  enableLogs: true,

  // Privacy: never let the SDK enrich events with PII automatically. The
  // beforeSend hooks below scrub anything that slipped in via the request
  // object, breadcrumbs, etc. Engineers can opt into a hashed user id with
  // Sentry.setUser({ id }) at the call-site.
  sendDefaultPii: false,

  beforeSend(event) {
    return scrubEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubEvent(event);
  },
});
