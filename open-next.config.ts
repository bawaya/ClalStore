// =====================================================
// ClalMobile — OpenNext for Cloudflare config.
//
// `r2IncrementalCache` keeps ISR pages in our R2 bucket
// (`clalstore-opennext-cache`) so subsequent requests serve from cache
// without re-rendering on every Worker invocation.
//
// `memoryQueue` is the revalidation queue. Without it, OpenNext falls
// back to a `dummy` queue that THROWS on every revalidation, flooding
// `wrangler tail` with `FatalError: Dummy queue is not implemented`
// and blocking ISR background refresh. The memory queue piggybacks on
// the existing `WORKER_SELF_REFERENCE` service binding and revalidates
// by hitting the worker's own URL — zero extra Cloudflare resources
// required.
//
// Trade-off vs `doQueue` (Durable Object queue): memory dedup is
// per-isolate, so a page being revalidated could fan out to multiple
// concurrent re-renders if requests hit different isolates. For
// ClalMobile's traffic this is fine; if it ever bites, swap to
// `doQueue` and add the `durable_objects` binding to `wrangler.json`.
// =====================================================

import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";
import memoryQueue from "@opennextjs/cloudflare/overrides/queue/memory-queue";

export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
  queue: memoryQueue,
});
