# Database Consistency Protocol

> This protocol keeps the Supabase schema, TypeScript row shapes, source queries, and test fixtures aligned. It exists to stop “schema lag” from reaching runtime, especially in sensitive paths like `users`, `integrations`, commissions, and sales documents.

## Why this exists

Three kinds of drift kept appearing in the codebase:

1. **Migration drift**: a column exists in SQL but not in `types/database.ts`.
2. **Code drift**: route handlers or services query columns that the row type does not declare.
3. **Fixture drift**: test factories generate outdated rows, so tests pass against shapes that no longer match production reality.

The goal of this protocol is to catch all three before deployment.

## Truth chain

Every schema change is only considered complete when it updates all four layers:

1. **SQL migrations** in [C:\CLALSTORE\clalmobile\supabase\migrations](/C:/CLALSTORE/clalmobile/supabase/migrations)
2. **TypeScript row shapes** in [C:\CLALSTORE\clalmobile\types\database.ts](/C:/CLALSTORE/clalmobile/types/database.ts)
3. **Critical table contracts** in [C:\CLALSTORE\clalmobile\lib\schema-contracts.ts](/C:/CLALSTORE/clalmobile/lib/schema-contracts.ts)
4. **Factories / tests** in [C:\CLALSTORE\clalmobile\tests\helpers\factories.ts](/C:/CLALSTORE/clalmobile/tests/helpers/factories.ts) and [C:\CLALSTORE\clalmobile\tests\db\schema-contracts.test.ts](/C:/CLALSTORE/clalmobile/tests/db/schema-contracts.test.ts)

If one layer changes and the others do not, the change is incomplete.

## Enforced checks

The contract test in [C:\CLALSTORE\clalmobile\tests\db\schema-contracts.test.ts](/C:/CLALSTORE/clalmobile/tests/db/schema-contracts.test.ts) currently enforces:

- Critical tables are present in `Database.public.Tables`
- Critical tables map to the correct row types
- Required columns exist in the row type
- Matching test factories include those columns
- Migration corpus contains explicit evidence for the critical columns
- Source files under `app/` and `lib/` only call `.from("table")` on declared public tables
- Simple `.select("col1, col2")` clauses only reference declared row-type columns

## Current critical coverage

Phase 1 coverage is intentionally focused on tables where drift is most dangerous or has already happened:

- `users`
- `settings`
- `integrations`
- `integration_secrets`
- `products`
- `orders`
- `customers`
- `commission_sales`
- `sales_docs`

Phase 2 expands that contract set to the full CRM inbox family:

- `inbox_conversations`
- `inbox_messages`
- `inbox_labels`
- `inbox_conversation_labels`
- `inbox_notes`
- `inbox_templates`
- `inbox_quick_replies`
- `inbox_events`

These are defined centrally in [C:\CLALSTORE\clalmobile\lib\schema-contracts.ts](/C:/CLALSTORE/clalmobile/lib/schema-contracts.ts).

## Required workflow for schema changes

When adding or changing a column:

1. Add the SQL migration
2. Update the row type in `types/database.ts`
3. Update or add the contract entry in `lib/schema-contracts.ts`
4. Update the matching factory in `tests/helpers/factories.ts`
5. Update any type or integration tests that assert the old shape
6. Run:
   - `npm run test:db:contracts`
   - `npm run build`

No schema change should be declared “done” before those pass.

## Live parity layer

The contract gate above proves consistency between:

- migrations
- TypeScript row types
- source queries
- factories and test shapes

It does **not** by itself prove that the currently deployed Supabase database has already received every migration.

For that, use the live parity suite:

```bash
npm run test:db:live-parity
```

That suite connects read-only to the real database metadata and verifies, for critical tables:

- the table exists live
- the live column set matches the row type
- the contract-required columns exist live

It also prints a **report-only** list of nullability drift. We do not gate on nullability yet because parts of the application still rely on normalized runtime assumptions for older nullable columns. Column presence is the hard gate; nullability is currently a tracked finding.

Example: after inbox coverage was added, live parity immediately exposed that `inbox_conversations.sentiment`
was still missing on the live database even though it already existed in the migration history and row types.
That gap was closed with a dedicated live parity hotfix. The remaining inbox findings are currently
**nullability-only** and are separately checked by the live-data parity suite.

It uses:

- `DATABASE_URL` if available
- otherwise `SUPABASE_ACCESS_TOKEN` plus `NEXT_PUBLIC_SUPABASE_URL` or `SUPABASE_PROJECT_REF`

## Live data parity layer

When the live schema still allows `NULL` in fields that the application row types treat as required, we verify the
deployed **data** separately:

```bash
npm run test:db:live-data-parity
```

That suite counts live `NULL` rows for every critical-table field where:

- the database says `is_nullable = YES`
- but the matching TypeScript row type still treats the field as required

It fails if current live rows already violate the required application shape. This gives us a real production truth
check for data integrity, even before we harden the schema with `NOT NULL` constraints or relax the types.

## Important limitation

This protocol currently verifies **column presence and query compatibility**, not full DDL parity.

It does **not yet** guarantee:

- nullability parity
- default value parity
- index parity
- foreign-key parity
- full production schema parity for every table outside the current critical contract set

Those belong to the next phase and should be layered on top of this contract, not assumed from it.

## Known example this protocol now catches

The following kinds of drift are now caught immediately:

- `users.must_change_password` exists in migrations and runtime code, but is missing from `AppUser`
- `sales_docs.status` gains `cancelled` in SQL, but the row type still exposes the old union
- `commission_sales.source_sales_doc_id` is queried in code, but absent from the row type
- a test factory still returns a pre-migration row shape

## Command

Use:

```bash
npm run test:db:contracts
```

That command is the minimum gate for database/code consistency before broader flow testing.
