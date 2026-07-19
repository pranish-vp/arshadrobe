/**
 * Server-only AI client supporting BOTH providers, REST only (no SDKs):
 *
 *  - Gemini (free tier) — preferred when GEMINI_API_KEY is set
 *  - OpenAI — used when it's the only key, or as automatic fallback
 *
 * Every call walks the provider order and falls through on failure, so an
 * exhausted quota on one provider doesn't take the feature down.
 *
 * Gemini model names are resolved dynamically: if the default model 404s
 * (e.g. "not available to new users"), we list the models THIS key can use
 * and pick the best match — no hardcoded-name breakage.
 */

const OPENAI_API = "https://api.openai.com/v1";
const GEMINI_API = "https://generativelanguage.googleapis.com/v1beta";

type Provider = "openai" | "gemini";

const OPENAI_TEXT = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
// Cheapest image model by default (~$0.006/portrait at low quality).
// Bump OPENAI_IMAGE_QUALITY to "medium" ($0.015) if renders look too soft.
const OPENAI_IMAGE = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1-mini";
const OPENAI_IMAGE_QUALITY = process.env.OPENAI_IMAGE_QUALITY || "low";
const GEMINI_TEXT_DEFAULT = process.env.GEMINI_TEXT_MODEL || "gemini-2.5-flash";
const GEMINI_IMAGE_DEFAULT =
  process.env.GEMINI_IMAGE_MODEL || "gemini-2.5-flash-image";

export class NoKeyError extends Error {
  constructor() {
    super("No AI provider key configured (OPENAI_API_KEY or GEMINI_API_KEY)");
  }
}

export interface InlineImage {
  data: string; // base64, no data: prefix
  mimeType: string;
}

type Part = { text: string } | { inlineData: InlineImage };

