import { NextResponse } from "next/server";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
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
    const sql = getSql();
    const rows = await sql`SELECT * FROM profile WHERE id = 'me'`;
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
    const r = (rows as any[])[0];
    if (!r) return NextResponse.json({ profile: null });
    const profile: ProfileWire = {
      name: r.name,
      vibes: r.vibes ?? [],
      onboarded: r.onboarded,
      ...(r.photo_data
        ? { photo: { data: r.photo_data, mimeType: r.photo_mime } }
        : {}),
    };
    return NextResponse.json({ profile });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const p = (await req.json()) as ProfileWire;
    const sql = getSql();
    await sql`
      INSERT INTO profile (id, name, vibes, onboarded, photo_data, photo_mime)
      VALUES (
        'me', ${p.name}, ${JSON.stringify(p.vibes)}::jsonb, ${p.onboarded},
        ${p.photo?.data ?? null}, ${p.photo?.mimeType ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        vibes = EXCLUDED.vibes,
        onboarded = EXCLUDED.onboarded,
        photo_data = EXCLUDED.photo_data,
        photo_mime = EXCLUDED.photo_mime`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
