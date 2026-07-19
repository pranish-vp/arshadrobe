import { NextResponse } from "next/server";
import { aiJSON, NoKeyError } from "@/lib/server/ai";
import { str } from "@/lib/server/validate";
import type { OutfitOption, StylistContext } from "@/lib/types";

export const maxDuration = 60;

interface WardrobeItem {
  id: string;
  category: string;
  subcategory: string;
  colors: string[];
  pattern: string;
  material: string;
  seasons: string[];
  formality: string;
  description: string;
  favorite: boolean;
  wearCount: number;
}

const SYSTEM = `You are Arshadrobe, a warm and confident personal stylist.
You build complete outfits ONLY from the user's own wardrobe (given as a JSON inventory with ids).

Rules:
- Use only ids that exist in the inventory. Never invent items.
- A complete outfit = (one top + one bottom) OR one dress; add shoes if any exist in the wardrobe; optionally one outerwear (do add one when the weather is cool/cold/rainy) and up to two accessories.
- Never pair two of the same slot (two tops, two bottoms, or a dress with a bottom).
- Respect the occasion's dress code, the weather, and the requested vibe.
- Aim for color harmony; mention colors by name in the explanation.
- Favor variety across the options you return.

Return STRICT JSON:
{"options":[{"title": catchy 2-5 word name, "garmentIds": [...], "explanation": 2-3 warm specific sentences on why it works, "tip": one short styling tip}, ...]}
Return 3 options when the wardrobe allows it, otherwise as many complete outfits as possible (minimum 1).`;

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      garments: WardrobeItem[];
      context: StylistContext;
    };
    if (!Array.isArray(body.garments) || !body.garments.length) {
      return NextResponse.json({ error: "empty wardrobe" }, { status: 400 });
    }
    // Clamp everything that flows into the prompt.
    const garments = body.garments.slice(0, 300);
    const occasion = str(body.context?.occasion, 60, "Casual day");
    const vibe = str(body.context?.vibe, 60, "Comfy");
    const weather = str(body.context?.weather, 80, "Mild");
    const note = str(body.context?.note, 400);

    const result = await aiJSON<{ options: OutfitOption[] }>({
      system: SYSTEM,
      parts: [
        {
          text:
            `WARDROBE INVENTORY:\n${JSON.stringify(garments)}\n\n` +
            `TODAY:\n- Occasion: ${occasion}\n- Vibe: ${vibe}\n` +
            `- Weather: ${weather}\n` +
            (note ? `- The user adds: ${note}\n` : "") +
            `\nStyle me. Respond with the JSON only.`,
        },
      ],
    });

    // Guard against hallucinated ids / incomplete looks.
    const known = new Set(garments.map((g) => g.id));
    const options = (result.options ?? [])
      .map((o) => ({
        ...o,
        garmentIds: (o.garmentIds ?? []).filter((id) => known.has(id)),
      }))
      .filter((o) => o.garmentIds.length >= 2)
      .slice(0, 3);

    if (!options.length) {
      return NextResponse.json({ error: "no valid outfits" }, { status: 502 });
    }
    return NextResponse.json({ options });
  } catch (err) {
    if (err instanceof NoKeyError) {
      return NextResponse.json({ error: "no_key" }, { status: 503 });
    }
    console.error("stylist route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "styling failed" },
      { status: 502 }
    );
  }
}
