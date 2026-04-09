const DB_NAME = "cineflow-revisions";
const STORE = "video-blobs";
const VERSION = 1;

/**
 * Module-level blob URL cache.
 * Lives for the entire browser session — survives React component
 * unmount/remount and Radix tab content mount/unmount cycles.
 * Only cleared on a full page refresh.
 */
const sessionUrlCache = new Map<string, string>();

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION);
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror  = () => reject(req.error);
  });
}

export async function saveVideoBlob(id: string, file: File): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id, file });
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

export async function getVideoBlob(id: string): Promise<File | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => resolve(req.result?.file ?? null);
    req.onerror   = () => reject(req.error);
  });
}

export async function deleteVideoBlob(id: string): Promise<void> {
  sessionUrlCache.delete(id);
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => reject(tx.error);
  });
}

/**
 * Register a blob URL in the session cache immediately after createObjectURL.
 * Call this every time you create a URL so the cache stays in sync.
 */
export function cacheUrl(id: string, url: string): void {
  sessionUrlCache.set(id, url);
}

/**
 * Return a valid blob URL for the given revision ID.
 * Checks the in-memory session cache first (instant, no IDB round-trip).
 * Falls back to IndexedDB if the cache is cold (e.g. after page refresh).
 */
export async function getOrFetchUrl(id: string): Promise<string | null> {
  const cached = sessionUrlCache.get(id);
  if (cached) return cached;

  try {
    const file = await getVideoBlob(id);
    if (!file) return null;
    const url = URL.createObjectURL(file);
    sessionUrlCache.set(id, url);
    return url;
  } catch {
    return null;
  }
}

/** Shared localStorage key — must match the constant in revisions/page.tsx */
const META_KEY = "cineflow-revision-meta";

export interface RevisionMeta {
  id: string;
  name: string;
  size: number;
  duration: number;
  uploadedAt: string;
  project_id: string;
}

export function addRevisionMeta(meta: RevisionMeta): void {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(META_KEY);
  let list: RevisionMeta[] = [];
  try { list = raw ? JSON.parse(raw) : []; } catch { list = []; }
  // deduplicate by id
  list = [meta, ...list.filter((m) => m.id !== meta.id)];
  localStorage.setItem(META_KEY, JSON.stringify(list));
}

export function removeRevisionMeta(id: string): void {
  if (typeof localStorage === "undefined") return;
  const raw = localStorage.getItem(META_KEY);
  if (!raw) return;
  try {
    const list: RevisionMeta[] = JSON.parse(raw);
    localStorage.setItem(META_KEY, JSON.stringify(list.filter((m) => m.id !== id)));
  } catch { /* ignore */ }
}
