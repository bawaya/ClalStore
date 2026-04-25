import { createAdminSupabase } from "@/lib/supabase";
import type { Integration, IntegrationSecret } from "@/types/database";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

export const INTEGRATION_SECRET_MASK = "••••••••";
export const INTEGRATION_SECRET_KEY_VERSION = 1;

export const SENSITIVE_INTEGRATION_KEYS = new Set([
  "api_key",
  "auth_token",
  "secret_key",
  "password",
  "access_token",
  "client_secret",
  "verify_token",
  "project_token",
  "private_key",
  "token",
]);

type SecretRowMap = Record<string, IntegrationSecret>;

function isMissingIntegrationSecretsTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;

  const maybeError = error as { code?: string; message?: string; details?: string };
  const text = `${maybeError.message || ""} ${maybeError.details || ""}`.toLowerCase();

  return maybeError.code === "42P01" || text.includes("integration_secrets");
}

function db() {
  const client = createAdminSupabase();
  if (!client) {
    throw new Error("Supabase admin client is unavailable");
  }
  return client;
}

function getMasterKey(): string {
  return (process.env.INTEGRATIONS_MASTER_KEY || "").trim();
}

function requireMasterKey(): string {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new Error("INTEGRATIONS_MASTER_KEY is not configured");
  }
  return masterKey;
}

function toBase64(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  return Buffer.from(bytes).toString("base64");
}

function fromBase64(value: string): ArrayBuffer {
  const bytes = Uint8Array.from(Buffer.from(value, "base64"));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

async function deriveEncryptionKey(masterKey: string): Promise<CryptoKey> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(masterKey));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function buildMaskedValue(valueHint?: string | null): string {
  return valueHint ? `${INTEGRATION_SECRET_MASK}${valueHint}` : INTEGRATION_SECRET_MASK;
}

export function isSensitiveIntegrationKey(key: string): boolean {
  return SENSITIVE_INTEGRATION_KEYS.has(key);
}

export function isMaskedIntegrationSecret(value: unknown): boolean {
  return typeof value === "string" && value.includes(INTEGRATION_SECRET_MASK);
}

export function hasIntegrationVaultKey(): boolean {
  return getMasterKey().length > 0;
}

export async function encryptIntegrationSecret(value: string): Promise<{
  encryptedValue: string;
  valueHint: string | null;
  keyVersion: number;
}> {
  const masterKey = requireMasterKey();
  const key = await deriveEncryptionKey(masterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(value)
  );

  return {
    encryptedValue: `${toBase64(iv)}.${toBase64(cipher)}`,
    valueHint: value.length > 4 ? value.slice(-4) : value || null,
    keyVersion: INTEGRATION_SECRET_KEY_VERSION,
  };
}

export async function decryptIntegrationSecret(encryptedValue: string): Promise<string> {
  const masterKey = requireMasterKey();
  const key = await deriveEncryptionKey(masterKey);
  const [ivBase64, cipherBase64] = encryptedValue.split(".");

  if (!ivBase64 || !cipherBase64) {
    throw new Error("Encrypted integration secret payload is invalid");
  }

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: new Uint8Array(fromBase64(ivBase64)) },
    key,
    fromBase64(cipherBase64)
  );

  return decoder.decode(plain);
}

async function getIntegrationRecordById(id: string): Promise<Integration | null> {
  const { data, error } = await db().from("integrations").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Integration | null) || null;
}

async function listIntegrationSecretsForIds(integrationIds: string[]): Promise<IntegrationSecret[]> {
  if (integrationIds.length === 0) return [];

  const { data, error } = await db()
    .from("integration_secrets")
    .select("*")
    .in("integration_id", integrationIds);

  if (error) {
    if (isMissingIntegrationSecretsTable(error)) {
      console.warn("integration_secrets table is not available yet — falling back to legacy integration.config");
      return [];
    }
    throw error;
  }

  return (data || []) as IntegrationSecret[];
}

async function isIntegrationSecretsTableAvailable(): Promise<boolean> {
  const { error } = await db().from("integration_secrets").select("id").limit(1);
  if (!error) return true;
  if (isMissingIntegrationSecretsTable(error)) return false;
  throw error;
}

export async function getIntegrationByTypeWithSecrets(type: string): Promise<{
  integration: Integration | null;
  config: Record<string, any>;
  secretRows: SecretRowMap;
}> {
  const { data, error } = await db().from("integrations").select("*").eq("type", type).maybeSingle();
  if (error) throw error;

  const integration = (data as Integration | null) || null;
  if (!integration) {
    return { integration: null, config: {}, secretRows: {} };
  }

  return getIntegrationByIdWithSecrets(integration.id);
}

export async function getIntegrationByIdWithSecrets(id: string): Promise<{
  integration: Integration | null;
  config: Record<string, any>;
  secretRows: SecretRowMap;
}> {
  const integration = await getIntegrationRecordById(id);
  if (!integration) {
    return { integration: null, config: {}, secretRows: {} };
  }

  const secretRows = (await listIntegrationSecretsForIds([id])).reduce<SecretRowMap>((acc, row) => {
    acc[row.secret_key] = row;
    return acc;
  }, {});

  const config = { ...(integration.config || {}) };

  for (const [secretKey, secretRow] of Object.entries(secretRows)) {
    try {
      config[secretKey] = await decryptIntegrationSecret(secretRow.encrypted_value);
    } catch (error) {
      console.error(`Failed to decrypt integration secret ${integration.type}.${secretKey}:`, error);
    }
  }

  return { integration, config, secretRows };
}

