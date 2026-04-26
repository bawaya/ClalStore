import process from "node:process";
import { createClient } from "@supabase/supabase-js";
import {
  normalizeManifestPath,
  readManifest,
  updateCleanupReport,
} from "./manifest-utils.mjs";

function getArg(name) {
  const index = process.argv.indexOf(name);
  if (index === -1) return "";
  return process.argv[index + 1] || "";
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبة لتنظيف بيانات الفحص."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function parseSupabasePublicUrl(url) {
  const match = url.match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/);
  if (!match) return null;
  return {
    bucket: match[1],
    path: match[2],
  };
}

async function cleanupArtifact(supabase, artifact) {
  switch (artifact.kind) {
    case "row_upsert_restore": {
      const { error } = await supabase
        .from(artifact.table)
        .upsert(artifact.row, { onConflict: artifact.onConflict || "id" });
      if (error) throw error;
      return `restored row in ${artifact.table}`;
    }

    case "row_update_restore": {
      const { error } = await supabase
        .from(artifact.table)
        .update(artifact.row)
        .eq(artifact.matchColumn, artifact.matchValue);
      if (error) throw error;
      return `updated row in ${artifact.table}`;
    }

    case "db_delete_eq": {
      const { error } = await supabase
        .from(artifact.table)
        .delete()
        .eq(artifact.column, artifact.value);
      if (error) throw error;
      return `deleted eq rows from ${artifact.table}`;
    }

    case "db_delete_like": {
      const { error } = await supabase
        .from(artifact.table)
        .delete()
        .like(artifact.column, artifact.value);
      if (error) throw error;
      return `deleted like rows from ${artifact.table}`;
    }

    case "storage_remove_path": {
      const { error } = await supabase.storage.from(artifact.bucket).remove([artifact.path]);
      if (error) throw error;
      return `removed storage path ${artifact.bucket}/${artifact.path}`;
    }

    case "storage_remove_public_url": {
      const parsed = parseSupabasePublicUrl(artifact.url);
      const bucket = artifact.bucket || parsed?.bucket;
      const path = artifact.path || parsed?.path;
      if (!bucket || !path) {
        throw new Error("تعذر تحليل bucket/path من رابط التخزين العام.");
      }
      const { error } = await supabase.storage.from(bucket).remove([path]);
      if (error) throw error;
      return `removed storage url ${bucket}/${path}`;
    }

    case "note":
      return "note only";

    default:
      throw new Error(`نوع artifact غير مدعوم: ${artifact.kind}`);
  }
}

const manifestPath = normalizeManifestPath(getArg("--manifest") || process.env.TEST_MANIFEST_PATH || "");
const dryRun = process.argv.includes("--dry-run");
if (!manifestPath) {
  throw new Error("يجب تمرير TEST_MANIFEST_PATH أو --manifest لتشغيل التنظيف.");
}

const manifest = await readManifest(manifestPath);
const supabase = dryRun ? null : getSupabaseAdminClient();
const startedAt = new Date().toISOString();
const results = [];

for (const artifact of [...manifest.artifacts].reverse()) {
  try {
    const detail = dryRun
      ? `dry-run: ${artifact.kind}`
      : await cleanupArtifact(supabase, artifact);
    results.push({
      artifactId: artifact.id,
      kind: artifact.kind,
      ok: true,
      detail,
      cleanedAt: new Date().toISOString(),
    });
  } catch (error) {
    results.push({
      artifactId: artifact.id,
      kind: artifact.kind,
      ok: false,
      detail: error instanceof Error ? error.message : "خطأ غير معروف",
      cleanedAt: new Date().toISOString(),
    });
  }
}

const failed = results.filter((item) => !item.ok).length;
await updateCleanupReport(manifestPath, {
  startedAt,
  finishedAt: new Date().toISOString(),
  status: dryRun ? "dry_run" : failed === 0 ? "success" : "partial_failure",
  results,
});

console.log(`تمت محاولة تنظيف ${results.length} أثر/آثار من الجولة ${manifest.runId}.`);
console.log(`نجاح: ${results.length - failed} | فشل: ${failed}${dryRun ? " | الوضع: dry-run" : ""}`);

if (failed > 0) {
  process.exitCode = 1;
}
