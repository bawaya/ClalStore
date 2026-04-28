// =====================================================
// ClalMobile — Sentry browser runtime. Loaded automatically by Next.js
// before any client-side code runs (App Router instrumentation contract).
// Shared sample rates / PII scrubber live in lib/sentry-helpers.ts.
//
// ⚠️  DO NOT RE-RUN `npx @sentry/wizard` — it will silently overwrite this
//     file with PII-leaking defaults. See sentry.server.config.ts for the
//     full warning + AGREEMENTS.md §5.3.
// =====================================================

import * as Sentry from "@sentry/nextjs";
import {
  replaysOnErrorSampleRate,
  replaysSessionSampleRate,
  scrubEvent,
  scrubLog,
  sentryDsn,
  tracesSampleRate,
} from "@/lib/sentry-helpers";

Sentry.init({
  dsn: sentryDsn(),

  integrations: [
    // Replay only — see lib/sentry-helpers.ts for sample-rate rationale.
    Sentry.replayIntegration(),
    // Forward `console.warn` / `console.error` to Sentry Logs. Browser
    // code uses console.error in error boundaries and fetch handlers;
    // routing those to Sentry's Logs tab gives us trace-correlated
    // visibility without per-callsite changes. PII scrubbed in
    // beforeSendLog.
    Sentry.consoleLoggingIntegration({ levels: ["warn", "error"] }),
  ],

  tracesSampleRate: tracesSampleRate(),
  enableLogs: true,

  replaysSessionSampleRate: replaysSessionSampleRate(),
  replaysOnErrorSampleRate,

  // Privacy: defaultPii off, beforeSend scrubs anything stray. The replay
  // integration in @sentry/nextjs masks all text and inputs by default —
  // we keep that default and never override.
  sendDefaultPii: false,

  beforeSend(event) {
    return scrubEvent(event);
  },
  beforeSendTransaction(event) {
    return scrubEvent(event);
  },
  beforeSendLog(log) {
    return scrubLog(log);
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
