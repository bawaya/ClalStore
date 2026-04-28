# ClalMobile Testing Stack — Agreements

> Living decision log for the comprehensive 20-layer testing stack on ClalMobile.
> Every meaningful trade-off Mohammed and Claude Code make lives here so future
> sessions (and humans) inherit the context instead of re-litigating it.
>
> **Started:** 2026-04-28
> **Stack:** Next.js 15.5.14 (App Router) · OpenNext on Cloudflare Workers · Supabase Postgres · R2 cache.

---

## 1. Working Principles

- **Testing Trophy, not Pyramid.** Integration carries the most weight; unit
  tests guard pure logic; E2E covers the few user-visible journeys we cannot
  mock.
- **Discuss first, code later.** Anything that costs money, touches
  production, or rewires a public surface gets explicit sign-off before code
  is written.
- **Incremental delivery in 5 phases.** A phase only starts when the previous
  one is green: tests pass, CI is green, no leftover warnings, branch pushed.
- **Self-host where it's reasonable, free-tier where the SaaS is decisively
  better.** No per-seat SaaS; no credit-card-required tools.
- **Communication in Arabic Levantine; code, commits, and identifiers in
  English.** UI tests assert Arabic + RTL + `Asia/Jerusalem` and default
  locale `ar-PS`.

---

## 2. Hard Constraints

- ❌ No paid SaaS that requires a credit card during the testing build-out.
- ❌ No outbound LLM API spend during the testing build-out (OpenAI /
  Anthropic / Gemini are mocked).
- ❌ No real outbound messages: email / SMS / WhatsApp are routed through
  the outbound guard (`MOCK_OUTBOUND` + `lib/outbound-guard.ts`) and a local
  Mailpit on `127.0.0.1:1025/8025`.
- ❌ No production touch without an explicit "نعم" from Mohammed for the
  exact action.
- ❌ No PII to a third-party processor without a consent record. This is
  required by Israeli Privacy Protection Law (Amendment 13) and shapes the
  Sentry config below.

---

## 3. Approved Tooling

| Layer | Tool | Why this and not the alternative |
|---|---|---|
| Static & types | TypeScript strict + Biome + Knip + Zod | Biome is faster than ESLint+Prettier; Knip catches dead code Biome misses. |
| Unit & integration | Vitest + `@cloudflare/vitest-pool-workers` | Real Workers runtime in tests — no surprises in prod. |
| API contract | Bruno + OpenAPI + Dredd | Bruno keeps collections in Git; Postman keeps existing collections. |
| E2E + cross-browser | Playwright | Strongest open-source browser automation. |
| Visual regression | Playwright snapshots, local | Avoids paid Percy / Chromatic. |
| Accessibility | axe-core + Pa11y + Lighthouse CI | WCAG coverage. |
| Performance + load | k6 + Artillery + Lighthouse CI | k6 syntax = JS, integrates with our stack. |
| Security | OWASP ZAP + Semgrep + npm audit + Trivy + GitLeaks | Each catches a different class. |
| Multi-tenant isolation | Custom Vitest suite | No off-the-shelf RLS contract suite for Supabase. |
| Data integrity | Custom Wrangler crons | Periodic invariant checks. |
| Chaos | Toxiproxy + Chaos Toolkit | Network failure simulation. |
| Email testing | Mailpit (self-hosted) | Free Mailtrap replacement; already wired. |
| Payment | iCredit dev sandbox + recorded fixtures | Vendor-provided sandbox. |
| Error tracking | **Sentry Free Tier** + GlitchTip migration plan | See §5. |
| Uptime | Uptime Kuma (self-hosted) | Free Better Stack equivalent. |
| RUM / analytics | Plausible self-hosted + Microsoft Clarity (free) | Avoid PostHog paid tier. |
| Logs / metrics | Grafana + Loki + Prometheus (self-hosted) | Industry standard, free. |
| Compliance | Custom scripts + manual checklist | GDPR + Israeli Amendment 13. |
| Documentation | Storybook + Docusaurus + OpenAPI | Docs as code. |
| Release safety | Cloudflare gradual deployments + Flagsmith self-hosted | Feature flags. |

---

## 4. Phased Plan

