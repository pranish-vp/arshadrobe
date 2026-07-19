"use client";

import { Heart } from "lucide-react";
import { useObjectUrl } from "@/lib/hooks";
import type { Garment } from "@/lib/types";

export default function GarmentCard({
  garment,
  onClick,
  onToggleFavorite,
}: {
  garment: Garment;
  onClick: () => void;
  onToggleFavorite: () => void;
}) {
  const url = useObjectUrl(garment.cutout ?? garment.image);
  return (
    <div className="group animate-fade-up relative overflow-hidden rounded-2xl border border-sand bg-surface shadow-soft transition-shadow hover:shadow-lift">
      <button
        type="button"
        onClick={onClick}
        className="block w-full text-left"
      >
        <div className="cutout-bg relative aspect-[3/4] w-full overflow-hidden">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt={garment.subcategory || garment.category}
              className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="skeleton h-full w-full" />
          )}
        </div>
        <div className="px-3 py-2.5">
          <p className="truncate text-sm font-semibold capitalize">
            {garment.subcategory || garment.category}
          </p>
          <p className="truncate text-xs capitalize text-muted">
            {garment.colors.slice(0, 2).join(" · ")}
            {garment.wearCount > 0 && ` · worn ${garment.wearCount}×`}
          </p>
        </div>
      </button>
      <button
        type="button"
        aria-label="Favorite"
        onClick={onToggleFavorite}
        className={`absolute right-2 top-2 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur transition-all active:scale-90 ${
          garment.favorite
            ? "bg-clay text-white"
            : "bg-surface/80 text-muted opacity-100 hover:text-clay md:opacity-0 md:group-hover:opacity-100"
        }`}
      >
        <Heart size={15} fill={garment.favorite ? "currentColor" : "none"} />
      </button>
    </div>
  );
}
