export const runtime = "edge";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { createAdminSupabase } from "@/lib/supabase";
import { requireAdmin } from "@/lib/admin/auth";

function base64UrlToUint8Array(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(b64 + pad);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

function toBuffer(arr: Uint8Array): ArrayBuffer {
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

function uint8ToBase64Url(arr: Uint8Array): string {
  let bin = "";
  for (const b of arr) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const len = arrays.reduce((s, a) => s + a.length, 0);
  const result = new Uint8Array(len);
  let offset = 0;
  for (const a of arrays) { result.set(a, offset); offset += a.length; }
  return result;
}

async function encryptPayload(
  p256dhKey: string,
  authSecret: string,
  payload: string
): Promise<{ ciphertext: Uint8Array; salt: Uint8Array; serverPublicKey: Uint8Array }> {
  const clientPublicKey = base64UrlToUint8Array(p256dhKey);
  const clientAuth = base64UrlToUint8Array(authSecret);
  const payloadBytes = new TextEncoder().encode(payload);

  const serverKeys = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const serverPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", serverKeys.publicKey));

  const clientPubCryptoKey = await crypto.subtle.importKey(
    "raw", toBuffer(clientPublicKey), { name: "ECDH", namedCurve: "P-256" }, false, []
  );

  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: clientPubCryptoKey }, serverKeys.privateKey, 256)
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const authInfo = new TextEncoder().encode("Content-Encoding: auth\0");
  const prkCombine = await crypto.subtle.importKey("raw", toBuffer(sharedSecret), { name: "HKDF" }, false, ["deriveBits"]);
  const ikm = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(clientAuth), info: toBuffer(authInfo) }, prkCombine, 256
  ));

  const keyInfo = concat(
    new TextEncoder().encode("Content-Encoding: aesgcm\0P-256\0"),
    new Uint8Array([0, clientPublicKey.length >> 8, clientPublicKey.length & 0xff]),
    clientPublicKey,
    new Uint8Array([0, serverPubRaw.length >> 8, serverPubRaw.length & 0xff]),
    serverPubRaw
  );
  const nonceInfo = concat(
    new TextEncoder().encode("Content-Encoding: nonce\0P-256\0"),
    new Uint8Array([0, clientPublicKey.length >> 8, clientPublicKey.length & 0xff]),
    clientPublicKey,
    new Uint8Array([0, serverPubRaw.length >> 8, serverPubRaw.length & 0xff]),
    serverPubRaw
  );

  const prkKey = await crypto.subtle.importKey("raw", toBuffer(ikm), { name: "HKDF" }, false, ["deriveBits"]);
  const contentKey = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(salt), info: toBuffer(keyInfo) }, prkKey, 128
  ));
  const nonce = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "HKDF", hash: "SHA-256", salt: toBuffer(salt), info: toBuffer(nonceInfo) }, prkKey, 96
  ));

  const paddingLength = 0;
  const padded = concat(new Uint8Array([paddingLength >> 8, paddingLength & 0xff]), payloadBytes);

  const aesKey = await crypto.subtle.importKey("raw", toBuffer(contentKey), { name: "AES-GCM" }, false, ["encrypt"]);
  const encrypted = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: toBuffer(nonce) }, aesKey, toBuffer(padded)));

  return { ciphertext: encrypted, salt, serverPublicKey: serverPubRaw };
}

async function signJwt(audience: string, subject: string, vapidPrivateKey: string, vapidPublicKey: string): Promise<string> {
  const header = uint8ToBase64Url(new TextEncoder().encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const now = Math.floor(Date.now() / 1000);
  const claims = uint8ToBase64Url(new TextEncoder().encode(JSON.stringify({
    aud: audience, exp: now + 43200, sub: subject,
  })));
  const unsigned = `${header}.${claims}`;
  const unsignedBytes = new TextEncoder().encode(unsigned);

  const privKeyRaw = base64UrlToUint8Array(vapidPrivateKey);
  const pubKeyRaw = base64UrlToUint8Array(vapidPublicKey);

  const jwk = {
    kty: "EC", crv: "P-256",
    x: uint8ToBase64Url(pubKeyRaw.slice(1, 33)),
    y: uint8ToBase64Url(pubKeyRaw.slice(33, 65)),
    d: uint8ToBase64Url(privKeyRaw),
  };

  const key = await crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, toBuffer(unsignedBytes)));

  return `${unsigned}.${uint8ToBase64Url(sig)}`;
}

