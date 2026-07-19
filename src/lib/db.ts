/**
 * Data facade for Arshadrobe. Same API the whole app has always used —
 * but storage now auto-selects:
 *
 *  - Neon Postgres (via /api/data/*) when DATABASE_URL is configured
 *  - On-device IndexedDB otherwise (offline/demo mode)
 *
 * On first contact with an EMPTY cloud database, any existing local data
 * is migrated up automatically so nothing is lost.
 */
import * as local from "./local-db";
import { base64ToBlob, blobToBase64 } from "./images";
import type { Garment, Outfit, Profile } from "./types";
import type { GarmentWire, OutfitWire, ProfileWire } from "./wire";

export { uid } from "./local-db";

type Mode = "cloud" | "local";

const MIGRATED_FLAG = "arshadrobe:migrated:v1";

let modePromise: Promise<Mode> | null = null;

// Session caches — image payloads are heavy, so avoid refetching per page.
let profileCache: Profile | null | undefined;
let garmentsCache: Garment[] | null = null;
let outfitsCache: Outfit[] | null = null;

function mode(): Promise<Mode> {
  modePromise ??= detectMode();
  return modePromise;
}

async function detectMode(): Promise<Mode> {
  try {
    const health = await fetch("/api/health").then((r) => r.json());
    if (!health.db) return "local";
    await maybeMigrateLocalToCloud();
    return "cloud";
  } catch {
    return "local";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `${path} failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

function putJson(body: unknown): RequestInit {
  return {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

/* ---------- wire <-> domain ---------- */

async function garmentToWire(g: Garment): Promise<GarmentWire> {
  const { image, cutout, ...rest } = g;
  return {
    ...rest,
    image: await blobToBase64(image),
    ...(cutout ? { cutout: await blobToBase64(cutout) } : {}),
  };
}

function wireToGarment(w: GarmentWire): Garment {
  const { image, cutout, ...rest } = w;
  return {
    ...rest,
    image: base64ToBlob(image.data, image.mimeType),
    ...(cutout ? { cutout: base64ToBlob(cutout.data, cutout.mimeType) } : {}),
  };
}

async function outfitToWire(o: Outfit): Promise<OutfitWire> {
  const { tryOn, ...rest } = o;
  return {
    ...rest,
    ...(tryOn ? { tryOn: await blobToBase64(tryOn) } : {}),
  };
}

function wireToOutfit(w: OutfitWire): Outfit {
  const { tryOn, ...rest } = w;
  return {
    ...rest,
    ...(tryOn ? { tryOn: base64ToBlob(tryOn.data, tryOn.mimeType) } : {}),
  };
}

async function profileToWire(p: Profile): Promise<ProfileWire> {
  const { photo, ...rest } = p;
  return {
    ...rest,
    ...(photo ? { photo: await blobToBase64(photo) } : {}),
  };
}

function wireToProfile(w: ProfileWire): Profile {
  const { photo, ...rest } = w;
  return {
    ...rest,
    ...(photo ? { photo: base64ToBlob(photo.data, photo.mimeType) } : {}),
  };
}

/* ---------- one-time local → cloud migration ---------- */

async function maybeMigrateLocalToCloud(): Promise<void> {
  try {
    if (localStorage.getItem(MIGRATED_FLAG)) return;
    const [{ garments }, { profile }] = await Promise.all([
      api<{ garments: GarmentWire[] }>("/api/data/garments"),
      api<{ profile: ProfileWire | null }>("/api/data/profile"),
    ]);
    // Only seed a brand-new, empty cloud database.
    if (garments.length === 0 && !profile?.onboarded) {
      const [lp, lg, lo] = await Promise.all([
        local.getProfile(),
        local.listGarments(),
        local.listOutfits(),
      ]);
      if (lp) await api("/api/data/profile", putJson(await profileToWire(lp)));
      for (const g of lg) {
        await api("/api/data/garments", putJson(await garmentToWire(g)));
      }
      for (const o of lo) {
        await api("/api/data/outfits", putJson(await outfitToWire(o)));
      }
    }
    localStorage.setItem(MIGRATED_FLAG, "1");
  } catch (err) {
    console.warn("Local → cloud migration skipped:", err);
  }
}

/* ---------- Profile ---------- */

export async function getProfile(): Promise<Profile | null> {
  if ((await mode()) === "local") return local.getProfile();
  if (profileCache !== undefined) return profileCache;
  const { profile } = await api<{ profile: ProfileWire | null }>(
    "/api/data/profile"
  );
  profileCache = profile ? wireToProfile(profile) : null;
  return profileCache;
}

export async function saveProfile(profile: Profile): Promise<void> {
  if ((await mode()) === "local") return local.saveProfile(profile);
  await api("/api/data/profile", putJson(await profileToWire(profile)));
  profileCache = profile;
}

/* ---------- Garments ---------- */

export async function listGarments(): Promise<Garment[]> {
  if ((await mode()) === "local") return local.listGarments();
  if (garmentsCache) return garmentsCache;
  const { garments } = await api<{ garments: GarmentWire[] }>(
    "/api/data/garments"
  );
  garmentsCache = garments.map(wireToGarment);
  return garmentsCache;
}

export async function putGarment(garment: Garment): Promise<void> {
  if ((await mode()) === "local") return local.putGarment(garment);
  await api("/api/data/garments", putJson(await garmentToWire(garment)));
  if (garmentsCache) {
    garmentsCache = [
      garment,
      ...garmentsCache.filter((g) => g.id !== garment.id),
    ].sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function deleteGarment(id: string): Promise<void> {
  if ((await mode()) === "local") return local.deleteGarment(id);
  await api(`/api/data/garments?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  garmentsCache = garmentsCache?.filter((g) => g.id !== id) ?? null;
}

/* ---------- Outfits ---------- */

export async function listOutfits(): Promise<Outfit[]> {
  if ((await mode()) === "local") return local.listOutfits();
  if (outfitsCache) return outfitsCache;
  const { outfits } = await api<{ outfits: OutfitWire[] }>("/api/data/outfits");
  outfitsCache = outfits.map(wireToOutfit);
  return outfitsCache;
}

export async function putOutfit(outfit: Outfit): Promise<void> {
  if ((await mode()) === "local") return local.putOutfit(outfit);
  await api("/api/data/outfits", putJson(await outfitToWire(outfit)));
  if (outfitsCache) {
    outfitsCache = [
      outfit,
      ...outfitsCache.filter((o) => o.id !== outfit.id),
    ].sort((a, b) => b.createdAt - a.createdAt);
  }
}

export async function deleteOutfit(id: string): Promise<void> {
  if ((await mode()) === "local") return local.deleteOutfit(id);
  await api(`/api/data/outfits?id=${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  outfitsCache = outfitsCache?.filter((o) => o.id !== id) ?? null;
}

/* ---------- Danger zone ---------- */

export async function clearAllData(): Promise<void> {
  await local.clearAllData();
  if ((await mode()) === "cloud") {
    await api("/api/data/clear", { method: "POST" });
  }
  localStorage.removeItem(MIGRATED_FLAG);
  profileCache = undefined;
  garmentsCache = null;
  outfitsCache = null;
}
