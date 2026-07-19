import { NextResponse } from "next/server";
import { aiTryOnImage, NoKeyError, type InlineImage } from "@/lib/server/ai";

export const maxDuration = 120;

interface TryOnRequest {
  person: InlineImage;
  garments: Array<InlineImage & { label: string }>;
  outfitTitle?: string;
}

export async function POST(req: Request) {
  try {
    const { person, garments, outfitTitle } = (await req.json()) as TryOnRequest;
    if (!person?.data || !garments?.length) {
      return NextResponse.json(
        { error: "missing person or garments" },
        { status: 400 }
      );
    }

    const garmentList = garments.map((g, i) => `${i + 2}. ${g.label}`).join("\n");
    const prompt =
      `VIRTUAL TRY-ON. Image 1 is the person. The remaining ${garments.length} image(s) are garments from their wardrobe:\n${garmentList}\n\n` +
      `Create ONE photorealistic, full-body fashion photo of this exact person wearing ALL the listed garments together` +
      (outfitTitle ? ` as the outfit "${outfitTitle}"` : "") +
      `.\n` +
      `- Preserve the person's identity exactly: face, skin tone, hair, body shape.\n` +
      `- Replace their current clothing with ONLY the provided garments; keep each garment's true color, pattern and details.\n` +
      `- Natural pose, soft studio light, clean warm-ivory background (#f5f0ea), editorial lookbook style.\n` +
      `- No text, watermarks, or extra people.`;

    const image = await aiTryOnImage({
      prompt,
      images: [person, ...garments.map(({ data, mimeType }) => ({ data, mimeType }))],
    });
    return NextResponse.json({ image });
  } catch (err) {
    if (err instanceof NoKeyError) {
      return NextResponse.json({ error: "no_key" }, { status: 503 });
    }
    console.error("tryon route:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "try-on failed" },
      { status: 502 }
    );
  }
}
