/**
 * Server-only OpenAI client (REST, no SDK). The API key never leaves the
 * server — the browser talks to our /api routes, which talk to OpenAI.
 */

const API = "https://api.openai.com/v1";

export const TEXT_MODEL = process.env.OPENAI_TEXT_MODEL || "gpt-5-mini";
export const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export function hasApiKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

export class NoKeyError extends Error {
  constructor() {
    super("OPENAI_API_KEY is not configured");
  }
}

export interface InlineImage {
  data: string; // base64, no data: prefix
  mimeType: string;
}

type Part = { text: string } | { inlineData: InlineImage };

function requireKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new NoKeyError();
  return key;
}

async function fail(res: Response, what: string): Promise<never> {
  const text = await res.text().catch(() => "");
  throw new Error(`OpenAI ${what} error ${res.status}: ${text.slice(0, 300)}`);
}

/** Text/vision call that must return strict JSON. */
export async function aiJSON<T>(opts: {
  system?: string;
  parts: Part[];
}): Promise<T> {
  const key = requireKey();
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
  const res = await fetch(`${API}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: TEXT_MODEL,
      messages: [
        ...(opts.system ? [{ role: "system", content: opts.system }] : []),
        { role: "user", content },
      ],
      response_format: { type: "json_object" },
    }),
  });
  if (!res.ok) await fail(res, TEXT_MODEL);
  const json = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = json.choices?.[0]?.message?.content;
  if (!text) throw new Error("OpenAI returned no content");
  return JSON.parse(text) as T;
}

/**
 * Virtual try-on via the images/edits endpoint: person + garment photos in,
 * one rendered image out. `input_fidelity: high` keeps the face accurate.
 */
export async function aiTryOnImage(opts: {
  prompt: string;
  images: InlineImage[];
}): Promise<InlineImage> {
  const key = requireKey();
  const form = new FormData();
  form.append("model", IMAGE_MODEL);
  form.append("prompt", opts.prompt);
  form.append("size", "1024x1536"); // portrait, full-body friendly
  form.append("input_fidelity", "high");
  opts.images.forEach((img, i) => {
    const bytes = Buffer.from(img.data, "base64");
    const ext = img.mimeType.includes("png") ? "png" : "jpg";
    form.append(
      "image[]",
      new Blob([new Uint8Array(bytes)], { type: img.mimeType }),
      `image-${i}.${ext}`
    );
  });
  const res = await fetch(`${API}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!res.ok) await fail(res, IMAGE_MODEL);
  const json = (await res.json()) as {
    data?: Array<{ b64_json?: string }>;
  };
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error("OpenAI returned no image");
  return { data: b64, mimeType: "image/png" };
}
