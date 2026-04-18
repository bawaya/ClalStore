# Security

> How ClalMobile protects customer data, financial records, and administrative controls. Read this before reviewing any PR that touches auth, RLS, or payments.

## Table of Contents

- [Security model](#security-model)
- [Authentication & authorization](#authentication--authorization)
- [Row-Level Security (RLS) on Supabase](#row-level-security-rls-on-supabase)
- [Payments](#payments)
- [Webhooks](#webhooks)
- [CSRF protection](#csrf-protection)
- [Rate limiting](#rate-limiting)
- [Secrets management](#secrets-management)
- [Dependency security](#dependency-security)
- [Reporting a vulnerability](#reporting-a-vulnerability)

---

## Security model

The app operates with **three trust tiers**:

| Tier | Role | Supabase role | Can read | Can write |
|------|------|---------------|----------|-----------|
| **Anon** | Unauthenticated visitor | `anon` | Public catalog (`products`, `heroes`, `deals`, `sub_pages` where `is_visible = true`) | Nothing direct — only via `/api/orders`, `/api/contact`, `/api/coupons/validate`, etc. |
| **Customer** | Logged-in shopper (OTP) | `authenticated` | Own profile, own orders, own loyalty, own reviews | Own profile edits only — through the API |
| **Staff / Admin** | Internal user with role | `service_role` via `/api/admin/*` | Everything in their role's scope | Everything in their role's scope |

Every `POST`, `PUT`, `PATCH`, `DELETE` on sensitive tables flows through `/api/*` routes that use `createAdminSupabase()` (service role). **Anon and authenticated clients never write to privileged tables directly.**

---

## Authentication & authorization

### Admin / staff login

`/login` → Supabase Auth (email + password). On success, `middleware.ts` sets an `sb-access-token` cookie. Every `/admin` and `/crm` route calls `requireAdmin(req)` which:

1. Validates the session JWT via `@supabase/ssr`
2. Looks up the user in the `users` table
3. Rejects if `status != 'active'`
4. Rejects if role is in the `blockedRoles` set (e.g., `customer`, `viewer` for CRM writes)
5. Returns `{ id, email, role, appUserId, name }` on success

### Customer login

`/store/auth` → OTP via Twilio Verify. On success, a signed `auth_token` is stored in the `customers` row with a 30-day expiry.

### RBAC

Roles are defined in `lib/admin/auth.ts`:

| Role | Scope |
|------|-------|
| `super_admin` | Wildcard — full access |
| `admin` | Products, orders, CRM, commissions, settings, users |
| `sales` | CRM read/write, commissions read/create, orders read/create/edit |
| `support` | Read-only + CRM edits |
| `content` | Website CMS, heroes, sub_pages |
| `viewer` | Read-only across dashboards |

Permission checks use `hasPermission(role, module, action)`. Every admin API route wraps its handler with `withPermission(module, action, handler)`.

---

## Row-Level Security (RLS) on Supabase

Every sensitive table has RLS **enabled** and policies scoped explicitly by role. The canonical hardening lives in:

- `supabase/migrations/20260418000001_harden_rls_global.sql`
- `supabase/migrations/20260418000002_harden_rls_followup.sql`

### Policy snapshot (production)

| Table | anon | authenticated | service_role |
|-------|------|---------------|--------------|
| `sub_pages` | SELECT `is_visible = true` | SELECT `is_visible = true` | ALL |
| `products`, `heroes`, `deals` | SELECT (public catalog) | SELECT | ALL |
| `orders`, `order_items`, `order_notes`, `order_status_history` | — | — | ALL (via `/api/*`) |
| `customers`, `customer_hot_accounts` | — | — | ALL |
| `commission_*` (6 tables) | — | — | ALL |
| `inbox_conversations`, `inbox_messages`, `inbox_notes`, `inbox_labels` | — | — | ALL |
| `audit_log` | — | — | ALL |

### FORCE ROW LEVEL SECURITY

We enable `FORCE ROW LEVEL SECURITY` only on tables with **no incoming FK writes** — specifically `sub_pages` and `audit_log`. For FK-target tables (products, customers, orders, etc.), FORCE breaks Postgres's internal FK validation because it doesn't exempt `BYPASSRLS` roles during the referential check. Regular `ENABLE ROW LEVEL SECURITY` is sufficient.

### Verification

The 17 RLS contract tests in `tests/staging/rls-contract.test.ts` run on every push to `main` and explicitly probe each table with an `anon` Supabase client. A fresh deploy can't land if any RLS policy regresses.

---

## Payments

Three gateways are supported, auto-selected by customer city:

- **Rivhit / iCredit** — default
- **UPay** — alternate cities
- All calls go through `lib/integrations/` provider wrappers

### Callback verification

`/api/payment/callback` and `/api/payment/upay/callback` verify:

1. Signature matches `PAYMENT_WEBHOOK_SECRET` (HMAC-SHA256)
2. Amount in callback matches stored order total
3. Order exists and is in `new` or `pending_payment` status

### Forbidden patterns

- **Never** trust the amount or order ID in a callback without re-reading the server's stored order
- **Never** store card numbers or CVVs (we don't)
- **Never** log PII beyond the last 4 digits of a card

---

## Webhooks

### Incoming webhooks

| Endpoint | Provider | Verification |
|----------|----------|--------------|
| `/api/webhook/whatsapp` | yCloud | HMAC-SHA256 with `WEBHOOK_SECRET` |
| `/api/webhook/twilio` | Twilio | HMAC-SHA1 signature via `X-Twilio-Signature` |
| `/api/payment/callback` | Rivhit | HMAC-SHA256 with `PAYMENT_WEBHOOK_SECRET` |
| `/api/payment/upay/callback` | UPay | Same |

All verification flows through `lib/webhook-verify.ts`. Signatures are compared in **constant time** (`timingSafeEqual` equivalent) to prevent timing attacks.

### Outgoing webhooks

We don't expose customer-configurable outbound webhooks. All outbound is pre-configured server-side.

---

## CSRF protection

### What's protected

All `POST`, `PUT`, `PATCH`, `DELETE` requests to `/api/*` (except payment callbacks, which use signature verification instead).

### How

1. `GET /api/csrf` sets an `httpOnly=false` cookie `csrf_token` + returns it in the body
2. Client-side requests include `x-csrf-token` header (via `csrfHeaders()` helper)
3. `lib/csrf.ts#validateCsrf()` compares cookie vs header in constant time

### Exceptions

- Payment callbacks — signed by provider
- `/api/cron/*` — authenticated via `Authorization: Bearer <CRON_SECRET>`
- `/api/health` — read-only
- `/api/webhook/*` — signed by provider

---

## Rate limiting

Two layers:

1. **Middleware** (`middleware.ts`) — sliding-window in-memory counter per IP
   - `/api/*`: 60 req/min
   - `/api/webhook/*`: 120 req/min
   - `/api/auth/*`: 5 req/min
   - `/api/admin/upload`: 10 req/min
2. **Database** (`lib/rate-limit-db.ts`) — persistent across instances via the `rate_limits` table for auth-sensitive endpoints

On limit exceeded: HTTP 429 + `Retry-After` header. All limits are verified by chaos tests (`tests/unit/lib/chaos.test.ts`).

---

## Secrets management

### Never commit secrets

`.gitignore` excludes `.env*` files. `gitleaks` runs on every push to catch mistakes — see `.github/workflows/security.yml`.

### Secret storage

| Where | Used by |
|-------|---------|
| `.env.local` | Local dev only |
| GitHub Actions secrets | CI, Staging, Smoke, Monitor, Synthetic, Visual, Lighthouse |
| Cloudflare Worker env vars | Production runtime (including `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`) |

### Rotating a secret

1. Generate new value (e.g., `openssl rand -hex 32`)
2. Update in Cloudflare Worker Dashboard → Settings → Variables
3. Update in GitHub: `gh secret set <NAME> --body "<new-value>"`
4. Update in `.env.local` if needed for local dev

The `SUPABASE_ACCESS_TOKEN` in particular has been rotated mid-session in this project — see commit history for the procedure.

---

## Dependency security

### Process

- **Dependabot** opens grouped PRs every Monday (npm + GitHub Actions)
- **npm audit** runs daily via `.github/workflows/security.yml`
- CVE output is filtered through `.github/audit-check.js` against `.github/audit-allowlist.json`
- Unknown HIGH/CRITICAL CVEs → build breaks
- Known-unfixable CVEs → require explicit allowlist entry with `reason` + `expires`

### Current allowlist (summary)

| Package | Severity | Expires | Reason |
|---------|----------|---------|--------|
| `xlsx` | HIGH | 2026-10-01 | No upstream patch; admin-side exports only; replacement with `exceljs` tracked |
| `next@15.5.14` | HIGH | 2026-06-01 | 15.5.15 upgrade introduces React 18/19 incompatibility; short-expiry forces revisit after react-dom 19 migration |

### Reviewing a Dependabot PR

1. Verify CI passes (all 10+ workflows green)
2. Read the CHANGELOG / release notes for breaking changes
3. For a major bump (semver major), also run:
   ```bash
   npx vitest run --coverage
   npx playwright test
   bash tests/staging/run-staging.sh
   ```

---

## Reporting a vulnerability

If you believe you have found a security vulnerability in ClalMobile, please **do not open a public GitHub issue**. Instead, email `security@clalmobile.com` with:

- A description of the vulnerability
- Steps to reproduce
- The impact (what an attacker could do)
- Any suggested mitigations

We commit to:

- Acknowledging receipt within 48 hours
- Providing a timeline for remediation within 7 days
- Crediting you in the fix commit message (unless you prefer anonymity)

For low-severity issues (e.g., missing security headers, non-exploitable error messages), a regular GitHub issue is fine.

---

## Defence-in-depth summary

| Control | Layer it catches |
|---------|------------------|
| TypeScript strict mode | Compile-time |
| ESLint + CodeQL | Code scan |
| Vitest + Stryker | Logic correctness |
| Playwright + RLS contract tests | Behavior correctness |
| CSRF tokens + webhook signatures | Request authenticity |
| Rate limiting (middleware + DB) | Abuse |
| Supabase RLS | DB-level access control |
| Service-role-only writes | Privilege separation |
| Dependabot + npm audit + allowlist | Supply chain |
| Synthetic journeys + monitor | Production awareness |
| Alert dedup via Issues | Signal-to-noise |

Every layer assumes the layer above might fail. That's the whole point.
