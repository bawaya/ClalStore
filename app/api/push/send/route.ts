export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";
import { apiSuccess, apiError, errMsg } from "@/lib/api-response";
import { getIntegrationConfig } from "@/lib/integrations/hub";

// ── Web Push helpers (Edge-compatible, no web-push npm package) ──

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function uint8ToUrlBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function importVapidKeys(publicKeyB64: string, privateKeyB64: string) {
  const pubRaw = urlBase64ToUint8Array(publicKeyB64);
  const privRaw = urlBase64ToUint8Array(privateKeyB64);

  // Build uncompressed public key (65 bytes)
  const pubUncompressed = pubRaw.length === 65 ? pubRaw : pubRaw;

  // Build JWK for private key (ECDSA P-256)
  const x = uint8ToUrlBase64(pubUncompressed.slice(1, 33));
  const y = uint8ToUrlBase64(pubUncompressed.slice(33, 65));
  const d = uint8ToUrlBase64(privRaw);

  const privateKey = await crypto.subtle.importKey(
    "jwk",
    { kty: "EC", crv: "P-256", x, y, d },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
  return { privateKey, publicKeyRaw: pubUncompressed };
}

async function createVapidAuthHeader(
  audience: string,
  subject: string,
  publicKeyB64: string,
  privateKeyB64: string
) {
  const { privateKey, publicKeyRaw } = await importVapidKeys(publicKeyB64, privateKeyB64);

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 12 * 3600, sub: subject };

  const enc = new TextEncoder();
  const jwtUnsigned =
    uint8ToUrlBase64(enc.encode(JSON.stringify(header))) +
    "." +
    uint8ToUrlBase64(enc.encode(JSON.stringify(payload)));

  const sigBuf = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(jwtUnsigned)
  );

  // Convert DER signature to raw r||s (64 bytes)
  const sig = new Uint8Array(sigBuf);
  let r: Uint8Array, s: Uint8Array;
  if (sig.length === 64) {
    r = sig.slice(0, 32);
    s = sig.slice(32);
  } else {
    // DER encoding
    const rLen = sig[3];
    const rStart = 4 + (rLen - 32);
    r = sig.slice(rStart, rStart + 32);
    const sOffset = 4 + rLen;
    const sLen = sig[sOffset + 1];
    const sStart = sOffset + 2 + (sLen - 32);
    s = sig.slice(sStart, sStart + 32);
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  const jwt = jwtUnsigned + "." + uint8ToUrlBase64(rawSig);
  const k = uint8ToUrlBase64(publicKeyRaw);

  return `vapid t=${jwt}, k=${k}`;
}