export async function maskIntegrationsForAdmin(integrations: Integration[]): Promise<Integration[]> {
  if (integrations.length === 0) return integrations;

  const integrationIds = integrations.map((integration) => integration.id);
  const secretMap = (await listIntegrationSecretsForIds(integrationIds)).reduce<Record<string, SecretRowMap>>(
    (acc, row) => {
      if (!acc[row.integration_id]) acc[row.integration_id] = {};
      acc[row.integration_id][row.secret_key] = row;
      return acc;
    },
    {}
  );

  return integrations.map((integration) => {
    const maskedConfig: Record<string, any> = { ...(integration.config || {}) };

    for (const [key, value] of Object.entries(maskedConfig)) {
      if (isSensitiveIntegrationKey(key) && typeof value === "string" && value.length > 0) {
        maskedConfig[key] = buildMaskedValue(value.length > 4 ? value.slice(-4) : value);
        maskedConfig[`_has_${key}`] = true;
      }
    }

    const secretRows = secretMap[integration.id] || {};
    for (const [secretKey, secretRow] of Object.entries(secretRows)) {
      maskedConfig[secretKey] = buildMaskedValue(secretRow.value_hint);
      maskedConfig[`_has_${secretKey}`] = true;
    }

    return {
      ...integration,
      config: maskedConfig,
    };
  });
}

export async function resolveIntegrationConfigForRequest(
  type: string,
  incomingConfig: Record<string, any>
): Promise<{
  integration: Integration | null;
  provider: string;
  config: Record<string, any>;
}> {
  const { integration, config: runtimeConfig } = await getIntegrationByTypeWithSecrets(type);
  const resolved = { ...incomingConfig };

  for (const [key, value] of Object.entries(resolved)) {
    if (isMaskedIntegrationSecret(value)) {
      resolved[key] = runtimeConfig[key] || "";
    }
  }

  return {
    integration,
    provider: integration?.provider || "",
    config: resolved,
  };
}

export async function prepareIntegrationConfigForUpdate(params: {
  integrationId: string;
  config: Record<string, any>;
  updatedBy?: string | null;
}): Promise<Record<string, any>> {
  const { integration, config: runtimeConfig, secretRows } = await getIntegrationByIdWithSecrets(
    params.integrationId
  );

  if (!integration) {
    throw new Error("Integration not found");
  }

  const publicConfig: Record<string, any> = {};
  const secretsToUpsert: Array<{ secretKey: string; value: string }> = [];
  const secretsToDelete: string[] = [];
  const vaultAvailable = await isIntegrationSecretsTableAvailable();

  for (const [key, rawValue] of Object.entries(params.config || {})) {
    if (key.startsWith("_has_")) continue;

    if (!isSensitiveIntegrationKey(key)) {
      publicConfig[key] = rawValue;
      continue;
    }

    if (isMaskedIntegrationSecret(rawValue)) {
      if (!secretRows[key] && typeof runtimeConfig[key] === "string" && runtimeConfig[key]) {
        if (vaultAvailable && hasIntegrationVaultKey()) {
          secretsToUpsert.push({ secretKey: key, value: runtimeConfig[key] });
        } else if (typeof integration.config?.[key] === "string" && integration.config[key]) {
          publicConfig[key] = integration.config[key];
        }
      }
      continue;
    }

    if (typeof rawValue !== "string") continue;

    const value = rawValue.trim();
    if (!value) {
      secretsToDelete.push(key);
      continue;
    }

    if (!vaultAvailable) {
      publicConfig[key] = value;
      continue;
    }

    if (!hasIntegrationVaultKey()) {
      console.warn(
        `INTEGRATIONS_MASTER_KEY is missing â€” saving ${integration.type}.${key} in legacy integration.config until the vault key is configured`
      );
      publicConfig[key] = value;
      continue;
    }

    secretsToUpsert.push({ secretKey: key, value });
  }

  if (secretsToDelete.length > 0) {
    const { error } = await db()
      .from("integration_secrets")
      .delete()
      .eq("integration_id", params.integrationId)
      .in("secret_key", secretsToDelete);

    if (error && !isMissingIntegrationSecretsTable(error)) throw error;
  }

  for (const secret of secretsToUpsert) {
    const encrypted = await encryptIntegrationSecret(secret.value);
    const payload: Record<string, unknown> = {
      integration_id: params.integrationId,
      secret_key: secret.secretKey,
      encrypted_value: encrypted.encryptedValue,
      value_hint: encrypted.valueHint,
      key_version: encrypted.keyVersion,
      updated_at: new Date().toISOString(),
      updated_by: params.updatedBy || null,
    };

    const { error } = await db()
      .from("integration_secrets")
      .upsert(payload, { onConflict: "integration_id,secret_key" });

    if (error) {
      if (isMissingIntegrationSecretsTable(error)) {
        publicConfig[secret.secretKey] = secret.value;
        continue;
      }
      throw error;
    }
  }

  return publicConfig;
}
