import { NextResponse } from "next/server";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";

export async function POST() {
  try {
    await ensureSchema();
    const sql = getSql();
    await sql`DELETE FROM garments`;
    await sql`DELETE FROM outfits`;
    await sql`DELETE FROM profile`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof NoDbError) {
      return NextResponse.json({ error: "no_db" }, { status: 503 });
    }
    console.error("clear route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "database error" },
      { status: 502 }
    );
  }
}
