import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
import { deleteImages, storeImage } from "@/lib/server/storage";
import { str, strArray, validImage } from "@/lib/server/validate";
import type { ProfileWire } from "@/lib/wire";

export const maxDuration = 60;

function handleError(err: unknown) {
  if (err instanceof NoDbError) {
    return NextResponse.json({ error: "no_db" }, { status: 503 });
  }
  console.error("profile route:", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "database error" },
    { status: 502 }
  );
}

export async function GET() {
  try {
    await ensureSchema();
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const sql = getSql();
    const rows = await sql`SELECT * FROM profiles WHERE user_id = ${userId}`;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const r = (rows as any[])[0];
    if (!r) return NextResponse.json({ profile: null });
    const profile: ProfileWire = {
      name: r.name,
      vibes: r.vibes ?? [],
      onboarded: r.onboarded,
      ...(r.photo_url ? { photo: { url: r.photo_url } } : {}),
    };
    return NextResponse.json({ profile });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const userId = await getSessionUserId();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const raw = (await req.json()) as ProfileWire;
    if (raw?.photo && !validImage(raw.photo)) {
      return NextResponse.json({ error: "invalid photo" }, { status: 400 });
    }
    const p: ProfileWire = {
      name: str(raw?.name, 40),
      vibes: strArray(raw?.vibes, 12, 30),
      onboarded: Boolean(raw?.onboarded),
      ...(raw?.photo ? { photo: raw.photo } : {}),
    };
    const sql = getSql();
    const prevRows = await sql`
      SELECT photo_url FROM profiles WHERE user_id = ${userId}`;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const prev = (prevRows as any[])[0];

    const photoUrl = p.photo
      ? await storeImage(p.photo, `profiles/${userId}`)
      : null;

    await sql`
      INSERT INTO profiles (user_id, name, vibes, onboarded, photo_url)
      VALUES (
        ${userId}, ${p.name}, ${JSON.stringify(p.vibes)}::jsonb,
        ${p.onboarded}, ${photoUrl}
      )
      ON CONFLICT (user_id) DO UPDATE SET
        name = EXCLUDED.name,
        vibes = EXCLUDED.vibes,
        onboarded = EXCLUDED.onboarded,
        photo_url = EXCLUDED.photo_url`;

    if (prev?.photo_url && prev.photo_url !== photoUrl) {
      await deleteImages([prev.photo_url]);
    }
    return NextResponse.json({
      ok: true,
      ...(photoUrl ? { photo: { url: photoUrl } } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}
