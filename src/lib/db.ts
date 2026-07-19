/**
 * Data facade for Arshadrobe. Same API the whole app has always used —
 * but storage auto-selects:
 *
 *  - Neon Postgres + hosted images (via /api/data/*) when DATABASE_URL is
 *    configured — per-account, behind login.
 *  - On-device IndexedDB otherwise (offline/demo mode, no account needed).
 *
 * After signing in to an account with an empty cloud wardrobe, any existing
 * local data is migrated up automatically so nothing is lost.
 */
import * as local from "./local-db";
import { base64ToBlob, blobToBase64 } from "./images";
import type { Garment, Outfit, Profile } from "./types";
import type {
  GarmentWire,
  ImagePayload,
  OutfitWire,
  ProfileWire,
} from "./wire";

export { uid } from "./local-db";

type Mode = "cloud" | "local";

let modePromise: Promise<Mode> | null = null;

// Session caches — images are heavy, avoid refetching on every page.
let profileCache: Profile | null | undefined;
let garmentsCache: Garment[] | null = null;
let outfitsCache: Outfit[] | null = null;

// Remembers where a downloaded Blob is hosted, so unchanged images are
// sent back as URLs (no re-upload on e.g. a favorite toggle).
const hostedUrlOf = new WeakMap<Blob, string>();

export function resetDataCaches(): void {
  modePromise = null;
  profileCache = undefined;
  garmentsCache = null;
  outfitsCache = null;
}

function mode(): Promise<Mode> {
  modePromise ??= detectMode();
  return modePromise;
}

async function detectMode(): Promise<Mode> {
  try {
    const health = await fetch("/api/health").then((r) => r.json());
    return health.db ? "cloud" : "local";
  } catch {
    return "local";
  }
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  if (res.status === 401) {
    // Session expired / not signed in — send the user to login.
    if (typeof window !== "undefined" && location.pathname !== "/login") {
      location.href = "/login";
    }
    throw new Error("unauthenticated");
  }
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

async function blobToPayload(blob: Blob): Promise<ImagePayload> {
  const url = hostedUrlOf.get(blob);
  if (url) return { url }; // unchanged — server keeps the stored copy
  return blobToBase64(blob);
}

async function payloadToBlob(p: ImagePayload): Promise<Blob> {
  if (p.url) {
    const blob = await fetch(p.url).then((r) => r.blob());
    hostedUrlOf.set(blob, p.url);
    return blob;
  }
  return base64ToBlob(p.data!, p.mimeType || "image/jpeg");
}

async function garmentToWire(g: Garment): Promise<GarmentWire> {
  const { image, cutout, ...rest } = g;
  return {
    ...rest,
    image: await blobToPayload(image),
    ...(cutout ? { cutout: await blobToPayload(cutout) } : {}),
  };
}

async function wireToGarment(w: GarmentWire): Promise<Garment> {
  const { image, cutout, ...rest } = w;
  return {
    ...rest,
    image: await payloadToBlob(image),
    ...(cutout ? { cutout: await payloadToBlob(cutout) } : {}),
  };
}

async function outfitToWire(o: Outfit): Promise<OutfitWire> {
  const { tryOn, ...rest } = o;
  return {
    ...rest,
    ...(tryOn ? { tryOn: await blobToPayload(tryOn) } : {}),
  };
}

async function wireToOutfit(w: OutfitWire): Promise<Outfit> {
  const { tryOn, ...rest } = w;
  return {
    ...rest,
    ...(tryOn ? { tryOn: await payloadToBlob(tryOn) } : {}),
  };
}

async function profileToWire(p: Profile): Promise<ProfileWire> {
  const { photo, ...rest } = p;
  return {
    ...rest,
    ...(photo ? { photo: await blobToPayload(photo) } : {}),
  };
}

async function wireToProfile(w: ProfileWire): Promise<Profile> {
  const { photo, ...rest } = w;
  return {
    ...rest,
    ...(photo ? { photo: await payloadToBlob(photo) } : {}),
  };
}

/* ---------- one-time local → cloud migration (per account) ---------- */

export async function migrateLocalToCloud(userId: string): Promise<void> {
  const flag = `arshadrobe:migrated:${userId}`;
  try {
    if (localStorage.getItem(flag)) return;
    const [{ garments }, { profile }] = await Promise.all([
      api<{ garments: GarmentWire[] }>("/api/data/garments"),
      api<{ profile: ProfileWire | null }>("/api/data/profile"),
    ]);
    // Only seed a brand-new, empty cloud wardrobe.
    if (garments.length === 0 && !profile?.onboarded) {
      const [lp, lg, lo] = await Promise.all([
        local.getProfile(),
        local.listGarments(),
        local.listOutfits(),
      ]);
      if (lp?.onboarded) {
        await api("/api/data/profile", putJson(await profileToWire(lp)));
      }
      for (const g of lg) {
        await api("/api/data/garments", putJson(await garmentToWire(g)));
      }
      for (const o of lo) {
        await api("/api/data/outfits", putJson(await outfitToWire(o)));
      }
      resetDataCaches();
    }
    localStorage.setItem(flag, "1");
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
  profileCache = profile ? await wireToProfile(profile) : null;
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
  garmentsCache = await Promise.all(garments.map(wireToGarment));
  return garmentsCache;
}

export async function putGarment(garment: Garment): Promise<void> {
  if ((await mode()) === "local") return local.putGarment(garment);
  const saved = await api<{ image?: ImagePayload; cutout?: ImagePayload }>(
    "/api/data/garments",
    putJson(await garmentToWire(garment))
  );
  // Remember where the server hosted these blobs.
  if (saved.image?.url) hostedUrlOf.set(garment.image, saved.image.url);
  if (saved.cutout?.url && garment.cutout) {
    hostedUrlOf.set(garment.cutout, saved.cutout.url);
  }
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
  outfitsCache = await Promise.all(outfits.map(wireToOutfit));
  return outfitsCache;
}

export async function putOutfit(outfit: Outfit): Promise<void> {
  if ((await mode()) === "local") return local.putOutfit(outfit);
  const saved = await api<{ tryOn?: ImagePayload }>(
    "/api/data/outfits",
    putJson(await outfitToWire(outfit))
  );
  if (saved.tryOn?.url && outfit.tryOn) {
    hostedUrlOf.set(outfit.tryOn, saved.tryOn.url);
  }
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
  resetDataCaches();
}
