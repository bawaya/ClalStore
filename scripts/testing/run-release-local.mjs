import process from "node:process";
import { spawn } from "node:child_process";
import net from "node:net";
import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";
import {
  createManifest,
  readManifest,
  recordArtifact,
} from "./manifest-utils.mjs";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("تعذر حجز منفذ محلي حر لحزمة release-local.")));
        return;
      }
      const { port } = address;
      server.close((closeError) => {
        if (closeError) reject(closeError);
        else resolve(port);
      });
    });
  });
}

function randomPassword() {
  return `Clal_${Math.random().toString(36).slice(2, 8)}Aa1!`;
}

function getSupabaseAdminClient() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!url || !key) {
    throw new Error(
      "SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY مطلوبة لتشغيل حزمة release المحلية."
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function spawnCommand(command, args, env = {}) {
  return new Promise((resolve, reject) => {
    const child = process.platform === "win32"
      ? spawn("cmd.exe", ["/c", command, ...args], {
          cwd: process.cwd(),
          stdio: "inherit",
          shell: false,
          env: {
            ...process.env,
            ...env,
          },
        })
      : spawn(command, args, {
          cwd: process.cwd(),
          stdio: "inherit",
          shell: false,
          env: {
            ...process.env,
            ...env,
          },
        });

    child.on("error", reject);
    child.on("close", (code) => resolve(code ?? 1));
  });
}

async function createReleaseAdmin(supabase, runId) {
  const email = `test_admin_${runId.toLowerCase()}@clalmobile.test`;
  const password = randomPassword();

  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: `TEST ${runId}` },
  });

  if (error || !data.user) {
    throw new Error(`تعذر إنشاء مستخدم إداري اختباري: ${error?.message || "unknown"}`);
  }

  const { error: userInsertError } = await supabase.from("users").insert({
    auth_id: data.user.id,
    name: `TEST ${runId}`,
    email,
    role: "super_admin",
    status: "active",
  });

  if (userInsertError) {
    await supabase.auth.admin.deleteUser(data.user.id).catch(() => {});
    throw new Error(`تعذر إنشاء صف users للمستخدم الاختباري: ${userInsertError.message}`);
  }

  return {
    authUserId: data.user.id,
    email,
    password,
  };
}

async function getSettingRow(supabase, key) {
  const { data, error } = await supabase.from("settings").select("key, value, type").eq("key", key).maybeSingle();
  if (error) throw error;
  return data || { key, value: "", type: "string" };
}

async function getIntegrationRow(supabase, type) {
  const { data, error } = await supabase.from("integrations").select("*").eq("type", type).maybeSingle();
  if (error) throw error;
  return data || null;
}

const runId = process.env.TEST_RUN_ID || "";
const localReleasePort = await getFreePort();
const LOCAL_RELEASE_BASE_URL = `http://127.0.0.1:${localReleasePort}`;
const { manifestPath, manifest } = await createManifest({
  runId,
  environment: "local",
  baseUrl: LOCAL_RELEASE_BASE_URL,
  suite: "release-local-foundation",
  actor: "codex",
});

const supabase = getSupabaseAdminClient();
const admin = await createReleaseAdmin(supabase, manifest.runId);

await recordArtifact(manifestPath, {
  kind: "auth_user_delete",
  userId: admin.authUserId,
});

await recordArtifact(manifestPath, {
  kind: "db_delete_eq",
  table: "users",
  column: "auth_id",
  value: admin.authUserId,
});

const storeTaglineAr = await getSettingRow(supabase, "store_tagline_ar");
await recordArtifact(manifestPath, {
  kind: "row_upsert_restore",
  table: "settings",
  onConflict: "key",
  row: storeTaglineAr,
});

const logoRow = await getSettingRow(supabase, "logo_url");
await recordArtifact(manifestPath, {
  kind: "row_upsert_restore",
  table: "settings",
  onConflict: "key",
  row: logoRow,
});

const aiChatIntegration = await getIntegrationRow(supabase, "ai_chat");
if (aiChatIntegration) {
  await recordArtifact(manifestPath, {
    kind: "row_upsert_restore",
    table: "integrations",
    onConflict: "id",
    row: aiChatIntegration,
  });
}

const emailIntegration = await getIntegrationRow(supabase, "email");
if (emailIntegration) {
  await recordArtifact(manifestPath, {
    kind: "row_upsert_restore",
    table: "integrations",
    onConflict: "id",
    row: emailIntegration,
  });
}

const allowLogoUpload = process.env.SKIP_LOGO_UPLOAD === "1" ? false : true;

console.log(`TEST_RUN_ID=${manifest.runId}`);
console.log(`TEST_MANIFEST_PATH=${manifestPath}`);
console.log(`E2E_ADMIN_EMAIL=${admin.email}`);
console.log(`PLAYWRIGHT_TEST_BASE_URL=${LOCAL_RELEASE_BASE_URL}`);

const exitCode = await spawnCommand("npx", ["playwright", "test", "--config=playwright.release-local.config.ts"], {
  TEST_RUN_ID: manifest.runId,
  TEST_MANIFEST_PATH: manifestPath,
  PLAYWRIGHT_TEST_BASE_URL: LOCAL_RELEASE_BASE_URL,
  E2E_ADMIN_EMAIL: admin.email,
  E2E_ADMIN_PASSWORD: admin.password,
  E2E_ALLOW_LOGO_UPLOAD: allowLogoUpload ? "1" : "0",
});

const latestManifest = await readManifest(manifestPath);
console.log("");
console.log(`انتهت الحزمة المحلية برمز خروج ${exitCode}.`);
console.log(`Manifest: ${manifestPath}`);
console.log(`Artifacts: ${latestManifest.artifacts.length}`);
console.log("للتنظيف بعد المراجعة:");
console.log(`npm run test:live:cleanup -- --manifest "${manifestPath}"`);

process.exitCode = exitCode;