function hasOpenAI(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}
function hasGemini(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

export function hasApiKey(): boolean {
  return hasOpenAI() || hasGemini();
}

/** Preferred-first provider order. Gemini leads by default (free tier). */
function providerOrder(): Provider[] {
  const order: Provider[] = [];
  const pref = process.env.AI_PROVIDER as Provider | undefined;
  if (pref === "openai" && hasOpenAI()) order.push("openai");
  if (pref === "gemini" && hasGemini()) order.push("gemini");
  if (hasGemini() && !order.includes("gemini")) order.push("gemini");
  if (hasOpenAI() && !order.includes("openai")) order.push("openai");
  return order;
}

export function activeModels(): {
  provider: Provider | null;
  textModel: string;
  imageModel: string;
} {
  const primary = providerOrder()[0] ?? null;
  if (primary === "gemini") {
    return {
      provider: "gemini",
      textModel: resolvedGeminiText ?? GEMINI_TEXT_DEFAULT,
      imageModel: resolvedGeminiImage ?? GEMINI_IMAGE_DEFAULT,
    };
  }
  if (primary === "openai") {
    return { provider: "openai", textModel: OPENAI_TEXT, imageModel: OPENAI_IMAGE };
  }
  return { provider: null, textModel: "-", imageModel: "-" };
}

async function withProviders<T>(
  fn: (provider: Provider) => Promise<T>
): Promise<T> {
  const order = providerOrder();
  if (!order.length) throw new NoKeyError();
  let lastError: unknown;
  for (const provider of order) {
    try {
      return await fn(provider);
    } catch (err) {
      lastError = err;
      console.warn(`AI provider ${provider} failed, trying next:`, err);
    }
  }
  throw lastError;
}

/* ================= Gemini ================= */

// Resolved-at-runtime model names (survive "model not available" accounts).
let resolvedGeminiText: string | null = null;
let resolvedGeminiImage: string | null = null;

async function geminiFetch(path: string, body?: unknown): Promise<Response> {
  return fetch(`${GEMINI_API}/${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY!,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}

/** List generateContent-capable models available to THIS key. */
async function listGeminiModels(): Promise<string[]> {
  const res = await geminiFetch("models?pageSize=200");
  if (!res.ok) return [];
  const json = (await res.json()) as {
    models?: Array<{ name: string; supportedGenerationMethods?: string[] }>;
  };
  return (json.models ?? [])
    .filter((m) => m.supportedGenerationMethods?.includes("generateContent"))
    .map((m) => m.name.replace(/^models\//, ""));
}

function versionOf(name: string): number {
  const m = name.match(/gemini-(\d+(?:\.\d+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

function pickGeminiModel(models: string[], kind: "text" | "image"): string | null {
  const isImage = (n: string) => /image/i.test(n);
  const unwanted = /(embed|tts|audio|live|veo|imagen)/i;
  const pool = models.filter(
    (n) => !unwanted.test(n) && (kind === "image" ? isImage(n) : !isImage(n))
  );
  if (!pool.length) return null;
  // Newest version first; prefer flash (fast/cheap) over pro; stable over preview.
  return pool.sort(
    (a, b) =>
      versionOf(b) - versionOf(a) ||
      Number(/flash/.test(b)) - Number(/flash/.test(a)) ||
      Number(!/preview|exp/.test(b)) - Number(!/preview|exp/.test(a))
  )[0];
}

async function callGemini(
  kind: "text" | "image",
  body: Record<string, unknown>
): Promise<unknown> {
  let model =
    kind === "text"
      ? (resolvedGeminiText ?? GEMINI_TEXT_DEFAULT)
      : (resolvedGeminiImage ?? GEMINI_IMAGE_DEFAULT);

  let res = await geminiFetch(`models/${model}:generateContent`, body);
  if (res.status === 404) {
    // Model not available to this account — discover what is, retry once.
    const available = await listGeminiModels();
    const picked = pickGeminiModel(available, kind);
    if (!picked) {
      throw new Error(
        `Gemini: no ${kind} model available to this API key (tried ${model})`
      );
    }
    if (kind === "text") resolvedGeminiText = picked;
    else resolvedGeminiImage = picked;
    model = picked;
    res = await geminiFetch(`models/${model}:generateContent`, body);
  }
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Gemini ${model} error ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json();
}

async function geminiJSON<T>(opts: {
  system?: string;
  parts: Part[];
}): Promise<T> {
  const json = (await callGemini("text", {
    ...(opts.system
      ? { systemInstruction: { parts: [{ text: opts.system }] } }
      : {}),
    contents: [{ role: "user", parts: opts.parts }],
    generationConfig: { responseMimeType: "application/json" },
  })) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
  if (!text) throw new Error("Gemini returned no content");
  return JSON.parse(text) as T;
}

async function geminiImage(opts: {
  prompt: string;
  images: InlineImage[];
}): Promise<InlineImage> {
  const json = (await callGemini("image", {
    contents: [
      {
        role: "user",
        parts: [
          { text: opts.prompt },
          ...opts.images.map((img) => ({
            inlineData: { data: img.data, mimeType: img.mimeType },
          })),
        ],
      },
    ],
    generationConfig: { responseModalities: ["IMAGE", "TEXT"] },
  })) as {
    candidates?: Array<{
      content?: { parts?: Array<{ inlineData?: InlineImage; text?: string }> };
    }>;
  };
  const img = json.candidates?.[0]?.content?.parts?.find(
    (p) => p.inlineData
  )?.inlineData;
  if (!img) {
    const text = json.candidates?.[0]?.content?.parts?.find((p) => p.text)?.text;
    throw new Error(
      `Gemini returned no image${text ? `: ${text.slice(0, 200)}` : ""}`
    );
  }
  return img;
}

/* ================= OpenAI ================= */

async function openaiJSON<T>(opts: {
  system?: string;
  parts: Part[];
}): Promise<T> {
  const content = opts.parts.map((p) =>
    "text" in p
      ? { type: "text" as const, text: p.text }
      : {
          type: "image_url" as const,
          image_url: {
            url: `data:${p.inlineData.mimeType};base64,${p.inlineData.data}`,
          },
        }
  );
  const res = await fetch(`${OPENAI_API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: OPENAI_TEXT,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenAI ${OPENAI_TEXT} error ${res.status}: ${text.slice(0, 300)}`
    );
  }
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content");
  return JSON.parse(text) as T;
}

async function openaiImage(opts: {
  prompt: string;
  images: InlineImage[];
}): Promise<InlineImage> {
  const form = new FormData();
  form.append("model", OPENAI_IMAGE);
  form.append("prompt", opts.prompt);
  form.append("size", "1024x1536");
  form.append("quality", OPENAI_IMAGE_QUALITY);
  // input_fidelity=high sharply improves face preservation but is only
  // supported (and billed heavily) on the full-size models.
  if (!OPENAI_IMAGE.includes("mini")) {
    form.append("input_fidelity", "high");
  }
  opts.images.forEach((img, i) => {
    const bytes = Buffer.from(img.data, "base64");
    const ext = img.mimeType.includes("png") ? "png" : "jpg";
    form.append(
      "image[]",
      new Blob([new Uint8Array(bytes)], { type: img.mimeType }),
      `image-${i}.${ext}`
    );
  });
  const res = await fetch(`${OPENAI_API}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `OpenAI ${OPENAI_IMAGE} error ${res.status}: ${text.slice(0, 300)}`
    );
  }
  const json = (await res.json()) as { data?: Array<{ b64_json?: string }> };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return { data: b64, mimeType: "image/png" };
}

/* ================= Public API (provider-agnostic) ================= */

/** Text/vision call that must return strict JSON. */
export function aiJSON<T>(opts: {
  system?: string;
  parts: Part[];
}): Promise<T> {
  return withProviders((p) =>
    p === "gemini" ? geminiJSON<T>(opts) : openaiJSON<T>(opts)
  );
}

/** Virtual try-on: person + garment photos in, one rendered image out. */
export function aiTryOnImage(opts: {
  prompt: string;
  images: InlineImage[];
}): Promise<InlineImage> {
  return withProviders((p) =>
    p === "gemini" ? geminiImage(opts) : openaiImage(opts)
  );
}
