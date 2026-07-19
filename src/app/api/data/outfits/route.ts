import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
import { deleteImages, storeImage } from "@/lib/server/storage";
import type { OutfitWire } from "@/lib/wire";

export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToWire(r: any): OutfitWire {
  return {
    id: r.id,
    createdAt: Number(r.created_at),
    title: r.title,
    occasion: r.occasion,
    vibe: r.vibe,
    explanation: r.explanation,
    tip: r.tip ?? undefined,
    garmentIds: r.garment_ids ?? [],
    favorite: r.favorite,
    wornDates: (r.worn_dates ?? []).map(Number),
    ...(r.tryon_url ? { tryOn: { url: r.tryon_url } } : {}),
  };
}

function handleError(err: unknown) {
  if (err instanceof NoDbError) {
    return NextResponse.json({ error: "no_db" }, { status: 503 });
  }
  console.error("outfits route:", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "database error" },
    { status: 502 }
  );
}

async function requireUser() {
  await ensureSchema();
  return getSessionUserId();
}

export async function GET() {
  try {
    const userId = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const sql = getSql();
    const rows = await sql`
      SELECT * FROM outfits WHERE user_id = ${userId}
      ORDER BY created_at DESC`;
    return NextResponse.json({ outfits: (rows as any[]).map(rowToWire) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    const userId = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const o = (await req.json()) as OutfitWire;
    if (!o?.id || !o.garmentIds?.length) {
      return NextResponse.json({ error: "invalid outfit" }, { status: 400 });
    }
    const sql = getSql();
    const prevRows = await sql`
      SELECT tryon_url FROM outfits
      WHERE id = ${o.id} AND user_id = ${userId}`;
    const prev = (prevRows as any[])[0];

    const tryonUrl = o.tryOn
      ? await storeImage(o.tryOn, `outfits/${o.id}-tryon`)
      : null;

    await sql`
      INSERT INTO outfits (
        id, user_id, created_at, title, occasion, vibe, explanation, tip,
        garment_ids, favorite, worn_dates, tryon_url
      ) VALUES (
        ${o.id}, ${userId}, ${o.createdAt}, ${o.title}, ${o.occasion},
        ${o.vibe}, ${o.explanation}, ${o.tip ?? null},
        ${JSON.stringify(o.garmentIds)}::jsonb, ${o.favorite},
        ${JSON.stringify(o.wornDates)}::jsonb, ${tryonUrl}
      )
      ON CONFLICT (id) DO UPDATE SET
        title = EXCLUDED.title,
        occasion = EXCLUDED.occasion,
        vibe = EXCLUDED.vibe,
        explanation = EXCLUDED.explanation,
        tip = EXCLUDED.tip,
        garment_ids = EXCLUDED.garment_ids,
        favorite = EXCLUDED.favorite,
        worn_dates = EXCLUDED.worn_dates,
        tryon_url = EXCLUDED.tryon_url
      WHERE outfits.user_id = ${userId}`;

    if (prev?.tryon_url && prev.tryon_url !== tryonUrl) {
      await deleteImages([prev.tryon_url]);
    }
    return NextResponse.json({
      ok: true,
      ...(tryonUrl ? { tryOn: { url: tryonUrl } } : {}),
    });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const userId = await requireUser();
    if (!userId) {
      return NextResponse.json({ error: "unauthenticated" }, { status: 401 });
    }
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const sql = getSql();
    const rows = await sql`
      DELETE FROM outfits WHERE id = ${id} AND user_id = ${userId}
      RETURNING tryon_url`;
    const r = (rows as any[])[0];
    if (r) await deleteImages([r.tryon_url]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
