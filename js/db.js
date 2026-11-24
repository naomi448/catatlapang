// db.js — Tiny promise-based IndexedDB wrapper (no dependencies).
//
// CatatLapang is offline-first and private by architecture: notes and
// summaries live ONLY in this browser's IndexedDB. There is no backend
// of ours and no sync — the "sync status" shown in the UI is therefore
// (a) local save state and (b) the browser's online/offline state.

const DB_NAME = "catatlapang";
const DB_VERSION = 1;
const STORE_NOTES = "notes";
const STORE_REPORTS = "reports";

let dbPromise = null;

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NOTES)) {
        db.createObjectStore(STORE_NOTES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_REPORTS)) {
        db.createObjectStore(STORE_REPORTS, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(storeName, mode, run) {
  return openDb().then(
    (db) =>
      new Promise((resolve, reject) => {
        const transaction = db.transaction(storeName, mode);
        const store = transaction.objectStore(storeName);
        const request = run(store);
        transaction.oncomplete = () => resolve(request ? request.result : undefined);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);
      })
  );
}

// Note shape:
// {
//   id, createdAt, updatedAt, title, raw,
//   cleaned, summary,
//   fields: { household, observations: [], actions: [], followups: [] },
//   summarySource: "on-device" | "cloud" | null,
//   translation, translationLang, translationSource,
//   reviewed: boolean
// }

export function getAllNotes() {
  return tx(STORE_NOTES, "readonly", (s) => s.getAll()).then((notes) =>
    (notes || []).sort((a, b) => b.createdAt - a.createdAt)
  );
}

export function putNote(note) {
  return tx(STORE_NOTES, "readwrite", (s) => s.put(note)).then(() => note);
}

export function deleteNote(id) {
  return tx(STORE_NOTES, "readwrite", (s) => s.delete(id));
}

export function getLatestReport() {
  return tx(STORE_REPORTS, "readonly", (s) => s.get("latest"));
}

export function putLatestReport(report) {
  return tx(STORE_REPORTS, "readwrite", (s) =>
    s.put({ id: "latest", ...report })
  );
}

export function newId() {
  return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
}
