"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookHeart,
  Heart,
  Plus,
  Shirt,
  Sparkles,
} from "lucide-react";
import { getProfile, listGarments, listOutfits } from "@/lib/db";
import type { Garment, Outfit, Profile } from "@/lib/types";
import { fetchWeather, weatherSummary, type WeatherInfo } from "@/lib/weather";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 5) return "Up late";
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [garments, setGarments] = useState<Garment[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);

  useEffect(() => {
    getProfile().then(setProfile);
    listGarments().then(setGarments);
    listOutfits().then(setOutfits);
    fetchWeather().then(setWeather);
  }, []);

  const topColor = useMemo(() => {
    const freq = new Map<string, number>();
    for (const g of garments)
      for (const c of g.colors) freq.set(c, (freq.get(c) ?? 0) + 1);
    return [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  }, [garments]);

  const favorites = garments.filter((g) => g.favorite).length;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="animate-fade-up space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-ink px-6 py-8 text-cream shadow-lift md:px-10 md:py-12">
        <div
          className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-clay/30 blur-3xl"
          aria-hidden
        />
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-cream/60">
          {today}
          {weather && ` · ${weather.emoji} ${weatherSummary(weather)}`}
        </p>
        <h1 className="font-display mt-3 max-w-lg text-3xl font-semibold leading-tight tracking-tight md:text-5xl">
          {greeting()}
          {profile?.name && profile.name !== "there" ? `, ${profile.name}` : ""}.
          <br />
          <span className="text-clay-soft">What are we wearing today?</span>
        </h1>
        <Link
          href="/stylist"
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-clay px-6 py-3.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-clay-deep active:scale-[0.98]"
        >
          <Sparkles size={17} /> Style me
        </Link>
      </section>

      {/* Stats */}
      <section className="grid grid-cols-3 gap-3">
        <Stat value={garments.length} label="pieces" href="/wardrobe" icon={Shirt} />
        <Stat value={outfits.length} label="looks" href="/lookbook" icon={BookHeart} />
        <Stat
          value={topColor ? capitalize(topColor) : favorites}
          label={topColor ? "signature color" : "loved"}
          href="/wardrobe"
          icon={Heart}
        />
      </section>

      {/* Recent pieces */}
      {garments.length > 0 && (
        <section>
          <SectionHeader title="Latest in your closet" href="/wardrobe" />
          <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
            {garments.slice(0, 10).map((g) => (
              <GarmentThumb key={g.id} garment={g} />
            ))}
            <Link
              href="/wardrobe"
              className="flex h-36 w-28 shrink-0 flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-sand text-muted transition-colors hover:border-clay hover:text-clay"
            >
              <Plus size={20} />
              <span className="text-xs font-medium">Add more</span>
            </Link>
          </div>
        </section>
      )}

      {/* Latest looks */}
      {outfits.length > 0 && (
        <section>
          <SectionHeader title="Latest looks" href="/lookbook" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {outfits.slice(0, 4).map((o) => (
              <OutfitThumb key={o.id} outfit={o} />
            ))}
          </div>
        </section>
      )}

      {/* First-run nudge */}
      {garments.length === 0 && (
        <section className="rounded-3xl border border-dashed border-sand bg-surface/60 px-6 py-10 text-center">
          <p className="font-display text-2xl font-semibold">
            Start with your closet
          </p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            Add 5–10 favorite pieces — the AI tags and organizes them, then the
            stylist can start dressing you.
          </p>
          <Link
            href="/wardrobe"
            className="mt-5 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
          >
            <Shirt size={16} /> Build my wardrobe
          </Link>
        </section>
      )}
    </div>
  );
}

function Stat({
  value,
  label,
  href,
  icon: Icon,
}: {
  value: number | string;
  label: string;
  href: string;
  icon: React.ComponentType<{ size?: number | string; className?: string }>;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-sand bg-surface p-4 shadow-soft transition-shadow hover:shadow-lift"
    >
      <Icon size={16} className="text-clay" />
      <p className="font-display mt-2 truncate text-2xl font-semibold capitalize">
        {value}
      </p>
      <p className="text-xs text-muted">{label}</p>
    </Link>
  );
}

function SectionHeader({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <Link
        href={href}
        className="flex items-center gap-1 text-sm font-medium text-muted hover:text-ink"
      >
        See all <ArrowRight size={14} />
      </Link>
    </div>
  );
}

function GarmentThumb({ garment }: { garment: Garment }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    const u = URL.createObjectURL(garment.cutout ?? garment.image);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [garment]);
  return (
    <div className="cutout-bg h-36 w-28 shrink-0 overflow-hidden rounded-2xl border border-sand bg-surface">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={garment.subcategory}
          className="h-full w-full object-contain p-1.5"
        />
      )}
    </div>
  );
}

function OutfitThumb({ outfit }: { outfit: Outfit }) {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!outfit.tryOn) return;
    const u = URL.createObjectURL(outfit.tryOn);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [outfit]);
  return (
    <Link
      href="/lookbook"
      className="overflow-hidden rounded-2xl border border-sand bg-surface shadow-soft transition-shadow hover:shadow-lift"
    >
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={outfit.title}
          className="aspect-[3/4] w-full object-cover"
        />
      ) : (
        <div className="flex aspect-[3/4] items-center justify-center bg-clay-soft">
          <BookHeart size={24} className="text-clay" />
        </div>
      )}
      <p className="truncate px-3 py-2 text-xs font-semibold">{outfit.title}</p>
    </Link>
  );
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
