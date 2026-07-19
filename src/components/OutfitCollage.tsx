"use client";

import { useEffect, useState } from "react";
import type { Garment } from "@/lib/types";

/**
 * Arranges a picked outfit's garment photos as an editorial collage:
 * main pieces (dress / top+bottom) large, shoes & accessories smaller.
 */
export default function OutfitCollage({
  garments,
  className = "",
}: {
  garments: Garment[];
  className?: string;
}) {
  const [urls, setUrls] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const map = new Map<string, string>();
    for (const g of garments) {
      map.set(g.id, URL.createObjectURL(g.cutout ?? g.image));
    }
    setUrls(map);
    return () => {
      for (const u of map.values()) URL.revokeObjectURL(u);
    };
  }, [garments]);

  const rank: Record<string, number> = {
    outerwear: 0,
    dress: 1,
    top: 2,
    bottom: 3,
    shoes: 4,
    accessory: 5,
    other: 6,
  };
  const sorted = [...garments].sort(
    (a, b) => (rank[a.category] ?? 9) - (rank[b.category] ?? 9)
  );
  const main = sorted.filter((g) =>
    ["dress", "top", "bottom", "outerwear"].includes(g.category)
  );
  const small = sorted.filter(
    (g) => !["dress", "top", "bottom", "outerwear"].includes(g.category)
  );

  const cell = (g: Garment, big: boolean) => {
    const u = urls.get(g.id);
    return (
      <div
        key={g.id}
        className={`cutout-bg flex items-center justify-center overflow-hidden rounded-xl border border-sand ${
          big ? "min-h-36 flex-1" : "h-20 w-20 shrink-0"
        }`}
      >
        {u ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={u}
            alt={g.subcategory || g.category}
            className="h-full w-full object-contain p-1.5"
          />
        ) : (
          <div className="skeleton h-full w-full" />
        )}
      </div>
    );
  };

  return (
    <div className={`rounded-2xl bg-cream p-3 ${className}`}>
      <div
        className={`grid gap-2 ${main.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}
      >
        {main.map((g) => cell(g, true))}
      </div>
      {small.length > 0 && (
        <div className="mt-2 flex gap-2">{small.map((g) => cell(g, false))}</div>
      )}
    </div>
  );
}
