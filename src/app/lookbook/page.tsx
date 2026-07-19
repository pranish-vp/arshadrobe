"use client";

import { useCallback, useEffect, useState } from "react";
import { BookHeart, Check, Download, Heart, Shirt, Trash2, X } from "lucide-react";
import { useAlerts } from "@/components/AlertProvider";
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

/**
 * Merge accidental duplicates (same title + same pieces): keep the entry
 * with the try-on image, combine wear history/favorite, delete the rest.
 */
function dedupeLooks(list: Outfit[]): Outfit[] {
  const groups = new Map<string, Outfit[]>();
  for (const o of list) {
    const key = `${o.title}|${[...o.garmentIds].sort().join(",")}`;
    groups.set(key, [...(groups.get(key) ?? []), o]);
  }
  const result: Outfit[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      result.push(group[0]);
      continue;
    }
    const keeper = [...group].sort(
      (a, b) =>
        (b.tryOn ? 1 : 0) - (a.tryOn ? 1 : 0) || b.createdAt - a.createdAt
    )[0];
    const merged: Outfit = {
      ...keeper,
      wornDates: [...new Set(group.flatMap((o) => o.wornDates))].sort(),
      favorite: group.some((o) => o.favorite),
    };
    result.push(merged);
    putOutfit(merged).catch(() => {});
    for (const extra of group) {
      if (extra.id !== keeper.id) deleteOutfit(extra.id).catch(() => {});
    }
  }
  return result.sort((a, b) => b.createdAt - a.createdAt);
}

export default function LookbookPage() {
  const { confirm, toast } = useAlerts();
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [o, g] = await Promise.all([listOutfits(), listGarments()]);
    setOutfits(dedupeLooks(o));
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

  // All mutations are optimistic: the UI updates instantly and syncs in
  // the background; on failure we roll back and toast.
  const markWorn = (o: Outfit) => {
    if (wornToday(o)) return;
    const updated = { ...o, wornDates: [...o.wornDates, Date.now()] };
    const bumped = garments.map((g) =>
      o.garmentIds.includes(g.id) ? { ...g, wearCount: g.wearCount + 1 } : g
    );
    setOutfits((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
    setGarments(bumped);
    Promise.all([
      putOutfit(updated),
      // Bump wear counts on the pieces too — feeds the stylist's variety logic.
      ...o.garmentIds.map((id) => {
        const g = bumped.find((x) => x.id === id);
        return g ? putGarment(g) : Promise.resolve();
      }),
    ]).catch(() => {
      toast("Couldn't sync — check your connection.", "error");
      refresh();
    });
  };

  const toggleFavorite = (o: Outfit) => {
    const updated = { ...o, favorite: !o.favorite };
    setOutfits((prev) => prev.map((x) => (x.id === o.id ? updated : x)));
    putOutfit(updated).catch(() => {
      setOutfits((prev) => prev.map((x) => (x.id === o.id ? o : x)));
      toast("Couldn't update — try again.", "error");
    });
  };

  const remove = async (o: Outfit) => {
    const ok = await confirm({
      title: "Delete this look?",
      body: "The saved outfit and its try-on photo will be removed.",
      confirmLabel: "Delete",
      danger: true,
    });
    if (!ok) return false;
    setOutfits((prev) => prev.filter((x) => x.id !== o.id));
    deleteOutfit(o.id).catch(() => {
      toast("Couldn't delete — try again.", "error");
      refresh();
    });
    return true;
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
              onOpen={() => setDetailId(o.id)}
              onWorn={() => markWorn(o)}
              onFavorite={() => toggleFavorite(o)}
              onDelete={() => remove(o)}
            />
          ))}
        </div>
      )}

      {detailId &&
        (() => {
          const o = outfits.find((x) => x.id === detailId);
          if (!o) return null;
          return (
            <LookDetail
              outfit={o}
              garments={garments}
              wornToday={wornToday(o)}
              onWorn={() => markWorn(o)}
              onFavorite={() => toggleFavorite(o)}
              onDelete={async () => {
                if (await remove(o)) setDetailId(null);
              }}
              onClose={() => setDetailId(null)}
            />
          );
        })()}
    </div>
  );
}

