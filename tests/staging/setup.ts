/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Shared staging-test setup.
 *
 * Used by every `tests/staging/**.test.ts` file to:
 *   1. Decide whether to skip the whole file (missing env vars).
 *   2. Lazily create a shared block of TEST_ prefixed rows via `beforeAll`.
 *   3. Guarantee cleanup via `afterAll`, even if tests fail.
 *
 * All data MUST start with TEST_ so `cleanupStagingData()` can remove it.
 */
import { beforeAll, afterAll } from "vitest";
import {
  cleanupStagingData,
  createStagingData,
  getTestSupabaseClient,
  TEST_PREFIX,
} from "@/tests/helpers/db-test-utils";

/**
 * Return a human-readable reason to skip staging tests, or `null` if the
 * environment is fully configured. Callers pass this to `describe.skipIf`.
 */
export function stagingSkipReason(): string | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url) return "SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) not set";
  if (!key) return "SUPABASE_SERVICE_ROLE_KEY not set";
  return null;
}

/** Shape of the shared data the suites can reference. */
export interface StagingContext {
  productIds: string[];
  customerIds: string[];
  orderIds: string[];
  conversationIds: string[];
  couponIds: string[];
}

/**
 * Shared context object — populated in `beforeAll`, cleared in `afterAll`.
 * Tests import this, but should NOT mutate its base rows; each test that
 * needs extra data should create its own TEST_-prefixed rows and clean them
 * locally (or rely on the global afterAll sweep as a safety net).
 */
export const stagingCtx: StagingContext = {
  productIds: [],
  customerIds: [],
  orderIds: [],
  conversationIds: [],
  couponIds: [],
};

/**
 * Call from a `describe` block when you want the shared fixture data.
 * Handles both creation and cleanup. Guaranteed to no-op on skip.
 */
export function useStagingFixtures(): void {
  beforeAll(async () => {
    if (stagingSkipReason()) return;
    const data = await createStagingData();
    Object.assign(stagingCtx, data);
  }, 60_000);

  afterAll(async () => {
    if (stagingSkipReason()) return;
    try {
      await cleanupStagingData();
    } catch (err) {
      console.error("[staging] cleanup error:", err);
    }
    stagingCtx.productIds = [];
    stagingCtx.customerIds = [];
    stagingCtx.orderIds = [];
    stagingCtx.conversationIds = [];
    stagingCtx.couponIds = [];
  }, 60_000);
}

export { getTestSupabaseClient, TEST_PREFIX, cleanupStagingData };
