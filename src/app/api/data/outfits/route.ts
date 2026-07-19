import { NextResponse } from "next/server";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
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
    ...(r.tryon_data
      ? { tryOn: { data: r.tryon_data, mimeType: r.tryon_mime } }
      : {}),
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

export async function GET() {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM outfits ORDER BY created_at DESC`;
    return NextResponse.json({ outfits: (rows as any[]).map(rowToWire) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const o = (await req.json()) as OutfitWire;
    if (!o?.id || !o.garmentIds?.length) {
      return NextResponse.json({ error: "invalid outfit" }, { status: 400 });
    }
    const sql = getSql();
    await sql`
      INSERT INTO outfits (
        id, created_at, title, occasion, vibe, explanation, tip,
        garment_ids, favorite, worn_dates, tryon_data, tryon_mime
      ) VALUES (
        ${o.id}, ${o.createdAt}, ${o.title}, ${o.occasion}, ${o.vibe},
        ${o.explanation}, ${o.tip ?? null},
        ${JSON.stringify(o.garmentIds)}::jsonb, ${o.favorite},
        ${JSON.stringify(o.wornDates)}::jsonb,
        ${o.tryOn?.data ?? null}, ${o.tryOn?.mimeType ?? null}
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
        tryon_data = EXCLUDED.tryon_data,
        tryon_mime = EXCLUDED.tryon_mime`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureSchema();
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });
    const sql = getSql();
    await sql`DELETE FROM outfits WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
