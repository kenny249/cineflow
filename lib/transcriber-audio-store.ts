// Persists the transcriber's live audio (file + word timestamps) across a
// page refresh, using the same IndexedDB pattern as lib/revision-store.ts.
// Without this, exact timestamps and clip export only survived in React
// memory — any reload, even seconds after a successful transcription, threw
// away the one thing that made export possible, with no way back short of
// re-transcribing. This is 100% local to the browser; nothing is uploaded.
import type { WhisperWord } from "@/lib/transcript-align";

const DB_NAME = "cineflow-transcriber";
const STORE = "current-audio";
const VERSION = 1;
const CURRENT_KEY = "current";

interface StoredAudio {
  id: string;
  file: File;
  words: WhisperWord[];
}

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
    req.onerror = () => reject(req.error);
  });
}

export async function saveCurrentAudio(file: File, words: WhisperWord[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ id: CURRENT_KEY, file, words } satisfies StoredAudio);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getCurrentAudio(): Promise<{ file: File; words: WhisperWord[] } | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(CURRENT_KEY);
    req.onsuccess = () => {
      const result = req.result as StoredAudio | undefined;
      resolve(result ? { file: result.file, words: result.words } : null);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function clearCurrentAudio(): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(CURRENT_KEY);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
