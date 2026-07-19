/**
 * Server-side input validation/sanitization helpers. Client-side checks are
 * for UX; these are the real guards — nothing untrusted reaches the DB or
 * the AI providers unclamped.
 */
import type { ImagePayload } from "@/lib/wire";

/** ~9MB decoded — far above anything the app legitimately sends. */
export const MAX_IMAGE_BASE64 = 12_000_000;

export function validImage(p: unknown): p is ImagePayload {
  if (!p || typeof p !== "object") return false;
  const img = p as ImagePayload;
  if (
    typeof img.url === "string" &&
    (img.url.startsWith("https://") || img.url.startsWith("data:image/"))
  ) {
    return img.url.length <= MAX_IMAGE_BASE64;
  }
  return (
    typeof img.data === "string" &&
    img.data.length > 0 &&
    img.data.length <= MAX_IMAGE_BASE64 &&
    typeof img.mimeType === "string" &&
    img.mimeType.startsWith("image/")
  );
}

/** Like validImage but requires raw data (for AI calls, not stored refs). */
export function validImageData(p: unknown): p is ImagePayload {
  return (
    validImage(p) && typeof (p as ImagePayload).data === "string"
  );
}

export function str(v: unknown, max: number, fallback = ""): string {
  return typeof v === "string" ? v.trim().slice(0, max) : fallback;
}

export function strArray(
  v: unknown,
  maxItems: number,
  maxLen: number
): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is string => typeof x === "string")
    .slice(0, maxItems)
    .map((s) => s.trim().slice(0, maxLen))
    .filter(Boolean);
}

export function oneOf<T extends string>(
  v: unknown,
  allowed: readonly T[],
  fallback: T
): T {
  return allowed.includes(v as T) ? (v as T) : fallback;
}

export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function numArray(v: unknown, maxItems: number): number[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x): x is number => typeof x === "number" && Number.isFinite(x))
    .slice(0, maxItems);
}
