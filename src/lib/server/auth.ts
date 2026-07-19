/**
 * Server-only auth: scrypt password hashing (Node built-in, no deps) and
 * database-backed sessions carried by an httpOnly cookie.
 */
import { randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { ensureSchema, getSql } from "./db";

export const SESSION_COOKIE = "arshadrobe_session";
const SESSION_DAYS = 30;

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 64);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const expected = Buffer.from(hashHex, "hex");
  const actual = scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function validCredentials(
  username: unknown,
  password: unknown
): string | null {
  if (typeof username !== "string" || typeof password !== "string") {
    return "Username and password are required.";
  }
  if (!/^[a-z0-9_]{3,30}$/i.test(username)) {
    return "Username must be 3–30 letters, numbers or underscores.";
  }
  if (password.length < 6) {
    return "Password must be at least 6 characters.";
  }
  return null;
}

export async function createSession(userId: string): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  await sql`INSERT INTO sessions (token, user_id, expires_at)
            VALUES (${token}, ${userId}, ${expiresAt})`;
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_DAYS * 24 * 60 * 60,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      await ensureSchema();
      const sql = getSql();
      await sql`DELETE FROM sessions WHERE token = ${token}`;
    } catch {
      /* cookie cleanup below still applies */
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Resolve the logged-in user id from the session cookie, or null. */
export async function getSessionUserId(): Promise<string | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  await ensureSchema();
  const sql = getSql();
  const rows = await sql`
    SELECT user_id, expires_at FROM sessions WHERE token = ${token}`;
  /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  const row = (rows as any[])[0];
  if (!row) return null;
  if (Number(row.expires_at) < Date.now()) {
    await sql`DELETE FROM sessions WHERE token = ${token}`;
    return null;
  }
  return row.user_id as string;
}
