// =====================================================
// ClalMobile — Cloudflare R2 Storage Helper
// Upload processed images to R2 with public URL
// Falls back to Supabase Storage if R2 unavailable
// =====================================================

import { uploadImage } from "@/lib/storage";

// R2 S3-compatible endpoint
const R2_ENDPOINT = () => {
  const accountId = process.env.R2_ACCOUNT_ID;
  return accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "";
};

const R2_BUCKET = () => process.env.R2_BUCKET_NAME || "clalmobile-images";
const R2_PUBLIC_URL = () => process.env.R2_PUBLIC_URL || "";

/**
 * Upload image to Cloudflare R2 or fallback to Supabase Storage
 * @returns Public URL of the uploaded image
 */
export async function uploadToR2(
  data: ArrayBuffer | Uint8Array,
  filename: string,
  contentType: string
): Promise<string> {
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretKey = process.env.R2_SECRET_ACCESS_KEY;
  const accountId = process.env.R2_ACCOUNT_ID;
  const publicUrl = R2_PUBLIC_URL();
  const bucket = R2_BUCKET();

  // Try R2 if configured
  if (accessKeyId && secretKey && accountId && publicUrl) {
    try {
      const ext = filename.split(".").pop()?.toLowerCase() || "png";
      const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
      const objectKey = `products/${uniqueName}`;

      // Use S3-compatible PUT with AWS Signature V4
      const url = `${R2_ENDPOINT()}/${bucket}/${objectKey}`;
      const now = new Date();
      const dateStamp = now.toISOString().replace(/[-:T]/g, "").slice(0, 8);
      const amzDate = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
      const region = "auto";
      const service = "s3";

      // Ensure we have a proper Uint8Array for hashing and body
      const bodyBytes = data instanceof Uint8Array ? data : new Uint8Array(data);

      // Build canonical request for AWS Sig V4
      const payloadHash = await sha256Hex(bodyBytes);
      const headers: Record<string, string> = {
        host: `${accountId}.r2.cloudflarestorage.com`,
        "x-amz-date": amzDate,
        "x-amz-content-sha256": payloadHash,
        "content-type": contentType,
        "content-length": bodyBytes.byteLength.toString(),
        "cache-control": "public, max-age=31536000",
      };

      const signedHeaderKeys = Object.keys(headers).sort().join(";");
      const canonicalHeaders = Object.keys(headers)
        .sort()
        .map((k) => `${k}:${headers[k]}`)
        .join("\n") + "\n";

      const canonicalRequest = [
        "PUT",
        `/${bucket}/${objectKey}`,
        "",
        canonicalHeaders,
        signedHeaderKeys,
        payloadHash,
      ].join("\n");

      const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
      const canonReqHash = await sha256Hex(new TextEncoder().encode(canonicalRequest));
      const stringToSign = [
        "AWS4-HMAC-SHA256",
        amzDate,
        credentialScope,
        canonReqHash,
      ].join("\n");

      // Derive signing key
      const kDate = await hmacSha256(new TextEncoder().encode(`AWS4${secretKey}`), dateStamp);
      const kRegion = await hmacSha256(kDate, region);
      const kService = await hmacSha256(kRegion, service);
      const kSigning = await hmacSha256(kService, "aws4_request");
      const signature = await hmacSha256Hex(kSigning, stringToSign);

      const authHeader = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaderKeys}, Signature=${signature}`;

      const res = await fetch(url, {
        method: "PUT",
        headers: {
          ...headers,
          Authorization: authHeader,
        },
        body: bodyBytes.buffer as ArrayBuffer,
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok || res.status === 200) {
        return `${publicUrl}/${objectKey}`;
      }

      const errText = await res.text().catch(() => "");
      console.error(`[R2] Upload failed: ${res.status} ${errText}`);
      // Fall through to Supabase fallback
    } catch (err) {
      console.error("[R2] Upload error:", err);
      // Fall through to Supabase fallback
    }
  }

  // Fallback: Supabase Storage
  console.log("[R2] Not configured, falling back to Supabase Storage");
  const buffer = data instanceof Uint8Array ? data : new Uint8Array(data);
  return uploadImage(buffer, filename, contentType);
}

// ── AWS Sig V4 Helpers (crypto.subtle on Edge) ──

async function sha256Hex(data: Uint8Array): Promise<string> {
  const ab = data.buffer instanceof ArrayBuffer ? data.buffer : new ArrayBuffer(data.byteLength);
  if (!(data.buffer instanceof ArrayBuffer)) new Uint8Array(ab).set(data);
  const hash = await crypto.subtle.digest("SHA-256", ab);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(key: Uint8Array | ArrayBuffer, message: string): Promise<Uint8Array> {
  const keyBuf = key instanceof ArrayBuffer ? key : (key.buffer instanceof ArrayBuffer ? key.buffer : (() => { const b = new ArrayBuffer(key.byteLength); new Uint8Array(b).set(key); return b; })());
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyBuf,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const msgBuf = new TextEncoder().encode(message);
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgBuf.buffer as ArrayBuffer);
  return new Uint8Array(sig);
}

async function hmacSha256Hex(key: Uint8Array | ArrayBuffer, message: string): Promise<string> {
  const sig = await hmacSha256(key, message);
  return Array.from(sig)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
