# Security Policy

> GitHub automatically surfaces this file in the repository's security tab. The full security model and RLS policies live in [`docs/SECURITY.md`](./docs/SECURITY.md).

## Reporting a vulnerability

**Do not open a public GitHub issue for security bugs.**

Instead, email `security@clalmobile.com` with:

- A description of the vulnerability
- Steps to reproduce
- The potential impact (what an attacker could do)
- Any suggested mitigations

We commit to:

- **Acknowledging receipt within 48 hours**
- **Providing a remediation timeline within 7 days**
- **Crediting you in the fix commit message** (unless you prefer anonymity)

## Supported versions

Only the currently-deployed `main` branch is supported. We do not back-port security fixes to historical branches.

## Scope

In scope:
- https://clalmobile.com and all subdomains
- The Next.js app code in this repo
- Supabase RLS policies referenced in `supabase/migrations/`
- Webhook signature verification in `lib/webhook-verify.ts`

Out of scope:
- Third-party provider vulnerabilities (yCloud, Twilio, SendGrid, Resend, Rivhit, UPay) — please report those directly to the respective vendors
- Social engineering
- DDoS attacks against Cloudflare (Cloudflare's own DDoS protection handles this)

## Further reading

- [`docs/SECURITY.md`](./docs/SECURITY.md) — full security model, RLS design, CSRF, rate limiting, secrets management
- [`docs/INCIDENT-RESPONSE.md`](./docs/INCIDENT-RESPONSE.md) — incident response playbook
