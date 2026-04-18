# Operations Runbook

> Common day-to-day operations, from rotating a secret to rolling back a broken deploy. Written for on-call engineers — assumes familiarity with the system, not with this codebase specifically.

## Table of Contents

- [Deployment](#deployment)
- [Rolling back](#rolling-back)
- [Rotating secrets](#rotating-secrets)
- [Applying a migration](#applying-a-migration)
- [Alerts you might receive](#alerts-you-might-receive)
- [Triaging a synthetic-test failure](#triaging-a-synthetic-test-failure)
- [Triaging an RLS contract failure](#triaging-an-rls-contract-failure)
- [The status page](#the-status-page)
- [Monitoring dashboards](#monitoring-dashboards)
- [Runbook index](#runbook-index)

---

## Deployment

### Preview (PR)

Every PR spins up its own Cloudflare preview via the `test.yml` workflow. URL is commented automatically on the PR.

### Production

Push to `main` → Cloudflare Worker auto-builds + deploys.

**No manual step.** The production deploy is gated by:
1. `test.yml` passing on the merge commit
2. `staging.yml` passing against real Supabase

### Expected timing

| Stage | Duration |
|-------|----------|
| GitHub Actions CI | ~5 min |
| Staging Tests | ~1 min |
| Cloudflare Worker build | ~2 min |
| Cloudflare Worker deploy | < 1 min |
| **Total push-to-live** | ~8 min |

### Post-deploy verification

`smoke.yml` fires automatically on `deployment_status: success`. If it fails, an alert Issue opens and WhatsApp + email notifications go out.

---

## Rolling back

**Preferred approach: revert the commit on `main`.**

```bash
git revert <bad-commit-sha>
git push origin main
```

Cloudflare redeploys automatically. Roll-forward over roll-back.

**If a revert is impossible** (e.g., DB migration already applied), use Cloudflare Dashboard → Workers & Pages → `clalstore` → Deployments → select a prior successful deployment → **Rollback**.

Database migrations are **one-way** by default. If you need to undo one:

1. Write a new "revert" migration with the DDL to restore the previous shape
2. Apply via Supabase SQL Editor (or Management API — see [Applying a migration](#applying-a-migration))
3. Commit the revert migration file so the staging RLS contract tests reflect reality

---

## Rotating secrets

### Standard rotation procedure

```bash
# 1. Generate the new value
openssl rand -hex 32                    # generic 64-char secret
# or
node -e "console.log(crypto.randomBytes(32).toString('hex'))"

# 2. Update Cloudflare Worker env (if runtime-consumed)
#    Dashboard → Workers & Pages → clalstore → Settings → Variables & Secrets
#    Save and redeploy

# 3. Update GitHub Actions secret (if CI-consumed)
gh secret set SECRET_NAME --body "$NEW_VALUE"

# 4. Update local .env.local
sed -i "s|^SECRET_NAME=.*|SECRET_NAME=$NEW_VALUE|" .env.local
```

### Which secret goes where

| Secret | Cloudflare? | GitHub Actions? | .env.local? |
|--------|-------------|-----------------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | ✓ | ✓ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | ✓ | ✓ |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ | ✓ | ✓ |
| `SUPABASE_ACCESS_TOKEN` (Management API) | — | ✓ (for staging migration apply) | ✓ |
| `CRON_SECRET` | ✓ (runtime gate on `/api/cron/*`) | ✓ (sent by scheduled-reports.yml) | ✓ |
| `YCLOUD_API_KEY` | ✓ | ✓ | ✓ |
| `RESEND_API_KEY` | ✓ | ✓ (alert-dedup.js sends email) | ✓ |
| `WHATSAPP_TEST_NUMBER` | — | ✓ (staging only) | ✓ |
| `ADMIN_PERSONAL_PHONE` | — | ✓ (alert recipient) | ✓ |

### Special: rotating `CRON_SECRET`

Both the Cloudflare Worker (which validates) and the `scheduled-reports.yml` workflow (which sends) must match. Rotate both in the same sitting.

```bash
NEW=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
gh secret set CRON_SECRET --body "$NEW"
# Paste $NEW into Cloudflare Dashboard → Workers → clalstore → Variables
# Redeploy Cloudflare
# Verify: gh workflow run scheduled-reports.yml && gh run list --workflow=scheduled-reports.yml --limit 1
```

---

## Applying a migration

### Preferred: Supabase Dashboard

1. Open https://supabase.com/dashboard/project/<ref>/sql/new
2. Paste the migration SQL
3. **Run**
4. Commit the migration file to the repo so staging tests reflect it

### Alternative: Management API

```bash
TOKEN="$SUPABASE_ACCESS_TOKEN"
SQL=$(cat supabase/migrations/<migration-file>.sql)
node -e "
  const https = require('node:https');
  const fs = require('node:fs');
  const sql = fs.readFileSync('supabase/migrations/<migration-file>.sql', 'utf8');
  const body = JSON.stringify({ query: sql });
  const req = https.request({
    hostname: 'api.supabase.com',
    path: '/v1/projects/<ref>/database/query',
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + process.env.TOKEN,
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body),
    },
  }, res => {
    let d = '';
    res.on('data', c => d += c);
    res.on('end', () => console.log(res.statusCode, d));
  });
  req.write(body); req.end();
" TOKEN="$TOKEN"
```

A successful DDL returns HTTP 201 with `[]`.

### Verifying the migration

Run the staging RLS contract test if RLS was touched:

```bash
gh workflow run staging.yml
gh run list --workflow=staging.yml --limit 1
```

---

## Alerts you might receive

All production alerts route through `tests/monitor/alert-dedup.js` which deduplicates via GitHub Issues. When you get an alert, **the first thing to do is check the open Issues labelled `alert:active`.**

### WhatsApp alert: `🔴 ClalMobile [<source>] FAIL at <timestamp>`

Source can be:
- **monitor** (`monitor.yml` cron hourly) — homepage or API is slow/down
- **smoke** (`smoke.yml` daily) — a production endpoint returned unexpected status
- **synthetic** (`synthetic.yml` cron every 30 min) — a real user journey is broken

The message includes a workflow run URL. Click → inspect the failed step's logs.

### What to do first

1. Open https://bawaya.github.io/ClalStore/ — is the status page red?
2. Open https://clalmobile.com directly — does the homepage load?
3. Open https://dash.cloudflare.com → Workers → `clalstore` → Logs (live tail) — any errors?
4. Open Supabase Dashboard → Database → Logs — any DB errors?

### Escalation timer

If an active alert issue is older than **2 hours**, `alert-dedup.js` will send another WhatsApp + email. This is to wake you up if you missed the first notification.

### Closing an alert manually

```bash
# List open alerts
gh issue list -l alert:active

# Close (also triggers recovery notification)
gh issue close <number>
```

---

## Triaging a synthetic-test failure

The `synthetic.yml` workflow uploads a `synthetic-report/` artifact on failure. Download and open `index.html` to see the exact step that broke, with screenshots and video.

### Common failures

| Symptom | Likely cause | Fix |
|---------|--------------|-----|
| "page.goto: net::ERR_CONNECTION_REFUSED" | clalmobile.com is fully down | Check Cloudflare status + deploy logs |
| "expect(locator).toBeVisible()" timeout | Layout shift / slow render | Check Cloudflare Web Analytics for LCP regression on that path |
| "HTTP 429 on /api/store/smart-search" | Rate limit hit (synthetic runs very often) | Already tolerated in-spec; if persistent, widen the allow list |
| "HTML content < 500 chars" | A page returned an error instead of the expected content | Check Next.js error.tsx / global-error.tsx logs |

### Bypassing temporarily

If a specific test is flaky and blocking real incident response:

```typescript
test.skip("flaky test that needs investigation", async ({ page }) => {
  // TODO(2026-04-20): investigate why this flakes 15% of the time
});
```

Commit with a dated TODO. Open a GitHub issue.

---

## Triaging an RLS contract failure

Staging workflow `staging.yml` failed with a test like `anon CANNOT read <table>`? **This is a real security incident.**

### Immediate action

1. Verify reproducibility — re-run staging (`gh workflow run staging.yml`)
2. If still failing, open a private GitHub Discussion or Slack channel with the failing test name
3. The leak is live on production — consider disabling the leaking feature until fixed

### Root-cause checklist

- Was a new policy added without restricting by role? (Look for `FOR ALL TO public`)
- Was `ENABLE ROW LEVEL SECURITY` accidentally dropped?
- Did `ALTER TABLE ... FORCE ROW LEVEL SECURITY` break `BYPASSRLS` for service_role on a FK-target? (Documented in `SECURITY.md`)

### Fix

Write a migration, apply via SQL Editor, commit, verify staging turns green.

---

## The status page

Public, free, zero-maintenance page at:

```
https://bawaya.github.io/ClalStore/
```

Updated every 15 minutes via `publish-status.yml` which writes to the `status-page` orphan branch. Shows:

- Overall status pill (operational / degraded / down)
- Per-service response time table
- 7-day sparkline (168 data points = 24h × 7)

Link it in customer support templates and status widgets.

---

## Monitoring dashboards

| Dashboard | URL | What it shows |
|-----------|-----|---------------|
| **GitHub Actions** | `/actions` on the repo | Every workflow run, every alert |
| **Cloudflare Worker** | Dashboard → Workers → clalstore | Requests, errors, CPU time, live logs |
| **Cloudflare Web Analytics** | Dashboard → Analytics → Web Analytics → clalmobile.com | RUM — Core Web Vitals, traffic, referrers |
| **Supabase** | Dashboard → Database / Auth / Storage | Queries, slow queries, auth events |
| **Status page** | bawaya.github.io/ClalStore | Public-safe condensed health |

---

## Runbook index

| Task | Section |
|------|---------|
| Deploy a change | [Deployment](#deployment) |
| Undo a deploy | [Rolling back](#rolling-back) |
| Change a secret | [Rotating secrets](#rotating-secrets) |
| Apply SQL to production | [Applying a migration](#applying-a-migration) |
| I got a WhatsApp alert | [Alerts you might receive](#alerts-you-might-receive) |
| Synthetic test failed | [Triaging a synthetic-test failure](#triaging-a-synthetic-test-failure) |
| RLS test failed | [Triaging an RLS contract failure](#triaging-an-rls-contract-failure) |
| Customer asks "is site down?" | Send them the [status page](#the-status-page) |
