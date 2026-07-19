import { NextResponse } from "next/server";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
import type { GarmentWire } from "@/lib/wire";

export const maxDuration = 60;

/* eslint-disable @typescript-eslint/no-explicit-any */
function rowToWire(r: any): GarmentWire {
  return {
    id: r.id,
    createdAt: Number(r.created_at),
    category: r.category,
    subcategory: r.subcategory,
    colors: r.colors ?? [],
    pattern: r.pattern,
    material: r.material,
    seasons: r.seasons ?? ["all"],
    formality: r.formality,
    description: r.description,
    favorite: r.favorite,
    wearCount: r.wear_count,
    image: { data: r.image_data, mimeType: r.image_mime },
    ...(r.cutout_data
      ? { cutout: { data: r.cutout_data, mimeType: r.cutout_mime } }
      : {}),
  };
}

function handleError(err: unknown) {
  if (err instanceof NoDbError) {
    return NextResponse.json({ error: "no_db" }, { status: 503 });
  }
  console.error("garments route:", err);
  return NextResponse.json(
    { error: err instanceof Error ? err.message : "database error" },
    { status: 502 }
  );
}

export async function GET() {
  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql`SELECT * FROM garments ORDER BY created_at DESC`;
    return NextResponse.json({ garments: (rows as any[]).map(rowToWire) });
  } catch (err) {
    return handleError(err);
  }
}

export async function PUT(req: Request) {
  try {
    await ensureSchema();
    const g = (await req.json()) as GarmentWire;
    if (!g?.id || !g.image?.data) {
      return NextResponse.json({ error: "invalid garment" }, { status: 400 });
    }
    const sql = getSql();
    await sql`
      INSERT INTO garments (
        id, created_at, category, subcategory, colors, pattern, material,
        seasons, formality, description, favorite, wear_count,
        image_data, image_mime, cutout_data, cutout_mime
      ) VALUES (
        ${g.id}, ${g.createdAt}, ${g.category}, ${g.subcategory},
        ${JSON.stringify(g.colors)}::jsonb, ${g.pattern}, ${g.material},
        ${JSON.stringify(g.seasons)}::jsonb, ${g.formality}, ${g.description},
        ${g.favorite}, ${g.wearCount},
        ${g.image.data}, ${g.image.mimeType},
        ${g.cutout?.data ?? null}, ${g.cutout?.mimeType ?? null}
      )
      ON CONFLICT (id) DO UPDATE SET
        category = EXCLUDED.category,
        subcategory = EXCLUDED.subcategory,
        colors = EXCLUDED.colors,
        pattern = EXCLUDED.pattern,
        material = EXCLUDED.material,
        seasons = EXCLUDED.seasons,
        formality = EXCLUDED.formality,
        description = EXCLUDED.description,
        favorite = EXCLUDED.favorite,
        wear_count = EXCLUDED.wear_count,
        image_data = EXCLUDED.image_data,
        image_mime = EXCLUDED.image_mime,
        cutout_data = EXCLUDED.cutout_data,
        cutout_mime = EXCLUDED.cutout_mime`;
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
    await sql`DELETE FROM garments WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
