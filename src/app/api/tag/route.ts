import { NextResponse } from "next/server";
import { aiJSON, NoKeyError } from "@/lib/server/ai";
import type { GarmentTags } from "@/lib/types";

export const maxDuration = 60;

const SYSTEM = `You are the cataloging assistant for a personal wardrobe app.
Analyze the single garment in the photo and return STRICT JSON with exactly these keys:
{
  "category": one of ["top","bottom","dress","outerwear","shoes","accessory","other"],
  "subcategory": short lowercase noun, e.g. "t-shirt","jeans","sneakers","blazer","midi dress",
  "colors": array of 1-3 lowercase simple color names, dominant first,
  "pattern": one of ["solid","striped","checked","floral","graphic","textured","other"],
  "material": best-guess lowercase material, e.g. "cotton","denim","leather","knit",
  "seasons": subset of ["spring","summer","autumn","winter"] or ["all"],
  "formality": one of ["casual","smart-casual","formal","sport"],
  "description": one short sentence a stylist would find useful
}
If multiple garments are visible, describe the most prominent one.`;

export async function POST(req: Request) {
  try {
    const { image } = (await req.json()) as {
      image: { data: string; mimeType: string };
    };
    if (!image?.data) {
      return NextResponse.json({ error: "missing image" }, { status: 400 });
    }
    const tags = await aiJSON<GarmentTags>({
      system: SYSTEM,
      parts: [
        { inlineData: { data: image.data, mimeType: image.mimeType } },
        { text: "Catalog this garment. Respond with the JSON only." },
      ],
    });
    return NextResponse.json({ tags });
  } catch (err) {
    if (err instanceof NoKeyError) {
      return NextResponse.json({ error: "no_key" }, { status: 503 });
    }
    console.error("tag route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "tagging failed" },
      { status: 502 }
    );
  }
}
