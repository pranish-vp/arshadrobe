import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";

export async function GET() {
  try {
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`SELECT id, username FROM users WHERE id = ${userId}`;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const user = (rows as any[])[0];
    if (!user) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    return NextResponse.json({ user });
  } catch (err) {
    if (err instanceof NoDbError) {
      return NextResponse.json({ error: "no_db" }, { status: 503 });
    }
    console.error("me route:", err);
    return NextResponse.json({ error: "auth check failed" }, { status: 502 });
  }
}