async function sendPushNotification(
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  payloadStr: string,
  vapidPublicKey: string,
  vapidPrivateKey: string,
  vapidSubject: string
): Promise<{ ok: boolean; status: number }> {
  const url = new URL(subscription.endpoint);
  const audience = `${url.protocol}//${url.host}`;

  const authorization = await createVapidAuthHeader(
    audience,
    vapidSubject,
    vapidPublicKey,
    vapidPrivateKey
  );

  // Encrypt payload using ECDH + HKDF (RFC 8291)
  const clientPublicKey = urlBase64ToUint8Array(subscription.keys.p256dh);
  const clientAuth = urlBase64ToUint8Array(subscription.keys.auth);

  // Generate ephemeral ECDH key pair
  const ephemeral = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"]
  );
  const ephemeralPubRaw = new Uint8Array(
    await crypto.subtle.exportKey("raw", ephemeral.publicKey)
  );

  // Import client public key
  const clientKey = await crypto.subtle.importKey(
    "raw",
    clientPublicKey.buffer as ArrayBuffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );

  // ECDH shared secret
  const sharedBits = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: clientKey },
      ephemeral.privateKey,
      256
    )
  );

  const enc = new TextEncoder();

  // HKDF helper — RFC 5869: Extract uses salt as HMAC key, IKM as message
  async function hkdfSha256(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) {
    const saltKey = salt.length
      ? await crypto.subtle.importKey("raw", salt.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"])
      : await crypto.subtle.importKey("raw", new Uint8Array(32), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const prk = new Uint8Array(await crypto.subtle.sign("HMAC", saltKey, ikm.buffer as ArrayBuffer));
    const prkKey = await crypto.subtle.importKey("raw", prk.buffer as ArrayBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const infoWithCounter = new Uint8Array(info.length + 1);
    infoWithCounter.set(info);
    infoWithCounter[info.length] = 1;
    const okm = new Uint8Array(await crypto.subtle.sign("HMAC", prkKey, infoWithCounter));
    return okm.slice(0, length);
  }

  // Build info strings per RFC 8291
  function buildInfo(type: string, clientPub: Uint8Array, serverPub: Uint8Array) {
    const prefix = enc.encode(`Content-Encoding: ${type}\0P-256\0`);
    const result = new Uint8Array(prefix.length + 2 + clientPub.length + 2 + serverPub.length);
    let offset = 0;
    result.set(prefix, offset); offset += prefix.length;
    result[offset++] = 0; result[offset++] = clientPub.length;
    result.set(clientPub, offset); offset += clientPub.length;
    result[offset++] = 0; result[offset++] = serverPub.length;
    result.set(serverPub, offset);
    return result;
  }

  // PRK for key and nonce derivation
  const authInfo = enc.encode("Content-Encoding: auth\0");
  const prk = await hkdfSha256(sharedBits, clientAuth, authInfo, 32);

  const keyInfo = buildInfo("aesgcm", clientPublicKey, ephemeralPubRaw);
  const nonceInfo = buildInfo("nonce", clientPublicKey, ephemeralPubRaw);

  const contentKey = await hkdfSha256(prk, new Uint8Array(0), keyInfo, 16);
  const nonce = await hkdfSha256(prk, new Uint8Array(0), nonceInfo, 12);

  // Add padding (2 bytes of padding length = 0)
  const payloadBytes = enc.encode(payloadStr);
  const paddedPayload = new Uint8Array(2 + payloadBytes.length);
  paddedPayload[0] = 0;
  paddedPayload[1] = 0;
  paddedPayload.set(payloadBytes, 2);

  // AES-128-GCM encrypt
  const aesKey = await crypto.subtle.importKey("raw", contentKey, { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, paddedPayload)
  );

  const res = await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Encoding": "aesgcm",
      "Crypto-Key": `dh=${uint8ToUrlBase64(ephemeralPubRaw)}`,
      Encryption: `salt=${uint8ToUrlBase64(crypto.getRandomValues(new Uint8Array(16)))}`,
      "Content-Type": "application/octet-stream",
      TTL: "86400",
    },
    body: encrypted,
  });

  return { ok: res.ok, status: res.status };
}

// POST — Admin: Send push notification to all subscribers
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiError("DB unavailable", 500);

    const body = await req.json();
    const { title, body: notifBody, url, icon } = body;

    if (!title || !notifBody) {
      return apiError("Missing title or body", 400);
    }

    const pushCfg = await getIntegrationConfig("push_notifications");
    const vapidPublicKey = pushCfg.public_key || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivateKey = pushCfg.private_key || process.env.VAPID_PRIVATE_KEY;
    const vapidSubject = pushCfg.subject || process.env.VAPID_SUBJECT || "mailto:info@clalmobile.com";

    if (!vapidPublicKey || !vapidPrivateKey) {
      return apiError("VAPID keys not configured", 500);
    }

    // Get all active subscriptions
    const { data: subs } = await db.from("push_subscriptions")
      .select("*")
      .eq("active", true);

    const subscribers = subs || [];
    const payload = JSON.stringify({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.png",
    });

    // Send to all subscribers, collect results
    let sent = 0;
    let failed = 0;
    const staleIds: string[] = [];

    await Promise.allSettled(
      subscribers.map(async (sub: any) => {
        try {
          const result = await sendPushNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload,
            vapidPublicKey,
            vapidPrivateKey,
            vapidSubject
          );
          if (result.ok) {
            sent++;
          } else {
            if (result.status === 410) staleIds.push(sub.id);
            failed++;
          }
        } catch {
          failed++;
        }
      })
    );

    // Deactivate stale subscriptions
    if (staleIds.length > 0) {
      await db.from("push_subscriptions")
        .update({ active: false })
        .in("id", staleIds);
    }

    // Save notification record
    const { data: notif, error } = await db.from("push_notifications").insert({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.png",
      sent_count: sent,
      target: "all",
    }).select().single();

    if (error) throw error;

    return apiSuccess({
      notification: notif,
      sent_to: sent,
      failed,
      message: `تم إرسال الإشعار إلى ${sent} مشترك`,
    });
  } catch (err: unknown) {
    console.error("Push send error:", err);
    return apiError("فشل في إرسال الإشعار", 500);
  }
}

// GET — Admin: Get notification history
export async function GET(req: NextRequest) {
  try {
    const auth = await requireAdmin(req);
    if (auth instanceof NextResponse) return auth;

    const db = createAdminSupabase();
    if (!db) return apiSuccess({ notifications: [] });

    const { data } = await db.from("push_notifications")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);

    return apiSuccess({ notifications: data || [] });
  } catch {
    return apiSuccess({ notifications: [] });
  }
}
