# Documentation

> Canonical reference for ClalMobile engineers, operators, and reviewers. For the top-level project overview, see [../README.md](../README.md).

## By audience

### 👩‍💻 I'm writing code

Start here → **[CONTRIBUTING.md](./CONTRIBUTING.md)**

Then:
- [ARCHITECTURE.md](./ARCHITECTURE.md) — how the pieces fit together
- [API-REFERENCE.md](./API-REFERENCE.md) — every HTTP route (129+)
- [DATABASE.md](./DATABASE.md) — schema, RLS, triggers, migrations
- [TESTING.md](./TESTING.md) — six-layer testing strategy
- [SECURITY.md](./SECURITY.md) — RLS, CSRF, auth, payments

### 🛠️ I'm on-call / ops

Start here → **[OPERATIONS.md](./OPERATIONS.md)**

Then:
- [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md) — playbook for when things break
- [MONITORING.md](./MONITORING.md) — hourly monitor, smoke, synthetic, status page
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Cloudflare Workers + OpenNext + GitHub Actions
- [RUM-SETUP.md](./RUM-SETUP.md) — Real User Monitoring plan

### 🔍 I'm reviewing a PR

Start here → **[CONTRIBUTING.md § review expectations](./CONTRIBUTING.md#review-expectations)**

Relevant checklists:
- [Security checklist](../.github/PULL_REQUEST_TEMPLATE.md#security-checklist)
- [Migration checklist](../.github/PULL_REQUEST_TEMPLATE.md#migration-checklist)
- [RLS policies](./DATABASE.md#row-level-security-summary)

### 🧩 I'm learning a feature

- Storefront → [STORE.md](./STORE.md)
- Admin panel → [ADMIN.md](./ADMIN.md)
- CRM (inbox + pipeline) → [CRM.md](./CRM.md)
- Commissions → [COMMISSIONS.md](./COMMISSIONS.md) _(private rates in [private/COMMISSION_RATES.md](./private/COMMISSION_RATES.md))_
- Sales PWA → [PWA.md](./PWA.md)
- WhatsApp bot + WebChat → [BOT.md](./BOT.md)
- Bilingual UI → [I18N.md](./I18N.md)

### 🚨 I found a vulnerability

Don't open a GitHub issue — see [../SECURITY.md](../SECURITY.md) for private disclosure.

---

## Full catalogue

| Document | Lines | What's inside |
|----------|-------|---------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 644 | System topology, Mermaid diagrams, RBAC roles, integration hub, design decisions |
| [DATABASE.md](./DATABASE.md) | 523 | ER diagram, 65+ tables, RLS summary, triggers, RPCs, migration order |
| [API-REFERENCE.md](./API-REFERENCE.md) | 581 | ~145 routes grouped by module, auth guards, example requests |
| [STORE.md](./STORE.md) | 407 | Customer journey, search, coupons, loyalty, checkout, payment providers |
| [ADMIN.md](./ADMIN.md) | 754 | Products/orders/customers management, sales-docs cancel, announcements, corrections, site CMS, RBAC matrix |
| [CRM.md](./CRM.md) | 616 | Intercom-style Inbox, AI features, Pipeline (+ auto-commission on won), handoff policy |
| [COMMISSIONS.md](./COMMISSIONS.md) | 835 | Unified register, three sources (Pipeline/PWA/Sync), cancel flow, month-lock trigger — _conceptual, rates in private docs_ |
| [PWA.md](./PWA.md) | 711 | Unified employee PWA — dashboard, commissions, calculator, corrections, activity, announcements |
| [BOT.md](./BOT.md) | 542 | WhatsApp bot engine, intent handling, safety rails, handoff, WebChat |
| [TESTING.md](./TESTING.md) | 519 | Six-layer strategy, coverage targets, 2967 tests / 181 files |
| [SECURITY.md](./SECURITY.md) | 265 | Trust model, auth, RLS, CSRF, webhook signatures, rate limits, secrets rotation |
| [OPERATIONS.md](./OPERATIONS.md) | 296 | Deployment flow, rollback, secret rotation, migration apply, monitoring dashboards |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 515 | Cloudflare Workers + OpenNext build pipeline, env vars, 14+ GitHub workflows |
| [MONITORING.md](./MONITORING.md) | 318 | Alert layers, hourly monitor, status page, alert channels |
| [I18N.md](./I18N.md) | 408 | Arabic + Hebrew RTL, locale files, bilingual DB columns, date/currency, PDF Cairo font |
| [INCIDENT-RESPONSE.md](./INCIDENT-RESPONSE.md) | 156 | Severity ladder, first-5-minute checklist, common scenarios |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 351 | Prerequisites, daily workflow, code style, commit messages, PR process |
| [RUM-SETUP.md](./RUM-SETUP.md) | 124 | Cloudflare Web Analytics + Sentry plan |
| [CHANGELOG.md](./CHANGELOG.md) | 32 | Pointer to root-level canonical changelog |

_Total public docs: ~9,000 lines of structured documentation._

---

## Private documentation (gitignored)

Lives under `docs/private/` — not pushed to the public repo. Contains rates, contracts, credentials pointers, and runbook steps.

| Document | What's inside |
|----------|---------------|
| `COMMISSION_RATES.md` | Actual multipliers, thresholds, sanction amounts |
| `BUSINESS_RULES.md` | HOT Mobile contract terms, pricing strategy, delivery policy |
| `INFRASTRUCTURE.md` | Project IDs, bucket names, DNS, account references |
| `RUNBOOK.md` | On-call procedures for payment failures, WhatsApp outage, locked-month fixes |
| `SECURITY.md` | Token inventory, RLS detail, known vulns, incident plan |
| `ONBOARDING.md` | New hire setup steps, access list |
| `AUDIT_HISTORY.md` | Historical audits (notifications, full-audit, customer-retention) |

Ask a maintainer for access.

---

## By role (RBAC)

| Role | Documentation they need |
|------|--------------------------|
| Developer | CONTRIBUTING, ARCHITECTURE, API-REFERENCE, DATABASE, TESTING |
| Staff admin (super_admin, admin) | OPERATIONS, INCIDENT-RESPONSE, ADMIN, private/RUNBOOK |
| Sales manager | COMMISSIONS, CRM, private/COMMISSION_RATES, private/BUSINESS_RULES |
| Security reviewer | SECURITY, DATABASE (RLS), INCIDENT-RESPONSE |
| External contributor | CONTRIBUTING, TESTING, ARCHITECTURE |

---

## Status page

Public uptime + response-time dashboard: **https://bawaya.github.io/ClalStore/**

Updated every 15 minutes from the `status-page` branch. Surfaces the same signal the on-call engineer sees from the hourly monitor.

---

## Reference

- [../CHANGELOG.md](../CHANGELOG.md) — every release annotated (Keep-a-Changelog)
- [../README.md](../README.md) — top-level project overview
- [../AGENTS.md](../AGENTS.md) — AI-agent + contributor conventions
- [../PROJECT_MAP.md](../PROJECT_MAP.md) — auto-generated directory + dependency map
- [../SECURITY.md](../SECURITY.md) — public disclosure policy

---

## How docs are maintained

- Every PR that changes behavior updates the relevant doc (enforced by reviewer, not CI)
- `CHANGELOG.md` follows [Keep a Changelog](https://keepachangelog.com/) — update `## [Unreleased]` as you merge
- When a new scenario shows up in incident response, add it to [INCIDENT-RESPONSE.md § Common scenarios](./INCIDENT-RESPONSE.md#common-scenarios)
- When a new test layer is added, add it to [TESTING.md § The six layers at a glance](./TESTING.md#the-six-layers-at-a-glance)
- No secrets, real rates, or customer data in the public docs — put those in `docs/private/`
