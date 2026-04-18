# Contributing

> Thanks for writing code for ClalMobile. This guide is short on purpose — read it top-to-bottom once, then come back for lookup.

## Table of Contents

- [Prerequisites](#prerequisites)
- [First-time setup](#first-time-setup)
- [Daily workflow](#daily-workflow)
- [Code style](#code-style)
- [Commit messages](#commit-messages)
- [Pull requests](#pull-requests)
- [Review expectations](#review-expectations)
- [Adding a new API route](#adding-a-new-api-route)
- [Adding a new page](#adding-a-new-page)
- [Adding a new migration](#adding-a-new-migration)
- [Breaking the rules](#breaking-the-rules)

---

## Prerequisites

- **Node.js ≥ 22.19.0** (enforced via `.nvmrc`)
- **npm ≥ 10**
- A Supabase project with service role key
- Access to the required secrets (ask an existing maintainer)

Optional but helpful:
- GitHub CLI (`gh`) — for running workflows locally
- `direnv` — for auto-loading `.env.local`

---

## First-time setup

```bash
git clone https://github.com/bawaya/ClalStore.git clalmobile
cd clalmobile
npm install --legacy-peer-deps

cp .env.example .env.local
# Fill in Supabase URL, keys, and provider credentials

npm run dev                                 # http://localhost:3000
```

### Running the test suite

```bash
npx tsc --noEmit                           # 0 errors required
npx vitest run                             # 2600+ tests, ~20 s
npx playwright test --project=chromium-desktop  # 88 E2E scenarios
```

See [TESTING.md](./TESTING.md) for the full six-layer strategy.

---

## Daily workflow

```bash
# 1. Start from main
git checkout main
git pull

# 2. New branch — no strict naming, but keep it short + descriptive
git checkout -b fix/product-price-rounding

# 3. Make changes; run tests continuously
npx vitest                                 # watch mode

# 4. Before pushing
npx tsc --noEmit
npx vitest run

# 5. Commit and push
git add -A
git commit -m "fix(store): round product prices to the nearest agora in ILS"
git push -u origin fix/product-price-rounding

# 6. Open PR (gh auto-opens a browser tab to GitHub)
gh pr create --fill
```

---

## Code style

### TypeScript

- `strict: true` — no escape hatches
- Prefer `interface` for public types, `type` for internal unions/aliases
- `as any` is allowed only in test files and with a one-line comment explaining why
- No default exports from lib files (except where Next.js requires it — `page.tsx`, `layout.tsx`)

### React

- Server Components by default. Add `"use client"` only when you need state, effects, or browser APIs
- Props are typed inline unless reused across files
- Hooks named `use*` must be called unconditionally at the top of the component

### CSS / Tailwind

- **Logical properties always** — `ms-*` not `ml-*`, `ps-*` not `pl-*` (we're RTL-first)
- Use `useScreen()` for responsive branching, not inline media queries
- No raw hex colors — use design tokens from `tailwind.config.ts`

### File layout

- One component per file, filename matches default export
- Tests mirror source structure (`lib/foo.ts` → `tests/unit/lib/foo.test.ts`)
- Helpers that are used in >1 file live in `lib/`, not next to their caller

---

## Commit messages

We follow a slightly relaxed **Conventional Commits** style:

```
<type>(<scope>): <short summary under 72 chars>

<optional longer body explaining *why*, not *what*>
```

### Types

| Type | Use when |
|------|----------|
| `feat` | Adds user-visible or API-visible behavior |
| `fix` | Corrects a bug |
| `refactor` | Changes code structure without changing behavior |
| `perf` | Makes something measurably faster |
| `test` | Adds / updates / fixes tests only |
| `docs` | Documentation only |
| `ci` | Changes to `.github/workflows/` or CI tooling |
| `chore` | Tooling, dependencies, repo maintenance |
| `security` | Security-sensitive fix (CVE patch, RLS, auth) |

### Scopes

Optional but encouraged. Common scopes: `store`, `admin`, `crm`, `commissions`, `inbox`, `bot`, `rls`, `staging`, `e2e`.

### Good examples

```
fix(commissions): correct milestone bonus rounding for half-month employees
security(rls): drop FORCE RLS on FK-target tables (was breaking order_items inserts)
test(e2e): tolerate rate-limit 429 from autocomplete under CI load
docs(testing): document the six-layer strategy and alert dedup
```

---

## Pull requests

### Expectations

- **PR title** matches the final squash-merge commit message (same Conventional Commits format)
- **Description** explains *what* and *why* — not just what (the diff shows what)
- **Tests** — every PR adds or modifies at least one test unless it's pure documentation
- **Screenshots** for UI changes (desktop + mobile)
- **Migration checklist** — if touching `supabase/migrations/`, see [Adding a new migration](#adding-a-new-migration)

### PR template

GitHub auto-loads `.github/PULL_REQUEST_TEMPLATE.md`. Fill in every section — "N/A" is a valid answer but "blank" is not.

### What CI enforces

- `npx tsc --noEmit` = 0 errors
- `npx vitest run --coverage` all green
- `npx playwright test --project=chromium-desktop` all green
- `npm run build:next` succeeds
- ESLint warnings are logged but don't block

### What CI doesn't enforce (yet)

- Lighthouse CI — runs only on UI-touching PRs; warnings don't block (except accessibility < 0.85 and CLS > 0.15)
- Visual regression — runs only on UI-touching PRs; failures block
- Mutation testing — weekly, informational

---

## Review expectations

### Minimum 1 approval before merge

Reviewer focuses on:

1. **Intent** — does the change do what the PR description says?
2. **Safety** — any new RLS/auth/payment surface area?
3. **Tests** — does the test suite *actually* prove the change works? (Mutation score helps here)
4. **Readability** — can a stranger understand this in 6 months?

### Self-review before requesting review

Run `git diff main` and read your own changes with fresh eyes. Common catches:
- Debug `console.log` left behind
- Commented-out code
- `@ts-ignore` without explanation
- Copy-pasted test that doesn't actually test the new code path

### Merge strategy

**Squash and merge** is the default. Keep commit history linear on `main`.

---

## Adding a new API route

Example: `POST /api/admin/widgets/reorder`.

```bash
# 1. Create the route
mkdir -p app/api/admin/widgets/reorder
cat > app/api/admin/widgets/reorder/route.ts <<'EOF'
import { NextRequest } from "next/server";
import { z } from "zod";
import { withPermission, logAudit } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";

const schema = z.object({ orderedIds: z.array(z.string().uuid()).min(1) });

export const POST = withPermission("widgets", "edit", async (req: NextRequest, db, user) => {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return apiError("Invalid payload", 400);

    const { orderedIds } = parsed.data;
    for (let i = 0; i < orderedIds.length; i++) {
      const { error } = await db.from("widgets").update({ sort_order: i }).eq("id", orderedIds[i]);
      if (error) return apiError(error.message, 500);
    }

    await logAudit(db, {
      userId: user.appUserId,
      userName: user.name,
      userRole: user.role,
      action: "reorder",
      module: "widgets",
      entityType: "widget",
      details: { count: orderedIds.length },
    });

    return apiSuccess({ reordered: orderedIds.length });
  } catch (err) {
    return apiError(errMsg(err, "Failed to reorder widgets"), 500);
  }
});
EOF

# 2. Add a test
mkdir -p tests/integration/api
cat > tests/integration/api/admin-widgets-reorder.test.ts <<'EOF'
// ... see existing tests for the mocking pattern ...
EOF

# 3. Run the test
npx vitest run tests/integration/api/admin-widgets-reorder.test.ts
```

### Checklist

- [ ] Route wrapped with `withPermission` or `withAdminAuth`
- [ ] Input validated with Zod
- [ ] Writes to `audit_log` for state changes
- [ ] Uses `createAdminSupabase()` for privileged writes (never `createServerSupabase()` or browser client)
- [ ] Returns via `apiSuccess` / `apiError` (never raw `NextResponse.json` for success paths)
- [ ] Test covers: 200 success, 400 validation, 401 unauth, 403 wrong role, 500 DB error

---

## Adding a new page

- **Public page** → add under `app/<path>/page.tsx`. Default to Server Component.
- **Admin page** → add under `app/admin/<path>/page.tsx`. Parent `app/admin/layout.tsx` already enforces auth.
- **Customer page** (requires OTP login) → add under `app/store/<path>/page.tsx` and gate client-side via `localStorage.clal_customer_token`.

All new pages need:
- A test under `tests/pages/<page-name>.test.tsx` that at minimum renders without crashing
- Responsive design verified on mobile via `useScreen()`
- RTL + bilingual strings routed through `useLang().t()`

---

## Adding a new migration

Every change to the DB shape goes through a **new migration file**. We never edit applied migrations.

### Naming

```
supabase/migrations/<YYYYMMDD><HHMMSS>_<short_snake_case>.sql
```

Example: `supabase/migrations/20260418000003_add_widget_sort_order.sql`

### Template

```sql
-- ============================================================================
-- Migration: <one-line description of what and why>
--
-- Touches: <tables>
-- Risk: <low | medium | high — and why>
-- ============================================================================

BEGIN;

-- your DDL here

COMMIT;
```

### Checklist

- [ ] Wrap in `BEGIN; ... COMMIT;` for atomicity
- [ ] `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` where safe — migrations must be idempotent
- [ ] Any new table gets `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` in the same migration
- [ ] New RLS policies use explicit `TO <role>` clauses — no `TO public` unless intentional
- [ ] Add test in `tests/db/migrations.test.ts` if it introduces a new policy or constraint
- [ ] Update `types/database.ts` in the same PR
- [ ] Apply to production via Supabase SQL Editor OR Management API — see [OPERATIONS.md](./OPERATIONS.md#applying-a-migration)

---

## Breaking the rules

Every rule in this document has an exception. If you can explain in your PR description *why* the exception is OK — and the reviewer agrees — you can break the rule.

Examples of legitimate exceptions:
- Skipping a test because the flaky upstream is being investigated (add dated TODO + GitHub issue)
- Using `as any` in non-test code with a comment explaining why TypeScript can't infer the shape
- Bypassing CSRF for a new webhook (if it has its own signature verification)

What's **not** an exception:
- "I'll add the test later" — add the test in the same PR or open a follow-up issue that blocks the next release
- "Just this once" — every "just this once" becomes the convention
- "Reviewer said it's fine" — still write it in the PR description

---

## Getting help

- Architecture questions → [ARCHITECTURE.md](./ARCHITECTURE.md)
- Security questions → [SECURITY.md](./SECURITY.md)
- Testing questions → [TESTING.md](./TESTING.md)
- Operations / incidents → [OPERATIONS.md](./OPERATIONS.md)
- Conventions that aren't in a doc yet → open a GitHub Discussion
