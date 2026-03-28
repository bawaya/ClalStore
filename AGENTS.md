# Agent Guide (clalmobile)
- Stack: Next.js 14 App Router + TypeScript + Tailwind + Supabase (Postgres) + Cloudflare Pages.
- Primary areas: `app/store` (public storefront), `app/admin` (admin panel), `app/crm` (CRM), `app/api/*` (route handlers).
- Business logic lives in `lib/*` (`lib/store`, `lib/admin`, `lib/crm`, `lib/bot`, `lib/integrations`, `lib/ai`); DB types are in `types/database.ts`.
- Database: Supabase migrations in `supabase/migrations`; seed data in `supabase/seed`; use `npm run db:migrate|db:seed|db:reset` for local DB workflows.
- Internal APIs: protected endpoints under `/api/admin/*` and `/api/crm/*`; public/partner endpoints include `/api/store/*`, `/api/webhook/*`, `/api/payment/*`, `/api/orders`.
- Middleware (`middleware.ts`) enforces auth/route protection, rate limiting, security headers, and CORS behavior.

- Install deps: `npm install` (Node `>=18.17.0`).
- Dev server: `npm run dev`; production build/start: `npm run build` then `npm run start`.
- Lint: `npm run lint`; format check: `npm run format:check`; format write: `npm run format`.
- Tests (watch): `npm run test`; CI-style run: `npm run test:run`; coverage: `npm run test:coverage`.
- Run one test file: `npm run test:run -- tests/unit/auth.test.ts`.
- Run one named test: `npm run test:run -- tests/unit/auth.test.ts -t "test name"`.

- Use TS strict mode and keep types explicit at API boundaries; prefer `unknown` + narrowing over broad `any`.
- Follow Prettier defaults here: 2 spaces, semicolons, double quotes, trailing commas, max width 100.
- Import order: framework/external imports first, then `@/*` aliases, then relative imports; keep imports minimal and used.
- Naming: `PascalCase` React components, `camelCase` vars/functions, `UPPER_SNAKE_CASE` constants; route files export HTTP handlers (`GET/POST/...`).
- Error handling: validate input early, return structured `NextResponse.json(...)` with correct status codes, avoid leaking secrets/tokens in logs.
- Security: do not hardcode credentials; rely on env vars and existing integration helpers under `lib/integrations/*`.

- Rule files check: no `.cursor/rules/`, `.cursorrules`, `CLAUDE.md`, `.windsurfrules`, `.clinerules`, `.goosehints`, or `.github/copilot-instructions.md` currently exist in this repo.
