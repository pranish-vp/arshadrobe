"use client";

import { useCallback, useEffect, useState } from "react";
import { BookHeart, Check, Heart, Shirt, Trash2 } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import OutfitCollage from "@/components/OutfitCollage";
import {
  deleteOutfit,
  listGarments,
  listOutfits,
  putGarment,
  putOutfit,
} from "@/lib/db";
import { useObjectUrl } from "@/lib/hooks";
import type { Garment, Outfit } from "@/lib/types";

export default function LookbookPage() {
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loaded, setLoaded] = useState(false);

  const refresh = useCallback(async () => {
    const [o, g] = await Promise.all([listOutfits(), listGarments()]);
    setOutfits(o);
    setGarments(g);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const wornToday = (o: Outfit) => {
    const last = o.wornDates[o.wornDates.length - 1];
    return last !== undefined &&
      new Date(last).toDateString() === new Date().toDateString();
  };

  const markWorn = async (o: Outfit) => {
    if (wornToday(o)) return;
    await putOutfit({ ...o, wornDates: [...o.wornDates, Date.now()] });
    // Bump wear counts on the pieces too — feeds the stylist's variety logic.
    for (const id of o.garmentIds) {
      const g = garments.find((x) => x.id === id);
      if (g) await putGarment({ ...g, wearCount: g.wearCount + 1 });
    }
    refresh();
  };

  const toggleFavorite = async (o: Outfit) => {
    await putOutfit({ ...o, favorite: !o.favorite });
    refresh();
  };

  const remove = async (o: Outfit) => {
    if (!confirm("Delete this look?")) return;
    await deleteOutfit(o.id);
    refresh();
  };

  return (
    <div>
      <div className="mb-5">
        <h1 className="font-display text-3xl font-semibold tracking-tight">
          Lookbook
        </h1>
        <p className="mt-1 text-sm text-muted">
          {outfits.length
            ? "Outfits you loved enough to keep"
            : "Your saved outfits will live here"}
        </p>
      </div>

      {!loaded ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="skeleton h-72 rounded-3xl" />
          ))}
        </div>
      ) : outfits.length === 0 ? (
        <EmptyState
          icon={BookHeart}
          title="No saved looks yet"
          body="Ask the stylist for outfit ideas and save the ones you love — with a try-on photo of you wearing them."
          actionLabel="Ask the stylist"
          actionHref="/stylist"
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {outfits.map((o) => (
            <LookCard
              key={o.id}
              outfit={o}
              garments={garments}
              wornToday={wornToday(o)}
              onWorn={() => markWorn(o)}
              onFavorite={() => toggleFavorite(o)}
              onDelete={() => remove(o)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LookCard({
  outfit,
  garments,
  wornToday,
  onWorn,
  onFavorite,
  onDelete,
}: {
  outfit: Outfit;
  garments: Garment[];
  wornToday: boolean;
  onWorn: () => void;
  onFavorite: () => void;
  onDelete: () => void;
}) {
  const tryOnUrl = useObjectUrl(outfit.tryOn ?? null);
  const picked = outfit.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter(Boolean) as Garment[];

  return (
    <div className="animate-fade-up flex flex-col overflow-hidden rounded-3xl border border-sand bg-surface shadow-soft transition-shadow hover:shadow-lift">
      {tryOnUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={tryOnUrl}
          alt={outfit.title}
          className="aspect-[3/4] w-full object-cover"
        />
      ) : picked.length ? (
        <OutfitCollage garments={picked} className="m-3" />
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center bg-clay-soft text-clay">
          <Shirt size={28} />
        </div>
      )}

      <div className="flex flex-1 flex-col px-4 pb-4 pt-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 className="font-display truncate text-lg font-semibold">
              {outfit.title}
            </h2>
            <p className="text-xs text-muted">
              {[outfit.occasion, outfit.vibe].filter(Boolean).join(" · ")}
              {outfit.wornDates.length > 0 &&
                ` · worn ${outfit.wornDates.length}×`}
            </p>
          </div>
          <button
            type="button"
            aria-label="Favorite look"
            onClick={onFavorite}
            className={`shrink-0 rounded-full p-2 transition-transform active:scale-90 ${
              outfit.favorite ? "text-clay" : "text-muted hover:text-clay"
            }`}
          >
            <Heart size={17} fill={outfit.favorite ? "currentColor" : "none"} />
          </button>
        </div>
        <p className="mt-2 line-clamp-3 text-xs leading-5 text-ink/70">
          {outfit.explanation}
        </p>
        <div className="mt-auto flex gap-2 pt-4">
          <button
            type="button"
            onClick={onWorn}
            disabled={wornToday}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink py-2.5 text-xs font-semibold transition-all enabled:hover:bg-ink enabled:hover:text-cream enabled:active:scale-[0.98] disabled:border-sage disabled:text-sage"
          >
            <Check size={14} />
            {wornToday ? "Worn today" : "I wore this"}
          </button>
          <button
            type="button"
            aria-label="Delete look"
            onClick={onDelete}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-sand text-muted transition-colors hover:text-clay-deep"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
