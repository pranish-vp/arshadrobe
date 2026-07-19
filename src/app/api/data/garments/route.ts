import { NextResponse } from "next/server";
import { getSessionUserId } from "@/lib/server/auth";
import { ensureSchema, getSql, NoDbError } from "@/lib/server/db";
import { deleteImages, storeImage } from "@/lib/server/storage";
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
    image: { url: r.image_url },
    ...(r.cutout_url ? { cutout: { url: r.cutout_url } } : {}),
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
      SELECT * FROM garments WHERE user_id = ${userId}
      ORDER BY created_at DESC`;
    return NextResponse.json({ garments: (rows as any[]).map(rowToWire) });
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
    const g = (await req.json()) as GarmentWire;
    if (!g?.id || (!g.image?.data && !g.image?.url)) {
      return NextResponse.json({ error: "invalid garment" }, { status: 400 });
    }
    const sql = getSql();
    const prevRows = await sql`
      SELECT image_url, cutout_url FROM garments
      WHERE id = ${g.id} AND user_id = ${userId}`;
    const prev = (prevRows as any[])[0];

    const imageUrl = await storeImage(g.image, `garments/${g.id}`);
    const cutoutUrl = g.cutout
      ? await storeImage(g.cutout, `garments/${g.id}-cutout`)
      : null;

    await sql`
      INSERT INTO garments (
        id, user_id, created_at, category, subcategory, colors, pattern,
        material, seasons, formality, description, favorite, wear_count,
        image_url, cutout_url
      ) VALUES (
        ${g.id}, ${userId}, ${g.createdAt}, ${g.category}, ${g.subcategory},
        ${JSON.stringify(g.colors)}::jsonb, ${g.pattern}, ${g.material},
        ${JSON.stringify(g.seasons)}::jsonb, ${g.formality}, ${g.description},
        ${g.favorite}, ${g.wearCount}, ${imageUrl}, ${cutoutUrl}
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
        image_url = EXCLUDED.image_url,
        cutout_url = EXCLUDED.cutout_url
      WHERE garments.user_id = ${userId}`;

    // Clean up hosted files that were replaced by this update.
    if (prev) {
      await deleteImages([
        prev.image_url !== imageUrl ? prev.image_url : null,
        prev.cutout_url && prev.cutout_url !== cutoutUrl ? prev.cutout_url : null,
      ]);
    }
    return NextResponse.json({
      ok: true,
      image: { url: imageUrl },
      ...(cutoutUrl ? { cutout: { url: cutoutUrl } } : {}),
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
      DELETE FROM garments WHERE id = ${id} AND user_id = ${userId}
      RETURNING image_url, cutout_url`;
    const r = (rows as any[])[0];
    if (r) await deleteImages([r.image_url, r.cutout_url]);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleError(err);
  }
}
