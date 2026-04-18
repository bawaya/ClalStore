# Documentation

> Structured docs for ClalMobile engineers, operators, and reviewers. If you're looking for the top-level project overview, go to [../README.md](../README.md).

## By audience

### 👩‍💻 I'm writing code

Start here → **[CONTRIBUTING.md](./CONTRIBUTING.md)**

Then:
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the pieces fit together
- [TESTING.md](./TESTING.md) — six-layer testing strategy + conventions
- [SECURITY.md](./SECURITY.md) — RLS, CSRF, auth, payments

### 🛠️ I'm on-call / ops

Start here → **[OPERATIONS.md](./OPERATIONS.md)**

Then:
- [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md) — the playbook for when things break
- [RUM-SETUP.md](./RUM-SETUP.md) — Real User Monitoring setup

### 🔍 I'm reviewing a PR

Start here → **[CONTRIBUTING.md § review expectations](./CONTRIBUTING.md#review-expectations)**

Relevant checklists:
- [Security checklist](../.github/PULL_REQUEST_TEMPLATE.md#security-checklist)
- [Migration checklist](../.github/PULL_REQUEST_TEMPLATE.md#migration-checklist)
- [RLS policies](./SECURITY.md#row-level-security-rls-on-supabase)

### 🚨 I found a vulnerability

Don't open a GitHub issue — see [../SECURITY.md](../SECURITY.md) for private disclosure.

---

## By topic

| Document | What's in it |
|----------|--------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System topology, runtime stack, application layout, data model, design decisions, request-flow diagrams |
| [TESTING.md](./TESTING.md) | The six layers (Vitest, CI, Staging, Smoke, Monitor, Synthetic), coverage gates, how to run each, debugging guide |
| [SECURITY.md](./SECURITY.md) | Trust model, authentication, RBAC, Row-Level Security, payments, webhooks, CSRF, rate limits, secrets rotation, disclosure policy |
| [OPERATIONS.md](./OPERATIONS.md) | Deployment flow, rollback, secret rotation, migration application, status page, monitoring dashboards |
| [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md) | Severity ladder, first-5-minute checklist, common scenarios, post-incident review |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Prerequisites, daily workflow, code style, commit messages, PR process, adding routes/pages/migrations |
| [RUM-SETUP.md](./RUM-SETUP.md) | Cloudflare Web Analytics + Sentry plan for Real User Monitoring |

---

## By role (mapped to RBAC)

| Role | Documentation they need |
|------|--------------------------|
| Developer | CONTRIBUTING, TESTING, ARCHITECTURE |
| Staff admin | OPERATIONS (rotation + deploy), INCIDENT-RESPONSE |
| Sales team manager | Feature docs in `../DOCS.md`, CUSTOMER-RETENTION-STAFF-ADMIN-GUIDE |
| Security reviewer | SECURITY, SECURITY.md (top-level), INCIDENT-RESPONSE |
| External contributor | CONTRIBUTING, TESTING |

---

## Status page

Public uptime + response-time dashboard at:

**https://bawaya.github.io/ClalStore/**

Updated every 15 minutes from the `status-page` branch. Surfaces the same signal the on-call engineer sees from the hourly monitor.

---

## Reference

- [../CHANGELOG.md](../CHANGELOG.md) — every release annotated
- [../README.md](../README.md) — top-level project overview
- [../AGENTS.md](../AGENTS.md) — AI-agent conventions (Claude, Copilot)
- [../PROJECT_MAP.md](../PROJECT_MAP.md) — auto-generated directory + dependency map

---

## How docs are maintained

- Every PR that changes behavior updates the relevant doc (enforced by reviewer, not CI)
- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/) — update the `## [Unreleased]` section as you merge
- When a new scenario shows up in incident response, add it to [INCIDENT-RESPONSE.md § Common scenarios](./INCIDENT-RESPONSE.md#common-scenarios)
- When a new test layer is added, add it to [TESTING.md § The six layers at a glance](./TESTING.md#the-six-layers-at-a-glance)
