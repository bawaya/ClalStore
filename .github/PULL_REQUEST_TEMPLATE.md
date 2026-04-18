<!--
  Thanks for contributing to ClalMobile!
  Fill in every section — write "N/A" if a section doesn't apply, but don't leave any blank.
-->

## Summary

<!-- What does this PR do, in one paragraph? -->

## Why

<!--
  The business or technical reason. What problem is this solving?
  If linking an issue, use "Closes #123" so it auto-closes on merge.
-->

## Type of change

- [ ] `feat` — adds user-visible or API-visible behavior
- [ ] `fix` — corrects a bug
- [ ] `refactor` — no behavior change
- [ ] `perf` — measurably faster
- [ ] `test` — tests only
- [ ] `docs` — documentation only
- [ ] `ci` — CI / tooling / workflows
- [ ] `security` — security-sensitive fix
- [ ] `chore` — repo maintenance

## Testing

<!-- Describe what you did to verify this works. -->

- [ ] `npx tsc --noEmit` passes with 0 errors
- [ ] `npx vitest run` passes
- [ ] Added/updated test(s) for the change — list them:
  - `tests/...`
- [ ] Manually verified in browser (attach screenshots below for UI changes)
- [ ] If migration included: applied to production staging and RLS contract tests pass

## Screenshots / screen recordings

<!--
  For UI changes: desktop + mobile, both Arabic and Hebrew if relevant.
  For API changes: curl example of the new endpoint.
-->

## Security checklist

<!-- Only required if touching auth, RLS, payments, or secrets. -->

- [ ] No hardcoded secrets / API keys
- [ ] New route is wrapped with `withPermission` or `withAdminAuth` if admin-facing
- [ ] Input validated with Zod
- [ ] RLS policy added/updated for any new table
- [ ] CSRF token required for any new state-changing endpoint
- [ ] No new `TO public` policies unless intentional + justified below

## Migration checklist

<!-- Only required if touching supabase/migrations/. -->

- [ ] Migration file named `<YYYYMMDD><HHMMSS>_<snake_case>.sql`
- [ ] Wrapped in `BEGIN; ... COMMIT;`
- [ ] Uses `IF EXISTS` / `IF NOT EXISTS` where safe — idempotent
- [ ] `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` on any new table
- [ ] `types/database.ts` updated to match
- [ ] Applied to production via SQL Editor / Management API (describe when):

## Deployment notes

<!--
  Anything the reviewer/merger needs to do around merge time?
  (e.g., "requires CRON_SECRET rotation", "needs Cloudflare env var X set first")
-->

## Rollback plan

<!--
  How do we undo this if it breaks prod?
  For most PRs: "git revert this commit".
  For migrations: describe the reverse DDL or data preservation strategy.
-->
