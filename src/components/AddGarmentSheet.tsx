"use client";

import { useCallback, useRef, useState } from "react";
import { Camera, Check, Loader2, Sparkles, Trash2, X } from "lucide-react";
import { putGarment, uid } from "@/lib/db";
import { blobToBase64, resizeToJpeg, tryRemoveBackground } from "@/lib/images";
import {
  CATEGORIES,
  FORMALITIES,
  PATTERNS,
  type Garment,
  type GarmentTags,
} from "@/lib/types";

type ItemStatus = "queued" | "processing" | "ready" | "error";

interface DraftItem {
  id: string;
  original: Blob;
  cutout?: Blob;
  previewUrl: string;
  status: ItemStatus;
  stageLabel?: string;
  aiTagged: boolean;
  tags: GarmentTags;
}

const DEFAULT_TAGS: GarmentTags = {
  category: "top",
  subcategory: "",
  colors: [],
  pattern: "solid",
  material: "",
  seasons: ["all"],
  formality: "casual",
  description: "",
};

export default function AddGarmentSheet({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: () => void;
}) {
  const [items, setItems] = useState<DraftItem[]>([]);
  const [removeBg, setRemoveBg] = useState(true);
  const [saving, setSaving] = useState(false);
  const [noKey, setNoKey] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const removeBgRef = useRef(removeBg);
  removeBgRef.current = removeBg;

  const patch = useCallback((id: string, p: Partial<DraftItem>) => {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...p } : it)));
  }, []);

  const patchTags = (id: string, p: Partial<GarmentTags>) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, tags: { ...it.tags, ...p } } : it))
    );
  };

  const processItem = useCallback(
    async (id: string, file: Blob) => {
      patch(id, { status: "processing" });
      try {
        const resized = await resizeToJpeg(file, 1024);
        patch(id, { original: resized, previewUrl: URL.createObjectURL(resized) });

        // Auto-tag with AI (falls back to manual tags in demo mode).
        let tags = { ...DEFAULT_TAGS };
        let aiTagged = false;
        try {
          const image = await blobToBase64(resized);
          const res = await fetch("/api/tag", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ image }),
          });
          if (res.ok) {
            const json = await res.json();
            tags = { ...DEFAULT_TAGS, ...json.tags };
            aiTagged = true;
          } else if (res.status === 503) {
            setNoKey(true);
          }
        } catch {
          /* offline — manual tagging */
        }

        // In-browser background removal (in a worker; model cached after first run).
        let cutout: Blob | undefined;
        if (removeBgRef.current) {
          patch(id, { stageLabel: "Removing background…" });
          const cut = await tryRemoveBackground(resized, (label) =>
            patch(id, { stageLabel: label })
          );
          if (cut) cutout = cut;
        }

        patch(id, {
          status: "ready",
          tags,
          aiTagged,
          cutout,
          ...(cutout ? { previewUrl: URL.createObjectURL(cutout) } : {}),
        });
      } catch (err) {
        console.error(err);
        patch(id, { status: "error" });
      }
    },
    [patch]
  );

  const onFiles = (files: FileList | null) => {
    if (!files?.length) return;
    const drafts: DraftItem[] = Array.from(files).map((f) => ({
      id: uid(),
      original: f,
      previewUrl: URL.createObjectURL(f),
      status: "queued" as ItemStatus,
      aiTagged: false,
      tags: { ...DEFAULT_TAGS },
    }));
    setItems((prev) => [...prev, ...drafts]);
    // Process sequentially to keep memory + API usage calm.
    (async () => {
      for (const d of drafts) await processItem(d.id, d.original);
    })();
  };

  const saveAll = async () => {
    setSaving(true);
    const ready = items.filter((it) => it.status === "ready");
    for (const it of ready) {
      const garment: Garment = {
        id: it.id,
        createdAt: Date.now(),
        image: it.original,
        cutout: it.cutout,
        favorite: false,
        wearCount: 0,
        ...it.tags,
        subcategory: it.tags.subcategory || it.tags.category,
      };
      await putGarment(garment);
    }
    setSaving(false);
    onSaved();
  };

  const readyCount = items.filter((i) => i.status === "ready").length;
  const busyCount = items.filter(
    (i) => i.status === "processing" || i.status === "queued"
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center">
      <div className="animate-fade-up flex max-h-[92dvh] w-full max-w-2xl flex-col rounded-t-3xl bg-cream shadow-lift md:rounded-3xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <h2 className="font-display text-xl font-semibold">Add pieces</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sand text-ink transition-transform active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {/* Picker */}
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(e) => {
              onFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-sand bg-surface/60 py-8 transition-colors hover:border-clay"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-soft text-clay">
              <Camera size={22} />
            </span>
            <span className="text-sm font-semibold">
              Snap or choose photos
            </span>
            <span className="text-xs text-muted">
              Lay each piece flat in good light — you can add many at once
            </span>
          </button>

          <label className="mt-3 flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={removeBg}
              onChange={(e) => setRemoveBg(e.target.checked)}
              className="h-4 w-4 accent-clay"
            />
            Auto-remove backgrounds (first run downloads a small model)
          </label>

          {noKey && (
            <p className="mt-3 rounded-xl bg-clay-soft px-4 py-3 text-xs leading-5 text-clay-deep">
              <Sparkles size={12} className="mr-1 inline" />
              Demo mode: no OpenAI API key yet, so tag each piece manually below.
              Add <code className="font-semibold">OPENAI_API_KEY</code> to{" "}
              <code className="font-semibold">.env.local</code> for automatic AI
              tagging.
            </p>
          )}

          {/* Draft list */}
          <div className="mt-4 space-y-3">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex gap-3 rounded-2xl border border-sand bg-surface p-3"
              >
                <div className="cutout-bg h-24 w-20 shrink-0 overflow-hidden rounded-xl">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={it.previewUrl}
                    alt="garment"
                    className="h-full w-full object-contain"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  {it.status === "processing" || it.status === "queued" ? (
                    <div className="flex h-full items-center gap-2 text-sm text-muted">
                      <Loader2 size={16} className="animate-spin text-clay" />
                      {it.stageLabel ?? "Reading this piece…"}
                    </div>
                  ) : it.status === "error" ? (
                    <p className="text-sm text-clay-deep">
                      Couldn&apos;t process this photo.
                    </p>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      <select
                        value={it.tags.category}
                        onChange={(e) =>
                          patchTags(it.id, {
                            category: e.target.value as GarmentTags["category"],
                          })
                        }
                        className="rounded-lg border border-sand bg-cream px-2 py-1.5 text-xs capitalize"
                      >
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        value={it.tags.subcategory}
                        onChange={(e) =>
                          patchTags(it.id, { subcategory: e.target.value })
                        }
                        placeholder="e.g. t-shirt"
                        className="rounded-lg border border-sand bg-cream px-2 py-1.5 text-xs"
                      />
                      <input
                        value={it.tags.colors.join(", ")}
                        onChange={(e) =>
                          patchTags(it.id, {
                            colors: e.target.value
                              .split(",")
                              .map((s) => s.trim())
                              .filter(Boolean),
                          })
                        }
                        placeholder="colors, comma separated"
                        className="rounded-lg border border-sand bg-cream px-2 py-1.5 text-xs"
                      />
                      <select
                        value={it.tags.formality}
                        onChange={(e) =>
                          patchTags(it.id, {
                            formality: e.target.value as GarmentTags["formality"],
                          })
                        }
                        className="rounded-lg border border-sand bg-cream px-2 py-1.5 text-xs capitalize"
                      >
                        {FORMALITIES.map((f) => (
                          <option key={f} value={f}>
                            {f}
                          </option>
                        ))}
                      </select>
                      <select
                        value={it.tags.pattern}
                        onChange={(e) =>
                          patchTags(it.id, {
                            pattern: e.target.value as GarmentTags["pattern"],
                          })
                        }
                        className="rounded-lg border border-sand bg-cream px-2 py-1.5 text-xs capitalize"
                      >
                        {PATTERNS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                      {it.aiTagged && (
                        <span className="flex items-center gap-1 text-[11px] font-medium text-sage">
                          <Sparkles size={11} /> AI tagged — tap to edit
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  aria-label="Remove"
                  onClick={() =>
                    setItems((prev) => prev.filter((x) => x.id !== it.id))
                  }
                  className="self-start rounded-full p-1.5 text-muted hover:text-clay-deep"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-sand px-5 py-4 pb-safe">
          <button
            type="button"
            disabled={!readyCount || busyCount > 0 || saving}
            onClick={saveAll}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-sm font-semibold text-cream transition-all enabled:hover:bg-black enabled:active:scale-[0.98] disabled:opacity-40"
          >
            {saving || busyCount > 0 ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Check size={16} />
            )}
            {busyCount > 0
              ? `Processing ${busyCount}…`
              : `Add ${readyCount || ""} to wardrobe`}
          </button>
        </div>
      </div>
    </div>
  );
}
