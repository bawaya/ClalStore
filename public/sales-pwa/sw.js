// =====================================================
// ClalMobile PWA — Service Worker
// Scope: /sales-pwa/
//
// v2 adds:
//   - API GET cache for /api/employee/* and /api/pwa/sales* (network-first)
//   - Offline POST/PUT queue for /api/pwa/* (except attachments which
//     need a real-time signed URL response)
//   - Background drain on `online` event
// =====================================================

const CACHE_NAME = "sales-pwa-v2";
const API_CACHE = "sales-pwa-api-v2";
const DB_NAME = "clalmobile-offline";
const DB_STORE = "post-queue";

const STATIC_ASSETS = [
  "/sales-pwa",
  "/sales-pwa/new",
  "/sales-pwa/manifest.json",
];

// ---------- IndexedDB helpers (vanilla) ----------
function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_STORE)) {
        db.createObjectStore(DB_STORE, { keyPath: "id", autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function enqueue(record) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).add(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function readAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
}

async function deleteById(id) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// ---------- Install / Activate ----------
self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => ![CACHE_NAME, API_CACHE].includes(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ---------- Fetch routing ----------
function isCachableApi(url) {
  return url.pathname.startsWith("/api/employee/") || url.pathname.startsWith("/api/pwa/sales");
}

function isQueueablePost(url) {
  if (!url.pathname.startsWith("/api/pwa/")) return false;
  // Attachments need signed URLs / real-time uploads — skip queue
  if (url.pathname.includes("/attachments/sign")) return false;
  if (url.pathname.endsWith("/attachments")) return false;
  return true;
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // ── API GET: network-first, fall back to cache ──
  if (request.method === "GET" && isCachableApi(url)) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          if (resp.ok) {
            const clone = resp.clone();
            caches.open(API_CACHE).then((c) => c.put(request, clone));
          }
          return resp;
        })
        .catch(() => caches.match(request).then((cached) =>
          cached || new Response(JSON.stringify({ success: false, error: "offline" }), {
            status: 503, headers: { "Content-Type": "application/json" },
          })
        ))
    );
    return;
  }

  // ── POST/PUT to /api/pwa/*: try network, queue on failure ──
  if ((request.method === "POST" || request.method === "PUT") && isQueueablePost(url)) {
    event.respondWith(
      fetch(request.clone()).catch(async () => {
        try {
          const body = await request.clone().text();
          await enqueue({
            url: request.url,
            method: request.method,
            body,
            headers: Object.fromEntries(request.headers.entries()),
            queuedAt: Date.now(),
          });
          return new Response(JSON.stringify({ success: true, queued: true }), {
            status: 202, headers: { "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ success: false, error: "queue_failed" }), {
            status: 503, headers: { "Content-Type": "application/json" },
          });
        }
      })
    );
    return;
  }

  if (request.method !== "GET") return;
  if (!url.pathname.startsWith("/sales-pwa")) return;
  if (url.pathname.startsWith("/api/")) return;

  // ── App shell navigation: network-first ──
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const clone = resp.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return resp;
        })
        .catch(() => caches.match(request).then((c) => c || caches.match("/sales-pwa")))
    );
    return;
  }

  // ── Static assets: cache-first ──
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((resp) => {
        const clone = resp.clone();
        caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        return resp;
      });
    })
  );
});

// ---------- Queue drain ----------
async function drainQueue() {
  const items = await readAll();
  let synced = 0, failed = 0;
  for (const item of items) {
    try {
      const resp = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (resp.ok) { await deleteById(item.id); synced++; } else { failed++; }
    } catch { failed++; }
  }
  // Notify clients so UI can refresh
  const clients = await self.clients.matchAll();
  for (const c of clients) c.postMessage({ type: "queue-drained", synced, failed });
  return { synced, failed };
}

self.addEventListener("message", (event) => {
  if (event.data?.type === "drain-queue") {
    event.waitUntil(drainQueue());
  }
});

self.addEventListener("sync", (event) => {
  if (event.tag === "drain-post-queue") event.waitUntil(drainQueue());
});

// Fallback: drain when connectivity returns (fires inside the SW)
self.addEventListener("online", () => { drainQueue().catch(() => {}); });
