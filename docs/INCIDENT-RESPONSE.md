# Incident Response

> How to respond when production breaks. Short enough to read during an incident.

## Severity ladder

| Level | Example | Response time |
|-------|---------|---------------|
| **SEV-1** | Site is down, checkout fails, payments broken, RLS leak exposing financial data | Page on-call immediately; all hands until resolved |
| **SEV-2** | One major flow broken (e.g., inbox not loading, search broken), one admin page crashes | Respond within 1 hour |
| **SEV-3** | Minor flow broken, intermittent errors, specific browser affected | Respond within 1 business day |
| **SEV-4** | Cosmetic issue, single customer complaint, non-blocking | Triage during normal work |

---

## First 5 minutes

1. **Is it actually broken?** Open `https://bawaya.github.io/ClalStore/` (status page — independent of the thing being monitored)
2. **How big?** Open `https://clalmobile.com` in a private window. Try one customer flow. Can you reproduce the reported issue?
3. **Declare** in the team channel: `SEV-X · <one-line summary>`
4. **Create an Issue** (or let `alert-dedup.js` do it) with label `alert:active` so other responders can see the state
5. **Check the usual suspects** — see checklist below

---

## First-5-minute checklist

```
[ ] Status page: https://bawaya.github.io/ClalStore/
[ ] Cloudflare Worker logs: Dashboard → Workers → clalstore → Logs (live tail)
[ ] GitHub Actions: https://github.com/bawaya/ClalStore/actions (any red cron runs?)
[ ] Supabase: Dashboard → Database → Logs · Auth → Logs · Storage → Logs
[ ] Recent deploy: last commit on main — is it correlated?
[ ] Any open alerts: gh issue list -l alert:active
```

---

## Common scenarios

### Scenario A · Homepage returns 500

| Step | Action |
|------|--------|
| 1 | Cloudflare Worker Dashboard → Logs → filter for errors in last 15 min |
| 2 | If a JS error shows, check the last commit on `main` for the stack-trace line |
| 3 | If it points at Supabase connection — open Supabase Dashboard → Project Settings → Database to verify the service is up |
| 4 | Rollback via `git revert <bad-sha> && git push` (preferred) OR Cloudflare Dashboard → Deployments → prior successful → Rollback |
| 5 | Once recovered, close the `alert:active` issue — this sends the recovery notification |

### Scenario B · "Can't check out" customer report

| Step | Action |
|------|--------|
| 1 | Reproduce in a private window from a mobile user agent. The issue might be device-specific |
| 2 | Check the Cloudflare Worker logs for `POST /api/orders` — look for 400/500 responses |
| 3 | Check Rivhit / UPay dashboards directly for provider-side outages |
| 4 | If a payment callback is failing, check `PAYMENT_WEBHOOK_SECRET` hasn't been rotated without matching both sides |
| 5 | Mitigation: if one gateway is down, set its `integrations.status = 'inactive'` via Supabase SQL Editor — the app will auto-route through the other |

### Scenario C · RLS leak reported by staging tests

Treat as **SEV-1** even if no customer has complained yet — the leak is live.

| Step | Action |
|------|--------|
| 1 | Reproduce locally against the real DB using the anon key (see `tests/staging/rls-contract.test.ts` for the shape) |
| 2 | Write a new migration that tightens the offending policy |
| 3 | Apply via Supabase SQL Editor immediately (do not wait for a deploy cycle) |
| 4 | Commit the migration file; push `main` so staging re-verifies |
| 5 | Post-incident: document in `CHANGELOG.md` under `### Security` |

### Scenario D · WhatsApp messages not sending / receiving

| Step | Action |
|------|--------|
| 1 | Test: send a WhatsApp to the test number via Supabase Dashboard → Edge Functions OR directly via yCloud API |
| 2 | If yCloud rejects with 401 → rotate `YCLOUD_API_KEY` |
| 3 | If webhook not firing → verify `WEBHOOK_SECRET` matches in both yCloud dashboard and Cloudflare env |
| 4 | Check `/api/webhook/whatsapp` Worker logs for signature verification failures |

### Scenario E · Scheduled reports not sending

| Step | Action |
|------|--------|
| 1 | `gh run view --workflow=scheduled-reports.yml --limit 1` — what's the HTTP code? |
| 2 | If 401/503 → `CRON_SECRET` mismatch between GitHub Actions and Cloudflare Worker env. Follow the rotation procedure in [OPERATIONS.md](./OPERATIONS.md#special-rotating-cron_secret) |
| 3 | If 500 → check `/api/cron/reports` Worker logs |
| 4 | Re-trigger: `gh workflow run scheduled-reports.yml` |

### Scenario F · All synthetic tests suddenly fail

| Step | Action |
|------|--------|
| 1 | Check if Cloudflare is having an outage: https://www.cloudflarestatus.com |
| 2 | Check if GitHub Actions runners are having issues |
| 3 | Check if `clalmobile.com` DNS is resolving — `dig clalmobile.com` from your machine |
| 4 | If only one test fails consistently, it may be legitimate — treat as SEV-3 |

---

## Post-incident checklist

Within 24 hours of recovery:

- [ ] Close the `alert:active` Issue (triggers recovery notification if not already sent)
- [ ] Write a **post-mortem** comment on the Issue — what happened, why, how we fixed, what we learned
- [ ] Add a regression test if one would have caught this
- [ ] Update `CHANGELOG.md` if a security issue was involved
- [ ] If runbook was wrong or missing a scenario, update [OPERATIONS.md](./OPERATIONS.md) and this file

---

## Communication templates

### Customer-facing status update

```
We're aware of an issue affecting [checkout / search / etc.] on clalmobile.com
and are actively working on a fix. Updates: https://bawaya.github.io/ClalStore/
```

### Internal team update

```
SEV-<N> · <area>
Started: <timestamp>
Impact: <# customers affected, if known>
Current status: <investigating / mitigating / resolved>
Lead: @<your-handle>
Next update: <time>
```

---

## Escalation contacts

| Role | Contact | When |
|------|---------|------|
| Engineering on-call | Per rotation | First |
| Database owner | Supabase maintainer | DB-level issues (locks, replication, cost spikes) |
| Cloudflare admin | Worker owner | Edge / runtime issues |
| Payment provider support | Rivhit / UPay account manager | Gateway-level outages |
| Legal / PR | TBD | Privacy breach or public-facing incident |

---

## What counts as "resolved"

An incident is only resolved when:
1. The monitor workflow runs green **twice in a row** (synthetic + hourly monitor)
2. The `alert:active` Issue is closed
3. A post-mortem is written (may be short for SEV-3/4)
4. A regression test is in main OR a tracking issue for one is open

Declaring "resolved" and walking away without the above is how incidents become repeat incidents.
