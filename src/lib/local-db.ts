/**
 * Local-first storage for Arshadrobe.
 * Everything (photos included, as Blobs) lives in IndexedDB on-device:
 * private by default, works offline, zero backend setup.
 */
import type { Garment, Outfit, Profile } from "./types";

const DB_NAME = "arshadrobe";
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("garments")) {
        db.createObjectStore("garments", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("outfits")) {
        db.createObjectStore("outfits", { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains("kv")) {
        db.createObjectStore("kv");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: string, mode: IDBTransactionMode) {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

export function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------- Profile ---------- */

export async function getProfile(): Promise<Profile | null> {
  const s = await store("kv", "readonly");
  return (await reqToPromise(s.get("profile"))) ?? null;
}

export async function saveProfile(profile: Profile): Promise<void> {
  const s = await store("kv", "readwrite");
  await reqToPromise(s.put(profile, "profile"));
}

/* ---------- Garments ---------- */

export async function listGarments(): Promise<Garment[]> {
  const s = await store("garments", "readonly");
  const all = await reqToPromise(s.getAll());
  return (all as Garment[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function putGarment(garment: Garment): Promise<void> {
  const s = await store("garments", "readwrite");
  await reqToPromise(s.put(garment));
}

export async function deleteGarment(id: string): Promise<void> {
  const s = await store("garments", "readwrite");
  await reqToPromise(s.delete(id));
}

/* ---------- Outfits ---------- */

export async function listOutfits(): Promise<Outfit[]> {
  const s = await store("outfits", "readonly");
  const all = await reqToPromise(s.getAll());
  return (all as Outfit[]).sort((a, b) => b.createdAt - a.createdAt);
}

export async function putOutfit(outfit: Outfit): Promise<void> {
  const s = await store("outfits", "readwrite");
  await reqToPromise(s.put(outfit));
}

export async function deleteOutfit(id: string): Promise<void> {
  const s = await store("outfits", "readwrite");
  await reqToPromise(s.delete(id));
}

/* ---------- Danger zone ---------- */

export async function clearAllData(): Promise<void> {
  const db = await openDb();
  const names = ["garments", "outfits", "kv"];
  await Promise.all(
    names.map((name) => {
      const s = db.transaction(name, "readwrite").objectStore(name);
      return reqToPromise(s.clear());
    })
  );
}
