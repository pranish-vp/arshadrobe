import { NextResponse } from "next/server";
import { createSession, verifyPassword } from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();
    if (typeof username !== "string" || typeof password !== "string") {
      return NextResponse.json(
        { error: "Username and password are required." },
        { status: 400 }
      );
    }
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`
      SELECT id, username, password_hash FROM users
      WHERE username = ${username.toLowerCase()}`;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const user = (rows as any[])[0];
    if (!user || !verifyPassword(password, user.password_hash)) {
      return NextResponse.json(
        { error: "Wrong username or password." },
        { status: 401 }
      );
    }
    await createSession(user.id);
    return NextResponse.json({
      user: { id: user.id, username: user.username },
    });
  } catch (err) {
    if (err instanceof NoDbError) {
      return NextResponse.json({ error: "no_db" }, { status: 503 });
    }
    console.error("login route:", err);
    return NextResponse.json({ error: "Login failed" }, { status: 502 });
  }
}
