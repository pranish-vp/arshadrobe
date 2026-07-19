/**
 * Demo-mode stylist: a rule-based outfit builder used when no OpenAI API
 * key is configured (or the API call fails). Keeps the whole app usable
 * offline — the AI stylist simply gets smarter when a key is added.
 */
import type {
  Formality,
  Garment,
  OutfitOption,
  StylistContext,
} from "./types";

const OCCASION_FORMALITY: Record<string, Formality[]> = {
  "Casual day": ["casual", "smart-casual"],
  Work: ["smart-casual", "formal", "casual"],
  "Date night": ["smart-casual", "formal", "casual"],
  Party: ["smart-casual", "formal", "casual"],
  "Wedding / event": ["formal", "smart-casual"],
  Workout: ["sport", "casual"],
  Travel: ["casual", "smart-casual", "sport"],
};

const NEUTRALS = new Set([
  "black", "white", "grey", "gray", "beige", "cream", "navy", "tan",
  "brown", "khaki", "denim", "off-white", "ivory", "charcoal",
]);

function isCold(weather: string): boolean {
  return /cold|cool|snow|❄/i.test(weather);
}
function isWet(weather: string): boolean {
  return /rain|drizzle|storm|snow/i.test(weather);
}

function score(g: Garment, ctx: StylistContext, offset: number): number {
  const wanted = OCCASION_FORMALITY[ctx.occasion] ?? ["casual", "smart-casual"];
  const idx = wanted.indexOf(g.formality);
  let s = idx === -1 ? -4 : (wanted.length - idx) * 3;
  if (g.favorite) s += 2;
  s += Math.max(0, 2 - g.wearCount * 0.4); // gently favor less-worn pieces
  if (g.colors.some((c) => NEUTRALS.has(c.toLowerCase()))) s += 0.5;
  // Deterministic per-option variety without Math.random.
  s += ((g.id.charCodeAt(0) + g.id.charCodeAt(g.id.length - 1) + offset * 7) % 5) * 0.6;
  return s;
}

function pick(pool: Garment[], ctx: StylistContext, offset: number): Garment | undefined {
  return [...pool].sort((a, b) => score(b, ctx, offset) - score(a, ctx, offset))[0];
}

function buildOption(
  garments: Garment[],
  ctx: StylistContext,
  offset: number
): OutfitOption | null {
  const by = (cat: string) => garments.filter((g) => g.category === cat);
  const picks: Garment[] = [];

  const dress = pick(by("dress"), ctx, offset);
  const top = pick(by("top"), ctx, offset);
  const bottom = pick(by("bottom"), ctx, offset);

  // Alternate between dress-led and separates-led options for variety.
  const useDress = dress && (offset % 2 === 1 || !top || !bottom);
  if (useDress && dress) picks.push(dress);
  else if (top && bottom) picks.push(top, bottom);
  else if (top || bottom || dress) picks.push(...([dress ?? top ?? bottom] as Garment[]));
  else return null;

  const shoes = pick(by("shoes"), ctx, offset);
  if (shoes) picks.push(shoes);
  if (isCold(ctx.weather) || isWet(ctx.weather)) {
    const layer = pick(by("outerwear"), ctx, offset);
    if (layer) picks.push(layer);
  }
  const accessory = pick(by("accessory"), ctx, offset);
  if (accessory && picks.length >= 2) picks.push(accessory);

  if (picks.length < 2) return null;

  const colorWord = picks[0].colors[0] ?? "tonal";
  const titles = [
    `The ${colorWord} moment`,
    `Effortless ${ctx.occasion.toLowerCase()}`,
    `${ctx.vibe} & easy`,
  ];
  const weatherNote = isWet(ctx.weather)
    ? " A weather-proof pick for the forecast."
    : isCold(ctx.weather)
      ? " Layered up for the chill."
      : "";
  return {
    title: titles[offset % titles.length],
    garmentIds: picks.map((g) => g.id),
    explanation:
      `Built around your ${picks[0].colors.join(" and ")} ${picks[0].subcategory || picks[0].category}, ` +
      `keeping things ${ctx.vibe.toLowerCase()} for ${ctx.occasion.toLowerCase()}.${weatherNote}`,
    tip: "Add an OpenAI API key (see Profile) to unlock the full AI stylist and try-on.",
  };
}

export function fallbackOutfits(
  garments: Garment[],
  ctx: StylistContext
): OutfitOption[] {
  const options: OutfitOption[] = [];
  const seen = new Set<string>();
  for (let offset = 0; offset < 6 && options.length < 3; offset++) {
    const opt = buildOption(garments, ctx, offset);
    if (!opt) continue;
    const key = [...opt.garmentIds].sort().join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    options.push(opt);
  }
  return options;
}
