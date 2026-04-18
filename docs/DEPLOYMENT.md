# Deployment

> How ClalMobile gets from a pushed commit to serving traffic on `clalmobile.com`, plus the supporting pipelines (CI, security, observability) that run alongside.
>
> For **day-two operations** — rollback choreography, secret rotation steps, and incident-time procedures — see [`OPERATIONS.md`](./OPERATIONS.md) and [`INCIDENT-RESPONSE.md`](./INCIDENT-RESPONSE.md). This document is the reference for the deploy topology itself.

## Table of contents

- [Hosting](#hosting)
- [Build pipeline](#build-pipeline)
- [Environment variables](#environment-variables)
- [GitHub Actions workflows](#github-actions-workflows)
- [Manual deploy](#manual-deploy)
- [Rollback](#rollback)
- [Database migrations](#database-migrations)
- [Storage buckets](#storage-buckets)
- [Secret rotation](#secret-rotation)
- [Release checklist](#release-checklist)

---

## Hosting

**ClalMobile runs on Cloudflare Workers** — not Cloudflare Pages, not Vercel. Why:

- Workers gives us true edge SSR for a Next.js 15 App Router app, not a Pages-Functions hybrid
- We already use Cloudflare R2 for incremental-cache storage and for media storage
- The [OpenNext](https://opennext.js.org/) adapter produces a single Worker bundle that maps Next.js routing onto Workers, including RSC payloads, `fetch` caching, and background revalidation

The deployed Worker is called **`clalstore`**. Its configuration lives in `wrangler.json`:

```json
{
  "main": ".open-next/worker.js",
  "name": "clalstore",
  "compatibility_date": "2026-04-01",
  "compatibility_flags": ["nodejs_compat", "global_fetch_strictly_public"],
  "assets": {
    "directory": ".open-next/assets",
    "binding": "ASSETS"
  },
  "services": [{ "binding": "WORKER_SELF_REFERENCE", "service": "clalstore" }],
  "r2_buckets": [
    {
      "binding": "NEXT_INC_CACHE_R2_BUCKET",
      "bucket_name": "clalstore-opennext-cache"
    }
  ]
}
```

Key bindings:

- **`ASSETS`** — static assets served directly by the Workers runtime
- **`WORKER_SELF_REFERENCE`** — lets the Worker call itself (used by OpenNext for background revalidation)
- **`NEXT_INC_CACHE_R2_BUCKET`** — R2 bucket backing Next.js's incremental cache so cached pages survive across Worker instances

OpenNext config is minimal:

```ts
// open-next.config.ts
import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
```

The Worker runs **Node 22.19** (pinned via `.nvmrc` and `.node-version`) with `nodejs_compat` enabled.

---

## Build pipeline

Three stages — each one's output feeds the next:

```
┌─────────────┐   ┌────────────────────────┐   ┌──────────────────┐
│ next build  │ → │ opennextjs-cloudflare  │ → │ wrangler deploy  │
│ (standalone)│   │ build (Worker bundle)  │   │ (publish)        │
└─────────────┘   └────────────────────────┘   └──────────────────┘
      ↓                    ↓                            ↓
 .next/standalone/    .open-next/worker.js       clalstore Worker
                      .open-next/assets/         on Cloudflare edge
```

### Stage 1 — `next build`

Standard Next.js production build. Reads `next.config.js` (security headers, image optimization flags set to `unoptimized: true`, legacy redirects).

```bash
npm run build:next        # wraps `next build`
```

Output: `.next/standalone/` (for the server) and `.next/static/` (for the CDN).

Some server components call Supabase during prerender (e.g. `/store`). In CI we point `NEXT_PUBLIC_SUPABASE_URL` at a 100-line mock server (`tests/ci/mock-supabase.mjs`) so the build never touches real infrastructure.

### Stage 2 — OpenNext Worker bundle

```bash
npm run build:cf          # wraps `npx opennextjs-cloudflare build`
```

The adapter reads `.next/` and emits:

- `.open-next/worker.js` — the single Worker entry
- `.open-next/assets/` — static assets uploaded alongside the Worker
- `.open-next/server-functions/` — isolated RSC/API handlers

### Stage 3 — `wrangler deploy`

```bash
npx wrangler deploy       # publishes to Cloudflare
```

Uploads `worker.js` + assets, wires up R2 bindings from `wrangler.json`, and flips the route at `clalmobile.com` to the new deployment. Deploy takes under a minute.

### Full combo

The `deploy:cf` npm script chains all three:

```json
"build:cf":  "npx opennextjs-cloudflare build",
"deploy:cf": "npm run build && npm run build:cf && npx wrangler deploy"
```

For a local preview that mimics the Worker runtime:

```bash
npm run preview:cf
```

---

## Environment variables

All env var **names** are listed in `.env.example` at the repo root. That file ships in git with empty values — copy it to `.env.local` for development. **Production secrets live in Cloudflare Worker env + GitHub Actions repository secrets, never in the repo.**

Grouped by responsibility:

### Supabase

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
SUPABASE_ACCESS_TOKEN
SUPABASE_PROJECT_REF
DATABASE_URL
```

The `NEXT_PUBLIC_*` ones ship to the browser (safe; anon key is RLS-protected). `SUPABASE_SERVICE_ROLE_KEY` bypasses RLS and must **only** be read from Worker env, never imported into client code. See [`SECURITY.md`](./SECURITY.md) for the service-role boundary rules.

### Auth / URLs

```
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_SITE_URL           # legacy fallback, new code uses NEXT_PUBLIC_APP_URL
```

### AI — Anthropic / OpenAI / Gemini

```
ANTHROPIC_API_KEY
ANTHROPIC_API_KEY_ADMIN
ANTHROPIC_API_KEY_BOT
ANTHROPIC_API_KEY_STORE
OPENAI_API_KEY
OPENAI_API_KEY_ADMIN
OPENAI_API_KEY_PRICES
GEMINI_API_KEY
```

Split keys per surface so a leak in one context doesn't compromise the others and so per-surface usage is billable/observable separately.

### Payments — Rivhit / iCredit / UPay

```
ICREDIT_GROUP_PRIVATE_TOKEN
ICREDIT_TEST_MODE
RIVHIT_API_KEY
UPAY_API_KEY
UPAY_API_USERNAME
PAYMENT_WEBHOOK_SECRET
```

### WhatsApp (YCloud)

```
YCLOUD_API_KEY
WHATSAPP_PHONE_ID
WEBHOOK_SECRET
WEBHOOK_VERIFY_TOKEN
```

### SMS (Twilio)

```
TWILIO_ACCOUNT_SID
TWILIO_AUTH_TOKEN
TWILIO_FROM_NUMBER
TWILIO_MESSAGING_SERVICE_SID
TWILIO_VERIFY_SERVICE_SID
```

### Email (SendGrid + Resend)

```
SENDGRID_API_KEY
SENDGRID_FROM
RESEND_API_KEY
RESEND_FROM
```

SendGrid is the legacy path; new alerting uses Resend.

### Cloudflare R2 storage

```
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_ACCOUNT_ID
R2_BUCKET_NAME
R2_PUBLIC_URL
```

### Push notifications (VAPID)

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
```

### Image / device data

```
REMOVEBG_API_KEY
PEXELS_API_KEY
MOBILEAPI_KEY
```

### Commissions + crons + contact

```
COMMISSION_API_TOKEN
COMMISSION_ALLOWED_ORIGINS
CRON_SECRET
CONTACT_EMAIL
ADMIN_PERSONAL_PHONE
TEAM_WHATSAPP_NUMBERS
```

`CRON_SECRET` gates `/api/cron/*` endpoints — only the scheduled GitHub Actions (or a human with the secret) can invoke them.

---

## GitHub Actions workflows

`.github/workflows/` is the full deploy + observability mesh. Each file listed below with its trigger and purpose.

### `test.yml` — CI

**Trigger:** every push to non-main branches, every PR to `main`, manual dispatch.

Four jobs:

1. **Lint + TypeScript** — `tsc --noEmit` blocks on errors; ESLint warnings are non-blocking
2. **Unit + integration** — Vitest with V8 coverage, uploads `coverage/` artifact
3. **E2E** — Playwright (`chromium-desktop` project) against a locally-built Next.js server backed by `tests/ci/mock-supabase.mjs`. **No real Supabase traffic leaves the runner.**
4. **Build check** — sanity `next build` with the mock in place

### `staging.yml` — Integration with real Supabase

**Trigger:** push to `main`, manual dispatch.

Runs the `tests/staging/` suite against the real Supabase project using `TEST_`-prefixed fixtures. Catches regressions that CI's mock can't — RLS contracts, foreign-key behaviour, real-timezone issues.

### `smoke.yml` — Production smoke tests

**Trigger:** `deployment_status: success`, manual dispatch, daily cron `0 6 * * *` (06:00 UTC).

Read-only probes against `clalmobile.com`:

- `/`, `/store`, `/admin`, `/crm`, static pages
- `/api/health` (auth-gated is OK)
- `/api/settings/public`, `/api/store/smart-search`, `/api/store/autocomplete`

Runs `tests/smoke/*.test.ts` via `vitest.smoke.config.ts`. Alerts route through `tests/monitor/alert-dedup.js` on failure, with auto-recovery on the next green run.

### `monitor.yml` — Hourly health check

**Trigger:** cron `0 * * * *` (every hour on the hour), manual.

Runs `tests/monitor/check.js` — hits homepage, `/store`, `/api/health`, `/api/settings/public`, and validates the SSL certificate (warns if < 14 days remaining). Dedups via the same alert pipeline as smoke.

### `synthetic.yml` — User journey simulation

**Trigger:** cron `*/30 * * * *` (every 30 minutes), manual.

Playwright runs `tests/synthetic/user-journeys.spec.ts` against production — homepage → search → product → add-to-cart, plus public content and API sanity. Never completes a real purchase, never OTPs a real phone, never writes to admin data.

### `publish-status.yml` — Public status page

**Trigger:** cron `*/15 * * * *`, manual, `concurrency: pages`.

Runs `tests/monitor/publish-status.js` to write `status.json` + `history.json` + `index.html`, then deploys them to GitHub Pages at [`https://bawaya.github.io/ClalStore/`](https://bawaya.github.io/ClalStore/) via the native `actions/deploy-pages@v4` flow (no orphan branch).

### `codeql.yml` — Static analysis

**Trigger:** push + PR to `main`, weekly cron `0 5 * * 1` (Mon 05:00 UTC).

CodeQL `security-and-quality` on JavaScript/TypeScript. Catches SQLi, XSS, SSRF, prototype pollution, unsafe deserialization. The weekly cadence matters — it re-scans when CodeQL's rule set updates even if nothing changed.

### `security.yml` — Secret scan + dependency audit

**Trigger:** push + PR to `main`, daily cron `0 3 * * *`.

Two jobs:

1. **gitleaks** — scans the full git history for committed secrets (API keys, JWTs)
2. **npm audit** — fails on HIGH/CRITICAL, with `.github/audit-allowlist.json` for known-unfixable upstream vulns (each entry has a reason + expiry so the allowlist self-expires)

### `mutation.yml` — Stryker mutation testing

**Trigger:** manual dispatch (with optional file filter), weekly cron `0 4 * * 0` (Sun 04:00 UTC).

Runs Stryker against ~20 critical `lib/` files to score how well the unit tests actually detect bugs, not just coverage-% theatre. Budget: 45 minutes wall-clock.

### `lighthouse.yml` — Performance budgets

**Trigger:** PRs that touch `app/`, `components/`, `styles/`, `lib/`, `next.config.js`, or `lighthouserc.json`; manual dispatch.

Builds the app, spins up `next start`, runs Lighthouse CI against 5 key URLs. Accessibility ≥ 0.85 and CLS < 0.15 are hard blockers — a PR that degrades those can't merge.

### `visual-regression.yml` — Screenshot diffs

**Trigger:** PRs that touch `app/`, `components/`, `styles/`, `tailwind.config.ts`, `next.config.js`, or the visual spec file; manual dispatch with a `compare|update` mode input.

Playwright snapshots against 120 views (20 pages × 3 viewports × 2 languages). In `update` mode, regenerates baselines and commits them back via `github-actions[bot]`.

### `commission-sync.yml` — Hourly order→commission sync

**Trigger:** cron `30 * * * *` (hourly at :30, deliberately off-the-hour to avoid DST thrash), manual.

Runs `scripts/sync-commissions.ts` via `tsx`. Pulls orders from the last sync cursor, awards commissions to the right employees using the unified `registerSaleCommission` path. On failure, reuses the alert-dedup pattern directly via `github-script@v7`.

`concurrency: commission-sync` — no overlapping runs.

### `scheduled-reports.yml` — Monthly reports scheduler

**Trigger:** cron `*/5 * * * *`, manual.

Hits `POST https://clalmobile.com/api/cron/reports` with a `CRON_SECRET` bearer. The API route decides whether it's actually time to send (checks the local Asia/Jerusalem clock, the configured recipients, and the last-sent timestamp). The 5-minute cadence is a heartbeat — most invocations are no-ops.

---

## Manual deploy

The automated pipeline handles production. A manual deploy is for emergencies, cold-start after a long pause, or local verification:

```bash
# From a clean checkout on the commit you want live
npm ci --legacy-peer-deps
npm run deploy:cf
```

That runs `next build`, `opennextjs-cloudflare build`, and `wrangler deploy` in sequence. You must be authenticated to the `clalstore` Cloudflare account — `npx wrangler login` if not.

For a local preview that mimics Workers without deploying:

```bash
npm run preview:cf
```

---

## Rollback

**Preferred: revert the bad commit on `main`.**

```bash
git revert <bad-commit-sha>
git push origin main
```

CI + staging gate the revert, then Cloudflare redeploys. Forward over back.

**If revert isn't viable** (e.g. a DB migration already landed):

1. Cloudflare Dashboard → Workers & Pages → `clalstore` → Deployments
2. Pick a prior green deployment → Rollback
3. Follow up with a new forward-commit once the app is stable again

Or via CLI:

```bash
npx wrangler rollback
```

For anything involving a DB rollback, see the procedure in [`OPERATIONS.md`](./OPERATIONS.md#rolling-back) — migrations are one-way by default and require a new "revert" migration file.

---

## Database migrations

Migrations live in `supabase/migrations/` as timestamped SQL files. They're applied via the Supabase CLI:

```bash
npm run db:migrate        # → npx supabase db push
```

This pushes **every unapplied migration** to the project linked via `SUPABASE_PROJECT_REF`. Staging and production are separate projects — always verify which one you're connected to before pushing.

For seed data:

```bash
npm run db:seed           # → tsx supabase/seed/index.ts
```

`db:reset` drops + recreates the local dev DB; never run it against production.

RLS migrations have additional contract tests under `tests/staging/rls-contract.test.ts` that assert the anon role truly cannot read/write what it shouldn't. Those tests caught three real leaks — see the RLS section in [`SECURITY.md`](./SECURITY.md).

---

## Storage buckets

Two primary storage stacks:

### Supabase Storage

Product images and public assets live in Supabase Storage. Bucket names used today:

- `product-images` — public read, service-role write
- `sales-docs-private` — **private**, signed-URL access only, used for sales attachments like ID scans, contracts, invoices

To create a new bucket:

```sql
-- Via Supabase SQL editor (or a migration file)
INSERT INTO storage.buckets (id, name, public)
VALUES ('my-bucket', 'my-bucket', false);

-- Then add the access policies — see docs/SECURITY.md for the template
```

Signed-URL generation happens in `lib/storage.ts` and the `/api/pwa/sales/[id]/attachments/sign` route. Never expose a service-role key to the browser for uploads — always mint a short-lived signed URL server-side.

### Cloudflare R2

Two R2 buckets in the deploy:

- **`clalstore-opennext-cache`** — Next.js incremental cache, bound to the Worker as `NEXT_INC_CACHE_R2_BUCKET`. OpenNext manages this automatically.
- **Content R2 bucket** (name resolved via `R2_BUCKET_NAME` env) — for media that shouldn't round-trip through Supabase, accessed through S3-compatible creds (`R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY`)

Create an R2 bucket via `npx wrangler r2 bucket create <name>` then update `wrangler.json` and the `R2_BUCKET_NAME` env var.

---

## Secret rotation

**Pattern** (details + timing in [`OPERATIONS.md`](./OPERATIONS.md#rotating-secrets)):

1. Generate the new value (e.g. `openssl rand -hex 32` or the provider's rotation flow)
2. Update the value in the provider (Supabase / YCloud / Twilio / etc.)
3. Update the secret in **both** places:
   - **Cloudflare Worker env** — `npx wrangler secret put KEY_NAME`
   - **GitHub Actions repository secrets** — Settings → Secrets → Actions
4. Trigger a manual deploy to pick up the new Worker env, and a manual `test.yml` dispatch to verify CI still passes
5. Revoke the old value at the provider

Secrets that must always rotate together: `SUPABASE_SERVICE_ROLE_KEY` pair with `SUPABASE_ACCESS_TOKEN`; WhatsApp `WEBHOOK_SECRET` with `WEBHOOK_VERIFY_TOKEN`. See `OPERATIONS.md` for the per-secret rotation recipe.

---

## Release checklist

For any non-trivial change shipped to production, the author should have already:

- [ ] Covered the change with unit/integration tests (critical paths must be in the 95%+ coverage tier)
- [ ] Confirmed `test.yml` is green on the PR
- [ ] Ran `staging.yml` against the real Supabase if DB schema or RLS changed
- [ ] Updated `CHANGELOG.md` under the `[Unreleased]` heading
- [ ] Updated the relevant doc in `docs/` if the change touches deploy, ops, security, or architecture
- [ ] Bumped `package.json` version if the change is a minor/major release

Post-merge:

- [ ] `smoke.yml` green within 10 minutes of the deploy
- [ ] `monitor.yml` green on the next top-of-hour tick
- [ ] Synthetic journey run green within the next 30 minutes
- [ ] Status page at `https://bawaya.github.io/ClalStore/` shows all services `operational`
