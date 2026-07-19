import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
import { deleteImages } from "@/lib/server/storage";

/** Erase the logged-in user's wardrobe, looks and profile (not the account). */
export async function POST() {
  try {
    await ensureSchema();
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const sql = getSql();
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const g = await sql`
      DELETE FROM garments WHERE user_id = ${userId}
      RETURNING image_url, cutout_url`;
    const o = await sql`
      DELETE FROM outfits WHERE user_id = ${userId} RETURNING tryon_url`;
    const p = await sql`
      DELETE FROM profiles WHERE user_id = ${userId} RETURNING photo_url`;
    await deleteImages([
      ...(g as any[]).flatMap((r) => [r.image_url, r.cutout_url]),
      ...(o as any[]).map((r) => r.tryon_url),
      ...(p as any[]).map((r) => r.photo_url),
    ]);
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
