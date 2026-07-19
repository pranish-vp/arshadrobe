/**
 * Server-only image storage — free either way:
 *
 *  - Cloudinary (free tier, CDN) when CLOUDINARY_CLOUD_NAME / API_KEY /
 *    API_SECRET are set. Uses the signed REST upload API directly, no SDK.
 *  - Otherwise images are inlined as data: URIs and live in the Neon rows —
 *    zero extra services, fine at personal-wardrobe scale.
 */
import { createHash } from "crypto";
import type { ImagePayload } from "@/lib/wire";

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const API_KEY = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

export function hasCloudinary(): boolean {
  return Boolean(CLOUD && API_KEY && API_SECRET);
}

export function storageMode(): "cloudinary" | "database" {
  return hasCloudinary() ? "cloudinary" : "database";
}

function sign(params: Record<string, string>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join("&");
  return createHash("sha1").update(sorted + API_SECRET).digest("hex");
}

/** Persist an uploaded image payload; returns the URL to store in Postgres. */
export async function storeImage(
  payload: ImagePayload,
  path: string
): Promise<string> {
  if (payload.url) return payload.url; // unchanged image — already stored
  if (!payload.data || !payload.mimeType) throw new Error("empty image payload");

  if (!hasCloudinary()) {
    return `data:${payload.mimeType};base64,${payload.data}`;
  }

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const folder = `arshadrobe/${path.split("/")[0] ?? "misc"}`;
  const signature = sign({ folder, timestamp });
  const form = new FormData();
  form.append("file", `data:${payload.mimeType};base64,${payload.data}`);
  form.append("api_key", API_KEY!);
  form.append("timestamp", timestamp);
  form.append("folder", folder);
  form.append("signature", signature);

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD}/image/upload`,
    { method: "POST", body: form }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Cloudinary upload ${res.status}: ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as { secure_url?: string };
  if (!json.secure_url) throw new Error("Cloudinary returned no URL");
  return json.secure_url;
}

/** Extract the Cloudinary public_id from a delivery URL (for deletion). */
function publicIdFromUrl(url: string): string | null {
  const m = url.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.[a-z0-9]+)?$/i);
  return m ? m[1] : null;
}

/** Best-effort cleanup of replaced/removed hosted images. */
export async function deleteImages(
  urls: Array<string | null | undefined>
): Promise<void> {
  if (!hasCloudinary()) return; // data: URIs vanish with their rows
  const ids = urls
    .filter((u): u is string => Boolean(u) && u!.startsWith("http"))
    .map(publicIdFromUrl)
    .filter((id): id is string => Boolean(id));
  await Promise.all(
    ids.map(async (publicId) => {
      try {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const signature = sign({ public_id: publicId, timestamp });
        const form = new FormData();
        form.append("public_id", publicId);
        form.append("api_key", API_KEY!);
        form.append("timestamp", timestamp);
        form.append("signature", signature);
        await fetch(`https://api.cloudinary.com/v1_1/${CLOUD}/image/destroy`, {
          method: "POST",
          body: form,
        });
      } catch (err) {
        console.warn("cloudinary delete failed:", err);
      }
    })
  );
}
