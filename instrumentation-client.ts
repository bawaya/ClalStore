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
  sentryDsn,
  tracesSampleRate,
} from "@/lib/sentry-helpers";

Sentry.init({
  dsn: sentryDsn(),

  // Replay only — see lib/sentry-helpers.ts for sample-rate rationale.
  integrations: [Sentry.replayIntegration()],

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
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