| Phase | Layers | Estimated effort |
|---|---|---|
| 1 — Foundation | Static + Unit + Integration + API | 1–2 days |
| 2 — Experience | E2E + Visual + a11y + Performance | 2–3 days |
| 3 — Safety | Security + Multi-tenant + Data integrity + Chaos | 3–4 days |
| 4 — Local services | Email + Payment | 1–2 days |
| 5 — Operability | Monitoring + Compliance + Docs + Release | 3–5 days |

Total: **10–16 working days** of Claude-Code-assisted work, vs. ~3–4 months
of manual lift.

---

## 5. Decision Log

### 5.1 Error Tracking — Sentry Free Tier *(2026-04-28)*

**Choice:** Sentry SaaS Free Tier — 5K errors / month / org, plus 50 replays.

**Why:** Generous free tier; session replay quality is genuinely better than
the open-source alternatives; native Next.js SDK; PII / data-residency
levers we need (`sendDefaultPii`, `beforeSend`, EU regions if requested).

**Migration trigger:** when a single month exceeds **4 K errors** or
**40 replays**, we cut over to a self-hosted **GlitchTip** instance on the
same Hetzner box as the rest of monitoring. GlitchTip is API-compatible,
so the migration is a DSN swap and an env-var change.

### 5.2 Sentry SDK choice — `@sentry/nextjs` not `@sentry/cloudflare` *(2026-04-28)*

**Context:** ClalMobile runs on Cloudflare Workers via OpenNext. There are
two reasonable Sentry SDKs:

- `@sentry/nextjs` — official Next.js integration. Full App Router support,
  middleware integration, source-map uploads, session replay, Vercel-shaped
  defaults but works elsewhere.
- `@sentry/cloudflare` — purpose-built for Workers. Smaller bundle, designed
  around Workers' execution model, but **no first-class Next.js
  integration** (no App Router instrumentation hooks, no replay).

**Choice:** `@sentry/nextjs`. We get the App Router instrumentation and
session replay, which are the two features that justified picking Sentry in
the first place. Bundle size is acceptable for our deploys (verified with
`npx opennextjs-cloudflare` after the Sentry commit lands).

**Escape hatch — when to migrate:**

- If Worker bundle exceeds the 10 MB compressed limit.
- If `instrumentation.ts` causes "Worker exceeded CPU limit" errors at
  runtime.
- If we drop Next.js (currently no plan to).

In any of those cases, the migration plan is: keep `@sentry/cloudflare` for
server-side capture, keep `@sentry/nextjs` Replay on the client, share the
DSN, and split `lib/sentry-helpers.ts` into a `client` and `server` pair.

### 5.3 Sentry privacy posture *(2026-04-28)*

ClalMobile handles Israeli customer data: phone numbers, addresses, order
history, and payment metadata. Israeli Privacy Protection Law Amendment 13
forbids transferring PII to third-party processors without a consent
record. Therefore:

- `sendDefaultPii: false` in **all three** Sentry runtimes (server / edge /
  client). The wizard default is `true`; we override it.
- `beforeSend` and `beforeSendTransaction` hooks scrub:
  - Headers: `cookie`, `set-cookie`, `authorization`, `x-csrf-token`,
    `x-api-key`, `x-supabase-auth`.
  - Body keys: `customer_phone`, `customer_name`, `phone`, `email`,
    `password`, `card_number`, `cvv`, `cardholder`, `icredit_token`,
    `rivhit_token`, `auth_token`, `supabase_token`.
  - Free-text fields are run through phone and email regexes to catch leaks
    in error messages.
  - Cookies and query strings are wholesale-replaced with `[REDACTED]`.
  - The `user` object is reduced to `{ id }` only (engineers may attach a
    hashed user id explicitly with `Sentry.setUser({ id: hashedUserId })`).
- Session Replay uses Sentry's default text + input masking. We do not
  override the masking config.

The scrubber lives in `lib/sentry-helpers.ts` so all three runtimes share
one source of truth.

### 5.4 Sentry sample rates *(2026-04-28)*

To stay under the Free Tier ceiling and leave headroom for spike days:

| Knob | Production | Development | Override env |
|---|---|---|---|
| `tracesSampleRate` | `0.1` | `1.0` | `SENTRY_TRACES_SAMPLE_RATE` |
| `replaysSessionSampleRate` | `0.01` | `1.0` | `SENTRY_REPLAY_SESSION_SAMPLE_RATE` |
| `replaysOnErrorSampleRate` | `1.0` | `1.0` | — |

`replaysOnErrorSampleRate` stays at 100% on purpose — once an error
happens we always want the surrounding session, capped only by the much
lower session sample rate.

