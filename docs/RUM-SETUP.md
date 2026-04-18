# Real User Monitoring (RUM)

This document covers how to wire up real-user performance + error tracking for ClalMobile, complementing the synthetic journeys we run every 30 minutes.

## Why RUM?

Synthetic tests answer: **"does the flow work when WE run it?"**
RUM answers: **"does the flow work for real customers, right now?"**

Three things RUM catches that synthetic misses:
1. **Browser / device fragmentation** — an old Samsung Galaxy in Haifa with a slow 3G connection hitting a corner case
2. **Geographic latency** — Cloudflare edge cache cold spot in some region
3. **Rare flows** — a specific payment method + coupon + guest-checkout path that synthetic doesn't rehearse

## Recommended: Cloudflare Web Analytics (free)

Our deployment target is Cloudflare Workers, which ships **Web Analytics** free with every domain. It gives us Core Web Vitals (LCP, CLS, INP, FID) + page views + referrers, with no third-party tracker and no cookies.

### Setup

1. Log in to https://dash.cloudflare.com
2. Navigate to **Analytics & Logs → Web Analytics**
3. Click **Add a site** → enter `clalmobile.com`
4. Cloudflare auto-instruments traffic through the Worker — no JS snippet to add

### What you get

- Core Web Vitals per path (median + p75)
- Geographic breakdown
- Browser / device split
- 24-hour and 7-day trends
- Error rate per path

### Alerts

Cloudflare doesn't natively alert on RUM thresholds, but you can:
- Query Cloudflare GraphQL Analytics API from a scheduled workflow
- Compare LCP p75 against a budget (e.g. `> 4s` for 15 min)
- Route alerts through `tests/monitor/alert-dedup.js`

Sketch of the workflow we'd add:

```yaml
# .github/workflows/rum-alerts.yml
on:
  schedule:
    - cron: "*/15 * * * *"
jobs:
  rum:
    runs-on: ubuntu-latest
    steps:
      - run: |
          curl -sS -X POST "https://api.cloudflare.com/client/v4/graphql" \
            -H "Authorization: Bearer ${{ secrets.CF_API_TOKEN }}" \
            -H "Content-Type: application/json" \
            -d @tests/monitor/rum-query.graphql \
            > rum.json
          node tests/monitor/rum-threshold-check.js rum.json
```

(Not implemented yet — requires a Cloudflare API token with `Analytics:Read` scope.)

## Alternative: Sentry

If Cloudflare Web Analytics isn't enough detail (e.g. you want stack traces for client-side errors, not just LCP bins), [Sentry](https://sentry.io) has a free tier with 5K errors / month.

### Setup

1. Create a project at https://sentry.io → select "Next.js"
2. Install the SDK: `npm i @sentry/nextjs`
3. Run `npx @sentry/wizard@latest -i nextjs` — it writes config files
4. Add `SENTRY_DSN` + `SENTRY_AUTH_TOKEN` to Cloudflare Worker env vars
5. Deploy

The wizard creates:
- `sentry.client.config.ts` — browser
- `sentry.server.config.ts` — API routes
- `sentry.edge.config.ts` — middleware / edge runtime

### Pairing with alert-dedup

Sentry's own alerting can fire webhooks. Route the webhook to a lightweight Cloudflare Worker that POSTs to our existing `alert-dedup.js` Actions workflow:

```typescript
// apps/sentry-gateway/worker.ts
export default {
  async fetch(req: Request): Promise<Response> {
    const payload = await req.json();
    // Trigger a GitHub Actions workflow_dispatch with payload summary
    await fetch(
      `https://api.github.com/repos/bawaya/ClalStore/actions/workflows/rum-alerts.yml/dispatches`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GITHUB_PAT}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          ref: "main",
          inputs: { source: "sentry", summary: payload.event.title ?? "unknown" },
        }),
      },
    );
    return new Response("ok");
  },
};
```

## Current state

- **Synthetic** (every 30 min) ✅ running
- **Smoke** (daily + post-deploy) ✅ running
- **Monitor** (hourly) ✅ running
- **Cloudflare Web Analytics** — ⏳ needs 2-click enablement on dashboard
- **Sentry** — ⏳ optional, cost-benefit depends on error volume

## Decision log

We picked **Cloudflare Web Analytics** as the default RUM because:
1. It's free, cookieless, and no extra JS bundle (Worker-injected).
2. Core Web Vitals is the most important signal — stack traces can wait.
3. Sentry's value kicks in at ≥1K errors/day; we don't know our volume yet.

Revisit once monthly error count exceeds 500 OR P1 bugs slip through to customers.
