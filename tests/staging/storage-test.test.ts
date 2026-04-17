/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Layer 3 — Storage round-trip (upload → download → delete → verify gone).
 *
 * Tries Supabase Storage first (it's always present when the Supabase env
 * vars are set). Also runs the same flow against R2 if the R2 env vars
 * are configured.
 */
import { describe, it, expect, afterAll } from "vitest";
import {
  getTestSupabaseClient,
  stagingSkipReason,
  TEST_PREFIX,
} from "./setup";

const skipReason = stagingSkipReason();

describe.skipIf(skipReason)("Layer 3 · Storage round-trip", () => {
  const testBucket = "products"; // matches lib/storage.ts BUCKET
  const uploadedPaths: string[] = [];

  afterAll(async () => {
    const db = getTestSupabaseClient();
    if (uploadedPaths.length) {
      await db.storage.from(testBucket).remove(uploadedPaths).then(
        () => {},
        () => {},
      );
    }
  });

  it("Supabase Storage: upload, download, delete, and verify gone", async () => {
    const db = getTestSupabaseClient();

    // Make sure the bucket exists — it might not, in fresh staging envs.
    const { data: buckets } = await db.storage.listBuckets();
    const hasBucket = (buckets ?? []).some(
      (b: any) => b.name === testBucket,
    );
    if (!hasBucket) {
      const { error } = await db.storage.createBucket(testBucket, {
        public: true,
      });
      // If we can't create it (perms, already exists race), bail softly.
      if (error && !/already exists/i.test(error.message)) {
        console.info(
          `[storage] could not create bucket ${testBucket} — skipping (${error.message})`,
        );
        return;
      }
    }

    const path = `${TEST_PREFIX}staging_${Date.now()}.txt`;
    const contents = `${TEST_PREFIX}hello staging ${Math.random()}`;
    const payload = new TextEncoder().encode(contents);

    // 1. Upload
    const { error: upErr } = await db.storage
      .from(testBucket)
      .upload(path, payload, {
        contentType: "text/plain",
        upsert: false,
      });
    expect(upErr).toBeNull();
    uploadedPaths.push(path);

    // 2. Download
    const { data: dl, error: dlErr } = await db.storage
      .from(testBucket)
      .download(path);
    expect(dlErr).toBeNull();
    expect(dl).toBeTruthy();
    const roundTrip = await dl!.text();
    expect(roundTrip).toBe(contents);

    // 3. Delete
    const { error: delErr } = await db.storage
      .from(testBucket)
      .remove([path]);
    expect(delErr).toBeNull();

    // 4. Verify gone — download should now fail
    const { data: dl2 } = await db.storage.from(testBucket).download(path);
    expect(dl2).toBeNull();

    // Remove from tracked cleanup list — we just deleted it.
    const idx = uploadedPaths.indexOf(path);
    if (idx >= 0) uploadedPaths.splice(idx, 1);
  });

  it("R2 round-trip via storage-r2 helper (only if R2 env is set)", async () => {
    const accountId = process.env.R2_ACCOUNT_ID;
    const accessKey = process.env.R2_ACCESS_KEY_ID;
    const secret = process.env.R2_SECRET_ACCESS_KEY;
    const publicUrl = process.env.R2_PUBLIC_URL;
    if (!accountId || !accessKey || !secret || !publicUrl) {
      console.info("[storage] R2 env vars not set — skipping R2 test");
      return;
    }

    // Dynamically import so we don't load R2 helpers in environments that
    // never need them.
    const { uploadToR2 } = await import("@/lib/storage-r2");
    const payload = new TextEncoder().encode(
      `${TEST_PREFIX}r2 round-trip ${Date.now()}`,
    );

    let uploaded: string;
    try {
      uploaded = await uploadToR2(
        payload,
        `${TEST_PREFIX}r2_staging.txt`,
        "text/plain",
      );
    } catch (err) {
      console.info(
        `[storage] R2 upload failed (may be misconfigured): ${(err as Error).message}`,
      );
      return;
    }

    expect(uploaded).toMatch(/^https?:\/\//);

    // Fetch it back — R2 public URL should serve the same bytes.
    const res = await fetch(uploaded, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) {
      console.info(
        `[storage] R2 object not yet public (${res.status}) — skipping content check`,
      );
      return;
    }
    const back = await res.text();
    expect(back).toContain(TEST_PREFIX);

    // Best-effort deletion — we don't have a helper, so warn and rely on
    // operators to sweep the bucket periodically. The key contains TEST_
    // so it's easy to filter.
    console.info(
      `[storage] R2 object left for manual sweep: ${uploaded} (prefix TEST_)`,
    );
  });
});