### 5.5 Static analysis — Knip first, Biome deferred *(2026-04-28)*

The original plan in §3 paired **Biome + Knip** as the static-analysis
duo. After installing them on the live repo we revised the order:

**Knip — adopted now.** It catches what ESLint cannot: orphan files,
unused exports, unlisted dependencies, dead binaries. The first run on
ClalMobile produced a high-signal report (26 unused files / 99 unused
exports / 5 unlisted runtime deps), all worth triaging. Knip ships as a
single dev-dependency, no formatting churn, no migration cost.
`npm run lint:dead` is the daily driver; `npm run lint:dead:strict`
exits non-zero so it can become a CI gate later.

**Biome — deferred.** The migration cost outweighs the win at this
stage:

- `prettier-plugin-tailwindcss` (the class-sorter ClalMobile depends on
  for its design system) has no Biome-native equivalent in v2. We would
  have to keep Prettier around just for that plugin, which defeats the
  "single tool" benefit.
- Mass-formatting the entire repo to match Biome's defaults touches
  thousands of lines and would dwarf the "real" cleanup commits we
  actually want history to highlight.
- Existing ESLint + Prettier setup is healthy; the speed win Biome
  offers is real but not urgent.

**Re-evaluation trigger:** when one of the following is true, we
revisit:

- `prettier-plugin-tailwindcss` ships an official Biome plugin (or
  Biome merges Tailwind class-sorting natively).
- ESLint or Prettier imposes a lint stage longer than ~30s on full repo.
- We add a second linter to fight a rule ESLint's plugins can't express.

### 5.6 Hosting the monitoring stack *(2026-04-28)*

Hetzner CX22 VPS, €4.51 / month, frankfurt region. Hosts the future
GlitchTip / Loki / Grafana / Uptime Kuma instances. Managed manually via
SSH for now; a `docker-compose` will land with Phase 5.

---

## 6. Open Questions

- [ ] **Package manager** — npm (verified from `package-lock.json`).
- [ ] **Cloudflare paid features** — does ClalMobile use the paid Workers plan?
  Affects Workers Analytics Engine availability for Phase 5 metrics.
- [ ] **iCredit sandbox credentials** — do we already have them, or do we need
  to ask the vendor?
- [ ] **CI provider** — assume GitHub Actions (free for public repos). If the
  repo is private, we have ~2,000 minutes / month free — enough for the
  current plan but no large parallel matrix.
- [ ] **Monitoring sub-domain** — do we have `monitor.clalmobile.com`
  available, or do we need a new domain?

## 7. Deferred Until Later

- Bug bounty program.
- On-call rotation.
- Annual external pen-test.
- ISO 27001 certification.
- SOC 2.

---

## 8. Change Log

| Date | Change | Reason |
|---|---|---|
| 2026-04-28 | File created | Migrated from local notes to in-repo docs. |
| 2026-04-28 | Sentry Free Tier confirmed | Best signal-to-noise for the price. |
| 2026-04-28 | Hetzner CX22 confirmed for monitoring | Cheapest realistic spec. |
| 2026-04-28 | `@sentry/nextjs` over `@sentry/cloudflare` | App Router + Replay outweigh the Workers-native SDK. |
| 2026-04-28 | `sendDefaultPii: false` + `beforeSend` scrubber | Amendment 13 compliance. |
| 2026-04-28 | Sample rates 0.1 / 0.01 in production | Stay under Free Tier; keep error replays at 100%. |
| 2026-04-28 | Knip adopted, Biome deferred | High-signal dead-code report now; Biome gates on Tailwind class-sort plugin. |

---

## 9. Related Files

- `docs/testing/EXECUTION_GUIDE.md` — step-by-step runbook for executing the
  plan with Claude Code.
- `docs/testing/QUICK_START.md` — three-step onboarding for new sessions.
- `docs/testing/TROUBLESHOOTING.md` — built up as we hit real issues.
- `lib/sentry-helpers.ts` — Sentry sample-rate + PII scrubber, shared across
  all three runtimes.
- `sentry.server.config.ts`, `sentry.edge.config.ts`,
  `instrumentation-client.ts` — runtime initialisers.
- `lib/outbound-guard.ts` — outbound message gate referenced in §2.
- `knip.json` — Knip configuration; the dead-code lint runs via
  `npm run lint:dead`.
