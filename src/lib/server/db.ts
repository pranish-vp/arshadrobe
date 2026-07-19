/**
 * Server-only Neon Postgres access. Schema v2: per-user rows, images
 * stored in Vercel Blob (Postgres keeps only the URLs).
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

      // v1 (pre-auth, base64-in-DB) tables are incompatible — drop them.
      // Only ever fires on a database created before accounts existed.
      const legacy = (await sql`
        SELECT 1 FROM information_schema.tables WHERE table_name = 'garments'
          AND NOT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'garments' AND column_name = 'user_id'
          )`) as unknown[];
      if (legacy.length) {
        await sql`DROP TABLE IF EXISTS garments`;
        await sql`DROP TABLE IF EXISTS outfits`;
      }
      await sql`DROP TABLE IF EXISTS profile`; // v1 singular table

      await sql`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          created_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS sessions (
          token TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          expires_at BIGINT NOT NULL
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS profiles (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          name TEXT NOT NULL DEFAULT '',
          vibes JSONB NOT NULL DEFAULT '[]',
          onboarded BOOLEAN NOT NULL DEFAULT false,
          photo_url TEXT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS garments (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
          image_url TEXT NOT NULL,
          cutout_url TEXT
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS outfits (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at BIGINT NOT NULL,
          title TEXT NOT NULL,
          occasion TEXT NOT NULL DEFAULT '',
          vibe TEXT NOT NULL DEFAULT '',
          explanation TEXT NOT NULL DEFAULT '',
          tip TEXT,
          garment_ids JSONB NOT NULL DEFAULT '[]',
          favorite BOOLEAN NOT NULL DEFAULT false,
          worn_dates JSONB NOT NULL DEFAULT '[]',
          tryon_url TEXT
        )`;
      await sql`CREATE INDEX IF NOT EXISTS garments_user_idx ON garments (user_id, created_at DESC)`;
      await sql`CREATE INDEX IF NOT EXISTS outfits_user_idx ON outfits (user_id, created_at DESC)`;
    })();
    schemaReady.catch(() => {
      schemaReady = null; // allow retry after transient failure
    });
  }
  return schemaReady;
}
