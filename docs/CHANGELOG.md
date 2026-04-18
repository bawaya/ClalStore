# Changelog

See [`../CHANGELOG.md`](../CHANGELOG.md) — we keep the canonical changelog at the repo root per [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) convention.

The root file is the single source of truth for every release and every change in the `[Unreleased]` section. Any automation, release tooling, or human reader should read the root file, not a copy.

## Where to look

- **All releases** — [`../CHANGELOG.md`](../CHANGELOG.md)
- **Deployment pipeline + workflows** — [`./DEPLOYMENT.md`](./DEPLOYMENT.md)
- **Monitoring + alerting** — [`./MONITORING.md`](./MONITORING.md)
- **Internationalization** — [`./I18N.md`](./I18N.md)
- **Architecture overview** — [`./ARCHITECTURE.md`](./ARCHITECTURE.md)
- **Operations runbook** — [`./OPERATIONS.md`](./OPERATIONS.md)
- **Security posture** — [`./SECURITY.md`](./SECURITY.md)
- **Incident response** — [`./INCIDENT-RESPONSE.md`](./INCIDENT-RESPONSE.md)

## Format

We follow [Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/):

- `Added` / `Changed` / `Deprecated` / `Removed` / `Fixed` / `Security`
- Entries live under the `[Unreleased]` heading while the work is in-flight
- When a version is cut, `[Unreleased]` is renamed to `[X.Y.Z] — YYYY-MM-DD` and a fresh `[Unreleased]` block is added above it

## Versioning

Informal semantic versioning:

- **MAJOR** — breaking changes to API surface or DB schema that require coordinated deploy + migration
- **MINOR** — new features, test coverage, or docs that are additive
- **PATCH** — bug fixes, dependency bumps, RLS/security fixes
