/**
 * Server-only Neon Postgres access. Images are stored inline as base64
 * text columns — simple, atomic with the row, and well within Neon's
 * free tier at personal-wardrobe scale.
 */
import { neon } from "@neondatabase/serverless";

export function hasDb(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export class NoDbError extends Error {
  constructor() {
    super("DATABASE_URL is not configured");
  }
}

let client: ReturnType<typeof neon> | null = null;
let schemaReady: Promise<void> | null = null;

export function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NoDbError();
  if (!client) client = neon(url);
  return client;
}

/** Create tables on first use (idempotent). */
export function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = getSql();
      await sql`
        CREATE TABLE IF NOT EXISTS profile (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL DEFAULT '',
          vibes JSONB NOT NULL DEFAULT '[]',
          onboarded BOOLEAN NOT NULL DEFAULT false,
          photo_data TEXT,
          photo_mime TEXT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS garments (
          id TEXT PRIMARY KEY,
          created_at BIGINT NOT NULL,
          category TEXT NOT NULL,
          subcategory TEXT NOT NULL DEFAULT '',
          colors JSONB NOT NULL DEFAULT '[]',
          pattern TEXT NOT NULL DEFAULT 'solid',
          material TEXT NOT NULL DEFAULT '',
          seasons JSONB NOT NULL DEFAULT '["all"]',
          formality TEXT NOT NULL DEFAULT 'casual',
          description TEXT NOT NULL DEFAULT '',
          favorite BOOLEAN NOT NULL DEFAULT false,
          wear_count INT NOT NULL DEFAULT 0,
          image_data TEXT NOT NULL,
          image_mime TEXT NOT NULL,
          cutout_data TEXT,
          cutout_mime TEXT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS outfits (
          id TEXT PRIMARY KEY,
          created_at BIGINT NOT NULL,
          title TEXT NOT NULL,
          occasion TEXT NOT NULL DEFAULT '',
          vibe TEXT NOT NULL DEFAULT '',
          explanation TEXT NOT NULL DEFAULT '',
          tip TEXT,
          garment_ids JSONB NOT NULL DEFAULT '[]',
          favorite BOOLEAN NOT NULL DEFAULT false,
          worn_dates JSONB NOT NULL DEFAULT '[]',
          tryon_data TEXT,
          tryon_mime TEXT
        )`;
    })();
    // Allow a retry on transient failure instead of caching the rejection.
    schemaReady.catch(() => {
      schemaReady = null;
    });
  }
  return schemaReady;
}
