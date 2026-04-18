/**
 * PWA offline helpers — UI-side companions to public/sales-pwa/sw.js.
 *
 * The service worker owns the IndexedDB `clalmobile-offline` database
 * and the `post-queue` object store. These helpers open the same DB
 * from the main thread so screens can show a queue badge and trigger
 * a manual drain (useful after the user taps "retry now").
 *
 * Schema stays in sync with sw.js:
 *   db name:   clalmobile-offline
 *   store:     post-queue
 *   keyPath:   id (auto-increment)
 *   record:    { url, method, body, headers, queuedAt }
 */

const DB_NAME = "clalmobile-offline";
const DB_STORE = "post-queue";

export interface QueuedRequest {
  id: number;
  url: string;
  method: "POST" | "PUT" | string;
  body: string;
  headers: Record<string, string>;
  queuedAt: number;
}

/** Thin wrapper around navigator.onLine — always true in SSR. */
export function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB not available"));
      return;
    }
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

/** How many requests are currently queued offline. */
export async function getQueueSize(): Promise<number> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return 0;
  }
}

/** Snapshot of the queue — useful for a "pending" UI. */
export async function getQueuedRequests(): Promise<QueuedRequest[]> {
  try {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, "readonly");
      const req = tx.objectStore(DB_STORE).getAll();
      req.onsuccess = () => resolve((req.result || []) as QueuedRequest[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

async function deleteById(db: IDBDatabase, id: number): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readwrite");
    tx.objectStore(DB_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Manually drain the queue — replays each request in FIFO order and
 * deletes successes. Mirrors the SW's drainQueue() so this is safe to
 * call from the UI even when the SW is missing (e.g. dev HTTP server).
 */
export async function syncQueue(): Promise<{ synced: number; failed: number }> {
  if (!isOnline()) return { synced: 0, failed: 0 };

  let db: IDBDatabase;
  try {
    db = await openDb();
  } catch {
    return { synced: 0, failed: 0 };
  }

  const items = await new Promise<QueuedRequest[]>((resolve, reject) => {
    const tx = db.transaction(DB_STORE, "readonly");
    const req = tx.objectStore(DB_STORE).getAll();
    req.onsuccess = () => resolve((req.result || []) as QueuedRequest[]);
    req.onerror = () => reject(req.error);
  });

  let synced = 0;
  let failed = 0;
  for (const item of items) {
    try {
      const resp = await fetch(item.url, {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });
      if (resp.ok) {
        await deleteById(db, item.id);
        synced += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  // Ping the SW so any other tabs see the update
  if (typeof navigator !== "undefined" && navigator.serviceWorker?.controller) {
    navigator.serviceWorker.controller.postMessage({ type: "queue-drained", synced, failed });
  }

  return { synced, failed };
}
