// =====================================================
// ClalMobile — Service Worker (site-wide, store + PWA notifications)
// Scope: /
//
// v3 (2026-04-19):
//   - FIX: never call respondWith with undefined (was breaking /login,
//     /forgot-password, and any non-nav non-static GET)
//   - FIX: explicitly skip auth + admin + CRM + sales-pwa + employee
//     paths — those must always reach the server fresh so auth redirects
//     and Supabase recovery tokens work reliably
//   - BUMP CACHE_NAME so old clients purge stale chunks on activate
// =====================================================

// Push — show notification when received from server
self.addEventListener("push", (event) => {
  let data = { title: "ClalMobile", body: "إشعار جديد", url: "/", icon: "/icons/icon-192x192.png" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      data: { url: data.url || "/" },
      dir: "rtl",
      lang: "ar",
    })
  );
});

// Notification click — open or focus the target URL
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});

// Bumped on every SW change. Forces old caches to be purged on activate,
// so stale JS chunks (e.g. from an older @supabase/ssr version) don't
// linger on returning users.
const CACHE_NAME = "clalmobile-v3";
const STATIC_ASSETS = [
  "/",
  "/store",
  "/store/cart",
  "/manifest.json",
];

// Install — pre-cache essential assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // allSettled so one missing asset doesn't abort the install
      return Promise.allSettled(STATIC_ASSETS.map((u) => cache.add(u)));
    })
  );
  self.skipWaiting();
});

// Activate — clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// Paths that must ALWAYS go to the network untouched by the SW.
// Auth pages (login / forgot-password / reset-password / change-password)
// are here because they rely on fresh session state and Supabase
// recovery-token redirects — caching navigation responses here breaks
// login for users who visited the page before a code change.
// Admin / CRM / sales-pwa / employee have their own SWs or expect fresh.
const SKIP_PATH_PREFIXES = [
  "/login",
  "/logout",
  "/forgot-password",
  "/reset-password",
  "/change-password",
  "/admin",
  "/crm",
  "/sales-pwa",   // handled by /sales-pwa/sw.js
  "/employee",
  "/api/",
  "/_next/webpack",
  "/_next/data",  // Next.js route-data fetches must stay fresh
];

function shouldSkip(url) {
  return SKIP_PATH_PREFIXES.some((p) => url.pathname.startsWith(p));
}

// Fetch — network-first for navigation, cache-first for static
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle GET same-origin
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;

  // Skip anything auth/admin/CRM/PWA/API — let the browser handle it raw
  if (shouldSkip(url)) return;

  // Navigation requests: network-first, cache successful responses, fall
  // back to cache, and if that also misses fall back to "/" shell. Never
  // produce `undefined` — if everything fails, synthesise a minimal
  // offline response so respondWith always gets a Response.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const shell = await caches.match("/");
          if (shell) return shell;
          return new Response(
            "<html><body><h1>Offline</h1><p>تفقّد اتصالك بالإنترنت.</p></body></html>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } },
          );
        }
      })(),
    );
    return;
  }

  // Static asset cache-first (content-hashed chunks, images, fonts, css)
  const isStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".woff2");

  if (isStatic) {
    event.respondWith(
      (async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        try {
          const response = await fetch(request);
          if (response && response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone)).catch(() => {});
          }
          return response;
        } catch {
          // Re-throw as a proper Response — respondWith will surface a
          // network error to the caller which matches normal browser
          // behaviour (previously we'd return undefined here).
          return new Response("", { status: 503 });
        }
      })(),
    );
    return;
  }

  // Everything else: don't intercept at all — let the browser handle it.
  // (Previously we had a "default" branch that could return undefined on
  // cache miss; removing it eliminates the FetchEvent rejection bug.)
});
