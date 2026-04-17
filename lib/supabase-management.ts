// =====================================================
// ClalMobile — Supabase Management API Client
// Persistent access to Supabase project management
// Uses Personal Access Token (no manual login needed)
// =====================================================

const MANAGEMENT_API_BASE = "https://api.supabase.com/v1";

function getAccessToken(): string {
  return process.env.SUPABASE_ACCESS_TOKEN || "";
}

function getProjectRef(): string {
  // Extract from NEXT_PUBLIC_SUPABASE_URL: https://xxxx.supabase.co → xxxx
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const match = url.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (match) return match[1];
  return process.env.SUPABASE_PROJECT_REF || "";
}

async function mgmtFetch<T = unknown>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: string | null }> {
  const token = getAccessToken();
  if (!token) {
    return { data: null, error: "SUPABASE_ACCESS_TOKEN غير مُعرّف" };
  }

  try {
    const res = await fetch(`${MANAGEMENT_API_BASE}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...options.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text();
      return { data: null, error: `${res.status}: ${body}` };
    }

    const data = (await res.json()) as T;
    return { data, error: null };
  } catch (err) {
    return { data: null, error: err instanceof Error ? err.message : "خطأ غير معروف" };
  }
}

// ===== Project Info =====
export async function getProject() {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}`);
}

// ===== API Keys =====
export async function getApiKeys() {
  const ref = getProjectRef();
  return mgmtFetch<{ name: string; api_key: string }[]>(
    `/projects/${ref}/api-keys`
  );
}

// ===== Database =====
export async function runSql(query: string) {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/database/query`, {
    method: "POST",
    body: JSON.stringify({ query }),
  });
}

// ===== Project Settings =====
export async function getProjectSettings() {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/settings`);
}

// ===== Auth Config =====
export async function getAuthConfig() {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/config/auth`);
}

export async function updateAuthConfig(config: Record<string, unknown>) {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/config/auth`, {
    method: "PATCH",
    body: JSON.stringify(config),
  });
}

// ===== Storage =====
export async function listBuckets() {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/config/storage/buckets`);
}

// ===== Database Migrations =====
export async function getMigrations() {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/database/migrations`);
}

// ===== Functions =====
export async function listFunctions() {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/functions`);
}

// ===== Secrets =====
export async function listSecrets() {
  const ref = getProjectRef();
  return mgmtFetch<{ name: string; value: string }[]>(
    `/projects/${ref}/secrets`
  );
}

export async function updateSecrets(
  secrets: { name: string; value: string }[]
) {
  const ref = getProjectRef();
  return mgmtFetch(`/projects/${ref}/secrets`, {
    method: "POST",
    body: JSON.stringify(secrets),
  });
}

// ===== Health Check =====
export async function checkHealth() {
  const ref = getProjectRef();
  const { data, error } = await mgmtFetch<{
    status: string;
    name: string;
    region: string;
    database: { host: string; version: string };
  }>(`/projects/${ref}`);

  if (error) return { healthy: false, error };
  return {
    healthy: true,
    name: data?.name,
    status: data?.status,
    region: data?.region,
    database: data?.database,
  };
}

// ===== Convenience: Sync env secrets to Supabase =====
export async function syncEnvSecrets(
  envVars: Record<string, string>
) {
  const secrets = Object.entries(envVars).map(([name, value]) => ({
    name,
    value,
  }));
  return updateSecrets(secrets);
}
