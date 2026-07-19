import { NextResponse } from "next/server";
import {
  createSession,
  hashPassword,
  validCredentials,
} from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    const invalid = validCredentials(username, password);
    if (invalid) return NextResponse.json({ error: invalid }, { status: 400 });

    await ensureSchema();
    const sql = getSql();
    const uname = (username as string).toLowerCase();
    const existing = (await sql`
      SELECT 1 FROM users WHERE username = ${uname}`) as unknown[];
    if (existing.length) {
      return NextResponse.json(
        { error: "That username is taken — try another." },
        { status: 409 }
      );
    }
    const id = `u-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    await sql`INSERT INTO users (id, username, password_hash, created_at)
              VALUES (${id}, ${uname}, ${hashPassword(password)}, ${Date.now()})`;
    await createSession(id);
    return NextResponse.json({ user: { id, username: uname } });
  } catch (err) {
    if (err instanceof NoDbError) {
      return NextResponse.json({ error: "no_db" }, { status: 503 });
    }
    console.error("signup route:", err);
    return NextResponse.json({ error: "Sign up failed" }, { status: 502 });
  }
}
