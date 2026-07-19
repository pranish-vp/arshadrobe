"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Heart, Plus, Search, Shirt, Trash2, X } from "lucide-react";
import AddGarmentSheet from "@/components/AddGarmentSheet";
import { useAlerts } from "@/components/AlertProvider";
import EmptyState from "@/components/EmptyState";
import GarmentCard from "@/components/GarmentCard";
import { deleteGarment, listGarments, putGarment } from "@/lib/db";
import { useObjectUrl } from "@/lib/hooks";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  FORMALITIES,
  SEASONS,
  type Category,
  type Garment,
} from "@/lib/types";

export default function WardrobePage() {
  const { toast } = useAlerts();
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<Garment | null>(null);
  const [category, setCategory] = useState<Category | "all">("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [query, setQuery] = useState("");

  const refresh = useCallback(async () => {
    setGarments(await listGarments());
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return garments.filter((g) => {
      if (category !== "all" && g.category !== category) return false;
      if (favoritesOnly && !g.favorite) return false;
      if (q) {
        const hay =
          `${g.subcategory} ${g.category} ${g.colors.join(" ")} ${g.material} ${g.pattern} ${g.description}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [garments, category, favoritesOnly, query]);

  const counts = useMemo(() => {
    const c = new Map<string, number>();
    for (const g of garments) c.set(g.category, (c.get(g.category) ?? 0) + 1);
    return c;
  }, [garments]);

  // Optimistic: flip instantly, sync in the background, roll back on failure.
  const toggleFavorite = (g: Garment) => {
    const updated = { ...g, favorite: !g.favorite };
    setGarments((prev) => prev.map((x) => (x.id === g.id ? updated : x)));
    putGarment(updated).catch(() => {
      setGarments((prev) => prev.map((x) => (x.id === g.id ? g : x)));
      toast("Couldn't update — try again.", "error");
    });
  };

  return (
    <div>
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Wardrobe
          </h1>
          <p className="mt-1 text-sm text-muted">
            {garments.length
              ? `${garments.length} piece${garments.length === 1 ? "" : "s"} and counting`
              : "Every great outfit starts here"}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="hidden items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-95 md:flex"
        >
          <Plus size={16} /> Add pieces
        </button>
      </div>

      {/* Filters */}
      <div className="mb-4 space-y-3">
        <div className="relative">
          <Search
            size={16}
            className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search colors, pieces, materials…"
            className="w-full rounded-full border border-sand bg-surface py-2.5 pl-10 pr-4 text-sm shadow-soft outline-none focus:border-clay"
          />
        </div>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <FilterPill
            label={`All${garments.length ? ` ${garments.length}` : ""}`}
            active={category === "all"}
            onClick={() => setCategory("all")}
          />
          {CATEGORIES.filter((c) => counts.get(c)).map((c) => (
            <FilterPill
              key={c}
              label={`${CATEGORY_LABELS[c]} ${counts.get(c)}`}
              active={category === c}
              onClick={() => setCategory(c)}
            />
          ))}
          <button
            type="button"
            aria-label="Favorites only"
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
              favoritesOnly
                ? "border-clay bg-clay text-white"
                : "border-sand bg-surface text-muted"
            }`}
          >
            <Heart size={14} fill={favoritesOnly ? "currentColor" : "none"} />
            Loved
          </button>
        </div>
      </div>

      {/* Grid */}
      {!loaded ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="skeleton aspect-[3/4] rounded-2xl" />
          ))}
        </div>
      ) : filtered.length ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((g) => (
            <GarmentCard
              key={g.id}
              garment={g}
              onClick={() => setDetail(g)}
              onToggleFavorite={() => toggleFavorite(g)}
            />
          ))}
        </div>
      ) : garments.length ? (
        <EmptyState
          icon={Search}
          title="Nothing matches"
          body="Try a different filter or search — or add more pieces."
        />
      ) : (
        <EmptyState
          icon={Shirt}
          title="Your wardrobe is empty"
          body="Snap photos of your clothes and the AI will tag and organize them for you. Start with 5–10 favorite pieces."
          actionLabel="Add your first pieces"
          onAction={() => setAdding(true)}
        />
      )}

      {/* Mobile FAB */}
      <button
        type="button"
        aria-label="Add pieces"
        onClick={() => setAdding(true)}
        className="fixed bottom-24 right-4 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-ink text-cream shadow-lift transition-transform active:scale-90 md:hidden"
      >
        <Plus size={24} />
      </button>

      {adding && (
        <AddGarmentSheet
          onClose={() => setAdding(false)}
          onSaved={() => {
            setAdding(false);
            refresh();
          }}
        />
      )}

      {detail && (
        <GarmentDetail
          garment={detail}
          onClose={() => setDetail(null)}
          onChanged={() => {
            setDetail(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

function FilterPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
        active
          ? "border-ink bg-ink text-cream"
          : "border-sand bg-surface text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

function GarmentDetail({
  garment,
  onClose,
  onChanged,
}: {
  garment: Garment;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { confirm } = useAlerts();
  const [draft, setDraft] = useState<Garment>(garment);
  const url = useObjectUrl(draft.cutout ?? draft.image);

  const save = async () => {
    await putGarment(draft);
    onChanged();
  };
  const remove = async () => {
    const ok = await confirm({
      title: "Remove this piece?",
      body: "It will disappear from your wardrobe and future outfit ideas.",
      confirmLabel: "Remove",
      danger: true,
    });
    if (!ok) return;
    await deleteGarment(garment.id);
    onChanged();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 backdrop-blur-sm md:items-center">
      <div className="animate-fade-up flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift md:rounded-3xl">
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <h2 className="font-display text-xl font-semibold capitalize">
            {draft.subcategory || draft.category}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-sand transition-transform active:scale-90"
          >
            <X size={18} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="cutout-bg mx-auto max-w-60 overflow-hidden rounded-2xl border border-sand">
            {url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={draft.subcategory}
                className="aspect-[3/4] w-full object-contain p-2"
              />
            )}
          </div>
          {draft.wearCount > 0 && (
            <p className="mt-3 text-center text-xs text-muted">
              Worn {draft.wearCount} time{draft.wearCount === 1 ? "" : "s"}
            </p>
          )}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={draft.category}
                onChange={(e) =>
                  setDraft({ ...draft, category: e.target.value as Category })
                }
                className="w-full rounded-lg border border-sand bg-surface px-3 py-2 text-sm capitalize"
              >
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Piece">
              <input
                value={draft.subcategory}
                onChange={(e) =>
                  setDraft({ ...draft, subcategory: e.target.value })
                }
                className="w-full rounded-lg border border-sand bg-surface px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Colors">
              <input
                value={draft.colors.join(", ")}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    colors: e.target.value
                      .split(",")
                      .map((s) => s.trim())
                      .filter(Boolean),
                  })
                }
                className="w-full rounded-lg border border-sand bg-surface px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Material">
              <input
                value={draft.material}
                onChange={(e) => setDraft({ ...draft, material: e.target.value })}
                className="w-full rounded-lg border border-sand bg-surface px-3 py-2 text-sm"
              />
            </Field>
            <Field label="Formality">
              <select
                value={draft.formality}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    formality: e.target.value as Garment["formality"],
                  })
                }
                className="w-full rounded-lg border border-sand bg-surface px-3 py-2 text-sm capitalize"
              >
                {FORMALITIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Seasons">
              <select
                multiple
                value={draft.seasons}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    seasons: Array.from(
                      e.target.selectedOptions,
                      (o) => o.value as Garment["seasons"][number]
                    ),
                  })
                }
                className="w-full rounded-lg border border-sand bg-surface px-3 py-2 text-sm capitalize"
              >
                {SEASONS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </Field>
          </div>
        </div>
        <div className="flex gap-3 border-t border-sand px-5 pt-4 pb-safe-4">
          <button
            type="button"
            onClick={remove}
            aria-label="Delete"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sand text-clay-deep transition-transform active:scale-90"
          >
            <Trash2 size={17} />
          </button>
          <button
            type="button"
            onClick={save}
            className="flex-1 rounded-full bg-ink py-3 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
          >
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
        {label}
      </span>
      {children}
    </label>
  );
}