function LookDetail({
  outfit,
  garments,
  wornToday,
  onWorn,
  onFavorite,
  onDelete,
  onClose,
}: {
  outfit: Outfit;
  garments: Garment[];
  wornToday: boolean;
  onWorn: () => void;
  onFavorite: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const tryOnUrl = useObjectUrl(outfit.tryOn ?? null);
  const picked = outfit.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter(Boolean) as Garment[];

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/60 backdrop-blur-sm md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="animate-fade-up flex max-h-[95dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift md:max-h-[92dvh] md:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display truncate text-xl font-semibold">
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
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sand transition-transform active:scale-90"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {tryOnUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={tryOnUrl}
              alt={outfit.title}
              className="w-full rounded-2xl shadow-soft"
            />
          ) : picked.length ? (
            <OutfitCollage garments={picked} />
          ) : null}

          <p className="mt-4 text-sm leading-6 text-ink/80">
            {outfit.explanation}
          </p>
          {outfit.tip && (
            <p className="mt-3 rounded-xl bg-sage-soft px-4 py-3 text-xs leading-5 text-sage">
              💡 {outfit.tip}
            </p>
          )}

          {picked.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted">
                The pieces
              </p>
              <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
                {picked.map((g) => (
                  <PieceThumb key={g.id} garment={g} />
                ))}
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2.5 border-t border-sand px-5 pt-4 pb-safe-4">
          <button
            type="button"
            onClick={onWorn}
            disabled={wornToday}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-ink py-3 text-sm font-semibold transition-all enabled:hover:bg-ink enabled:hover:text-cream enabled:active:scale-[0.98] disabled:border-sage disabled:text-sage"
          >
            <Check size={15} />
            {wornToday ? "Worn today" : "I wore this"}
          </button>
          <button
            type="button"
            aria-label="Favorite look"
            onClick={onFavorite}
            className={`flex h-11 w-11 items-center justify-center rounded-full border border-sand transition-transform active:scale-90 ${
              outfit.favorite ? "text-clay" : "text-muted hover:text-clay"
            }`}
          >
            <Heart size={17} fill={outfit.favorite ? "currentColor" : "none"} />
          </button>
          {tryOnUrl && (
            <a
              href={tryOnUrl}
              download={`${outfit.title.replace(/\s+/g, "-").toLowerCase()}.png`}
              aria-label="Download"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-sand text-muted hover:text-ink"
            >
              <Download size={16} />
            </a>
          )}
          <button
            type="button"
            aria-label="Delete look"
            onClick={onDelete}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-sand text-muted transition-colors hover:text-clay-deep"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </div>
  );
}

function PieceThumb({ garment }: { garment: Garment }) {
  const url = useObjectUrl(garment.cutout ?? garment.image);
  return (
    <div className="cutout-bg h-24 w-20 shrink-0 overflow-hidden rounded-xl border border-sand">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={garment.subcategory || garment.category}
          className="h-full w-full object-contain p-1"
        />
      )}
    </div>
  );
}

function LookCard({
  outfit,
  garments,
  wornToday,
  onOpen,
  onWorn,
  onFavorite,
  onDelete,
}: {
  outfit: Outfit;
  garments: Garment[];
  wornToday: boolean;
  onOpen: () => void;
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
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${outfit.title}`}
        className="block w-full cursor-pointer text-left"
      >
        {tryOnUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={tryOnUrl}
            alt={outfit.title}
            className="aspect-[3/4] w-full object-cover transition-transform duration-300 hover:scale-[1.02]"
          />
        ) : picked.length ? (
          <OutfitCollage garments={picked} className="m-3" />
        ) : (
          <div className="flex aspect-[3/4] items-center justify-center bg-clay-soft text-clay">
            <Shirt size={28} />
          </div>
        )}
      </button>

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
