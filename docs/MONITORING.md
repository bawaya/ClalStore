# Monitoring

> How we know — within minutes — that production is healthy, degraded, or down, and how we make sure an outage generates one useful alert instead of forty duplicate ones.

## Table of contents

- [Monitoring layers](#monitoring-layers)
- [Health endpoint](#health-endpoint)
- [Hourly monitor](#hourly-monitor)
- [Daily smoke tests](#daily-smoke-tests)
- [Synthetic user journeys](#synthetic-user-journeys)
- [Real User Monitoring (RUM)](#real-user-monitoring-rum)
- [Lighthouse performance checks](#lighthouse-performance-checks)
- [Status page](#status-page)
- [Alert channels](#alert-channels)
- [Alert dedup and auto-recovery](#alert-dedup-and-auto-recovery)
- [Runbook pointer](#runbook-pointer)

---

## Monitoring layers

Six layers, each one answering a slightly different question. Shallow + fast on one end, deep + expensive on the other.

| # | Layer | Cadence | Answers |
|---|-------|---------|---------|
| 1 | Health endpoint `/api/health` | on demand | "Can the app serve an internal self-check right now?" |
| 2 | Hourly monitor workflow | every 60 min | "Are the key endpoints + SSL cert healthy?" |
| 3 | Daily smoke tests | 06:00 UTC + post-deploy | "Do all public read-only paths still return 200?" |
| 4 | Synthetic user journeys | every 30 min | "Can a simulated customer actually use the store?" |
| 5 | Real User Monitoring | continuous | "How are real browsers experiencing the site?" (see [`RUM-SETUP.md`](./RUM-SETUP.md)) |
| 6 | Lighthouse CI | on PR + nightly | "Did this change break the performance budget?" |

They stack — a single regression often shows up in two or more. Monitor catches a 500, synthetic confirms the flow broke, RUM quantifies the blast radius.

---

## Health endpoint

`GET /api/health` returns a structured JSON payload:

```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": { "db": "ok", "storage": "ok", "ai": "ok" }
  }
}
```

- **Status values** — `"healthy"`, `"degraded"`, `"down"`
- **Auth** — optional token gate. If the endpoint returns `401`, the monitor treats that as intentional (token-gated) and considers it a pass. Alerts only fire on 5xx, timeouts, or unexpected bodies.
- **Dependencies probed** — Supabase connectivity, R2 storage, optionally AI providers

This is the cheapest check we have. It runs whenever another monitor hits the app.

---

## Hourly monitor

`.github/workflows/monitor.yml` runs `tests/monitor/check.js` on a `0 * * * *` cron.

### What it checks

In a single run, in parallel:

| Check | Target | Pass criteria |
|-------|--------|---------------|
| Homepage | `GET /` | 2xx/3xx within 5s |
| Public settings | `GET /api/settings/public` | 2xx/3xx within 5s |
| Store listing | `GET /store` | 2xx/3xx within 5s |
| API health | `GET /api/health` | 200 with `status` in `healthy`/`degraded`, or 401 (gated) |
| SSL cert | TLS handshake to the host | > 14 days until expiry |

### Alert thresholds

- **Response time** — fail if > **5000ms** on any endpoint
- **HTTP status** — fail if < 200 or ≥ 400 (except `/api/health` which tolerates 401)
- **SSL** — warn + fail if < **14 days** until expiry, fail if expired
- **Timeout** — each fetch is aborted after 15 seconds

### Exit contract

`check.js` exits `0` on all green, `1` if **any** check failed. A non-zero exit triggers the workflow's `Deduped alert on failure` step, which calls `tests/monitor/alert-dedup.js`.

On the next green run, the `Auto-recover on success` step calls `alert-dedup.js --recover` to close the active alert issue and notify recovery.

---

## Daily smoke tests

`.github/workflows/smoke.yml` runs `tests/smoke/*.test.ts` via `vitest.smoke.config.ts` daily at 06:00 UTC, and on every successful deployment (`deployment_status: success` trigger).

### What's covered

Prod read-only paths only — **no writes** that would pollute real data. Grouped across three test files:

**`health.test.ts`** — page/API sanity:
- `GET /` — returns 200 with a body > 500 bytes
- `GET /api/health` — 200 (or 401 gated) with the right envelope
- `GET /store` — 200
- `GET /admin`, `/crm` — 200 or redirect to auth
- `GET /api/settings/public` — 200 JSON
- `GET /robots.txt` — 200 matching `/User-agent/i`
- `GET /sitemap.xml` — 200 matching `<urlset` or `<sitemap`

**`store.test.ts`** — every public store path + read-only APIs:
- `/store`, `/store/cart`, `/store/compare`, `/store/wishlist`, `/store/track`
- `GET /api/store/smart-search?q=iphone`
- `GET /api/store/autocomplete?q=ip`
- `GET /api/reviews/featured`
- `/about`, `/contact`, `/faq`, `/deals`, `/legal`, `/privacy`

**`performance.test.ts`** and **`ssl-headers.test.ts`** — response-time SLOs + security header enforcement (X-Frame-Options, X-Content-Type-Options, Referrer-Policy, etc.).

### Why "no writes"

Smoke runs against the **real production database**. If a smoke test ever submitted a checkout form or created an order, it would pollute real sales data and confuse the commission pipeline. The hard rule: smoke tests `GET`-only. Anything that needs to exercise a POST flow belongs in synthetic journeys or staging.

---

## Synthetic user journeys

`.github/workflows/synthetic.yml` runs `tests/synthetic/user-journeys.spec.ts` via Playwright every 30 minutes against `https://clalmobile.com`.

### Why this exists on top of smoke

A 200 status from `GET /store` doesn't prove the store actually works — the React tree could have an error, a button could be non-clickable, the cart could silently drop items. Synthetic tests drive a headless browser through the same clicks a customer would make.

### Covered journeys

17 tests grouped into suites:

- **Shopping journey (guest)** — homepage → store → first product → add-to-cart flow (never clicks "Pay"). Also exercises `/store/checkout/success` and `/store/checkout/failed` for render sanity, and the `/store/track` tracking input.
- **Public content** — `/about`, `/contact`, `/faq`, `/deals`, `/legal`, `/privacy` all render > 500 bytes of HTML
- **Core API endpoints** — `/api/settings/public` returns valid JSON, `/api/store/smart-search` returns a searchable result shape
- **Language flip** — tests that the Arabic ↔ Hebrew switch actually re-renders content

### Safety rules

The synthetic spec is explicit about what it will **never** do:

- Never complete a real purchase — no payment gateway submission
- Never OTP a real phone number — only the `PROD_TEST_CUSTOMER_PHONE` test account
- Never modify admin data — no CRUD from the admin dashboard

If you add a new synthetic test, read that block at the top of `user-journeys.spec.ts` before you think about a POST.

### Alert path

Failure uploads the Playwright HTML report as a workflow artifact (30-day retention) and calls `alert-dedup.js` with `ALERT_SOURCE=synthetic`. A subsequent green run closes the issue.

---

## Real User Monitoring (RUM)

Real User Monitoring complements synthetic checks — synthetic tells us "a scripted browser can do the flow", RUM tells us "what percentile of real users got timeout errors in Tel Aviv at 3pm yesterday".

ClalMobile's RUM setup — provider choices (Cloudflare Web Analytics + Sentry), paths for sampling, rollout phases — is documented separately in [`RUM-SETUP.md`](./RUM-SETUP.md). Key points:

- **Web vitals** (LCP, CLS, INP, TTFB, FCP) sampled client-side
- **Error tracking** via Sentry for uncaught exceptions, failed fetches, and React error boundaries
- **Session replay** gated on opt-in — we don't record sessions by default

RUM is the single best signal when a synthetic test passes but users complain. If error rate spikes in RUM but synthetic is green, it's probably a regional network / CDN / ISP issue.

---

## Lighthouse performance checks

`.github/workflows/lighthouse.yml` runs Lighthouse CI on every PR that touches `app/`, `components/`, `styles/`, `lib/`, `next.config.js`, or `lighthouserc.json`.

Budget enforcement from `lighthouserc.json` — **hard blockers**:

- **Accessibility** ≥ 0.85
- **CLS** (cumulative layout shift) < 0.15

Soft budgets for FCP, LCP, TBT, Total Byte Weight — those warn but don't fail the build. A PR that degrades the hard blockers cannot merge without explicit review sign-off.

For deeper perf debugging, the uploaded `lighthouse-report` artifact (14-day retention) contains the full JSON trace.

---

## Status page

A public status dashboard lives at:

**[`https://bawaya.github.io/ClalStore/`](https://bawaya.github.io/ClalStore/)**

Served from GitHub Pages, updated every 15 minutes by `.github/workflows/publish-status.yml`.

### What the page shows

- **Overall status pill** — `OPERATIONAL`, `DEGRADED`, or `DOWN`
- **Service table** — one row per monitored service (homepage, `/store`, `/api/health`, `/api/settings/public`, SSL cert), with current status and response time in ms
- **7-day sparkline** — last 168 samples (15-min buckets × 7 days), color-coded per status
- **Last check timestamp** + sample count

### How it's generated

1. `tests/monitor/publish-status.js` probes the same endpoints as `monitor.yml` + checks SSL
2. Writes `_site/status.json` (current snapshot) and appends to `_site/history.json` (ring buffer of 168 entries)
3. `publish-status.yml` fetches the previous `history.json` from the live page, runs the snapshot, writes the HTML, and deploys via `actions/deploy-pages@v4`

### Why GitHub Pages over a third-party status page

- Zero cost, zero vendor lock-in
- Public URL with no login — customers/partners can bookmark it
- History is a plain JSON file, greppable for post-incident review
- The HTML is a 60-line inline template — no framework, no build step, loads fast

---

## Alert channels

A single failure escalates across three channels with different urgency:

### 1. GitHub Issues (primary)

Every alert opens a GitHub issue labelled `alert:active` + `source:<monitor|smoke|synthetic|commission-sync>`. The issue body contains the failing workflow run URL, the specific check that failed, and a timestamp.

- **Dedup key** — one open issue per `(source, title)` pair. A second failure within an active incident appends a comment, doesn't open a new issue.
- **Auto-close** — the next green run of that same workflow closes the issue via `alert-dedup.js --recover`.

### 2. Team WhatsApp (critical)

When an alert opens **for the first time** (not on dedup-append), the workflow sends a WhatsApp message via YCloud to the `TEAM_WHATSAPP_NUMBERS` / `ADMIN_PERSONAL_PHONE` numbers. Message contains:

- The alert source (`monitor`, `smoke`, `synthetic`)
- Run URL for one-click investigation
- Short description of the failure

Escalation cooldown is **2 hours** — if the issue stays open for more than two hours and is still failing, a "still broken" nudge goes out. The cooldown exists so a multi-hour outage doesn't generate 48 redundant messages.

### 3. Email (daily digest)

Email is wired via Resend (`RESEND_API_KEY` + `RESEND_FROM`). Used for:

- First-failure notification (same trigger as WhatsApp)
- Daily digest summarizing any open incidents
- Post-mortem artifact links

---

## Alert dedup and auto-recovery

The dedup gateway is `tests/monitor/alert-dedup.js`. It's invoked from `monitor.yml`, `smoke.yml`, and `synthetic.yml` on both failure and recovery.

### Logic

```
On failure:
  1. GET open issues with labels "alert:active" + "source:<SOURCE>"
  2. If none exists:
       - Create issue "[<SOURCE>] <title>"
       - Send WhatsApp + email (first failure — we want to know fast)
  3. If one exists:
       - Append a comment with new timestamp + workflow run URL
       - Notify only if ≥ 2 hours since last notification
         (escalation: "still broken" poke every 2h, not 60× a day)

On --recover (next green run):
  1. Find the active alert issue for SOURCE
  2. Close it with a recovery comment
  3. Send recovery notification through WhatsApp + email
```

### Required env for the dedup script

- `GITHUB_TOKEN`, `GITHUB_REPOSITORY` — supplied by Actions
- `ALERT_SOURCE` — one of `monitor`, `smoke`, `synthetic`
- `YCLOUD_API_KEY`, `WHATSAPP_PHONE_ID`, `ALERT_WHATSAPP` — WhatsApp path
- `RESEND_API_KEY`, `ALERT_EMAIL`, `RESEND_FROM` — email path
- `GITHUB_SERVER_URL`, `GITHUB_RUN_ID` — embedded in the message

### Commission sync has its own inline dedup

`commission-sync.yml` reuses the same pattern but inlines it with `actions/github-script@v7` instead of calling `alert-dedup.js` — the logic is duplicated but the behaviour matches.

---

## Runbook pointer

When an alert fires, the on-call engineer opens [`docs/INCIDENT-RESPONSE.md`](./INCIDENT-RESPONSE.md) and follows the checklist there. That document covers:

- First-60-seconds triage
- Scoping questions ("is it all endpoints or one?", "is it one region or global?")
- Escalation path
- Who to page when
- Post-mortem template

This monitoring document answers **how we detect**. The incident response doc answers **what we do next**. Both point at the status page + open alert issues as the first things to read.

### Where the pieces live

| Concern | File |
|---------|------|
| Monitor logic | `tests/monitor/check.js` |
| Status page publisher | `tests/monitor/publish-status.js` |
| Alert dedup + recovery | `tests/monitor/alert-dedup.js` |
| Smoke suite | `tests/smoke/*.test.ts` |
| Synthetic suite | `tests/synthetic/user-journeys.spec.ts` |
| Hourly workflow | `.github/workflows/monitor.yml` |
| Smoke workflow | `.github/workflows/smoke.yml` |
| Synthetic workflow | `.github/workflows/synthetic.yml` |
| Status workflow | `.github/workflows/publish-status.yml` |
| RUM integration notes | `docs/RUM-SETUP.md` |
| Incident playbook | `docs/INCIDENT-RESPONSE.md` |