async function sendWebPush(
  endpoint: string,
  p256dh: string,
  auth: string,
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: string
): Promise<{ ok: boolean; status: number }> {
  const { ciphertext, salt, serverPublicKey } = await encryptPayload(p256dh, auth, payload);
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const jwt = await signJwt(audience, "mailto:support@clalmobile.com", vapidPrivateKey, vapidPublicKey);
  const vapidPubB64 = vapidPublicKey;

  const resp = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aesgcm",
      "Crypto-Key": `dh=${uint8ToBase64Url(serverPublicKey)};p256ecdsa=${vapidPubB64}`,
      Authorization: `WebPush ${jwt}`,
      Encryption: `salt=${uint8ToBase64Url(salt)}`,
      TTL: "86400",
    },
    body: toBuffer(ciphertext),
  });

  return { ok: resp.ok, status: resp.status };
}

export async function POST(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ error: "Server error" }, { status: 500 });

    const body = await req.json();
    const { title, body: notifBody, url, icon } = body;

    if (!title || !notifBody) {
      return NextResponse.json({ error: "Missing title or body" }, { status: 400 });
    }

    const vapidPublic = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    const vapidPrivate = process.env.VAPID_PRIVATE_KEY;

    if (!vapidPublic || !vapidPrivate) {
      return NextResponse.json(
        { error: "VAPID keys غير مُعدّة. أضف NEXT_PUBLIC_VAPID_PUBLIC_KEY و VAPID_PRIVATE_KEY في .env.local" },
        { status: 500 }
      );
    }

    const { data: subs } = await db.from("push_subscriptions")
      .select("*")
      .eq("active", true);

    const subscribers = subs || [];
    const payload = JSON.stringify({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.svg",
    });

    let sent = 0;
    const expiredEndpoints: string[] = [];

    for (const sub of subscribers) {
      try {
        const keys = sub.keys as { p256dh?: string; auth?: string } | null;
        if (!keys?.p256dh || !keys?.auth) continue;

        const result = await sendWebPush(
          sub.endpoint,
          keys.p256dh,
          keys.auth,
          payload,
          vapidPublic,
          vapidPrivate
        );

        if (result.ok) {
          sent++;
        } else if (result.status === 410 || result.status === 404) {
          expiredEndpoints.push(sub.endpoint);
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        console.warn("Push failed:", sub.endpoint?.slice(0, 50), msg);
      }
    }

    if (expiredEndpoints.length > 0) {
      await db.from("push_subscriptions")
        .update({ active: false })
        .in("endpoint", expiredEndpoints);
    }

    const { data: notif, error } = await db.from("push_notifications").insert({
      title,
      body: notifBody,
      url: url || "https://clalmobile.com",
      icon: icon || "/icons/icon-192x192.svg",
      sent_count: sent,
      target: "all",
    }).select().single();

    if (error) throw error;

    return NextResponse.json({
      notification: notif,
      sent_to: sent,
      failed: subscribers.length - sent,
      message: `تم إرسال الإشعار إلى ${sent} مشترك${expiredEndpoints.length ? ` (${expiredEndpoints.length} اشتراك منتهي)` : ""}`,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("Push send error:", msg);
    return NextResponse.json({ error: "فشل إرسال الإشعار" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req);
  if (auth instanceof NextResponse) return auth;
  try {
    const db = createAdminSupabase();
    if (!db) return NextResponse.json({ notifications: [] });

    const { data } = await db.from("push_notifications")
      .select("*")
      .order("sent_at", { ascending: false })
      .limit(50);

    return NextResponse.json({ notifications: data || [] });
  } catch {
    return NextResponse.json({ notifications: [] });
  }
}
