"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  BookHeart,
  Check,
  Download,
  Loader2,
  RefreshCw,
  Shirt,
  Sparkles,
  Wand2,
  X,
} from "lucide-react";
import { ChipGroup } from "@/components/Chips";
import EmptyState from "@/components/EmptyState";
import OutfitCollage from "@/components/OutfitCollage";
import { getProfile, listGarments, putOutfit, uid } from "@/lib/db";
import { fallbackOutfits } from "@/lib/fallback-stylist";
import { useObjectUrl } from "@/lib/hooks";
import { blobToBase64, base64ToBlob } from "@/lib/images";
import {
  OCCASIONS,
  STYLE_VIBES,
  type Garment,
  type OutfitOption,
  type Profile,
  type StylistContext,
} from "@/lib/types";
import { fetchWeather, weatherSummary } from "@/lib/weather";

type Phase = "ask" | "thinking" | "results";

const WEATHER_OVERRIDES = ["Hot", "Warm", "Mild", "Cool", "Cold", "Rainy"];

const THINKING_LINES = [
  "Reading your closet…",
  "Pairing colors…",
  "Balancing the vibe…",
  "Checking the weather…",
  "Final touches…",
];

export default function StylistPage() {
  const [garments, setGarments] = useState<Garment[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  const [phase, setPhase] = useState<Phase>("ask");
  const [occasion, setOccasion] = useState<string | null>(null);
  const [vibe, setVibe] = useState<string | null>(null);
  const [autoWeather, setAutoWeather] = useState<string | null>(null);
  const [weatherPick, setWeatherPick] = useState<string | null>(null);
  const [note, setNote] = useState("");

  const [options, setOptions] = useState<OutfitOption[]>([]);
  const [selected, setSelected] = useState(0);
  const [demoMode, setDemoMode] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [tryOnOpen, setTryOnOpen] = useState(false);

  useEffect(() => {
    Promise.all([listGarments(), getProfile()]).then(([g, p]) => {
      setGarments(g);
      setProfile(p);
      setLoaded(true);
    });
    fetchWeather().then((w) => {
      if (w) setAutoWeather(`${w.emoji} ${weatherSummary(w)}`);
    });
  }, []);

  const weather = weatherPick ?? autoWeather ?? "Mild";

  const styleMe = async () => {
    if (!occasion || !vibe) return;
    setPhase("thinking");
    setSavedIds(new Set());
    const ctx: StylistContext = {
      occasion,
      vibe,
      weather,
      note: note.trim() || undefined,
    };
    let opts: OutfitOption[] = [];
    let demo = false;
    try {
      const res = await fetch("/api/stylist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          garments: garments.map((g) => ({
            id: g.id,
            category: g.category,
            subcategory: g.subcategory,
            colors: g.colors,
            pattern: g.pattern,
            material: g.material,
            seasons: g.seasons,
            formality: g.formality,
            description: g.description,
            favorite: g.favorite,
            wearCount: g.wearCount,
          })),
          context: {
            ...ctx,
            ...(profile?.vibes.length
              ? { note: `${ctx.note ?? ""} My general style: ${profile.vibes.join(", ")}.` }
              : {}),
          },
        }),
      });
      if (res.ok) {
        opts = (await res.json()).options;
      } else {
        demo = true;
      }
    } catch {
      demo = true;
    }
    if (!opts.length) {
      opts = fallbackOutfits(garments, ctx);
      demo = true;
    }
    setDemoMode(demo);
    setOptions(opts);
    setSelected(0);
    setPhase(opts.length ? "results" : "ask");
    if (!opts.length) {
      alert(
        "Couldn't build a complete outfit — add a few more pieces (a top, a bottom and shoes go a long way)."
      );
    }
  };

  const saveLook = async (tryOn?: Blob) => {
    const opt = options[selected];
    if (!opt) return;
    await putOutfit({
      id: uid(),
      createdAt: Date.now(),
      title: opt.title,
      occasion: occasion ?? "",
      vibe: vibe ?? "",
      explanation: opt.explanation,
      tip: opt.tip,
      garmentIds: opt.garmentIds,
      tryOn,
      favorite: false,
      wornDates: [],
    });
    setSavedIds((prev) => new Set(prev).add(selected));
  };

  if (loaded && garments.length < 2) {
    return (
      <EmptyState
        icon={Shirt}
        title="The stylist needs a wardrobe"
        body="Add at least a few pieces — a top, a bottom and shoes are enough to start getting outfit ideas."
        actionLabel="Go to wardrobe"
        actionHref="/wardrobe"
      />
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      {phase === "ask" && (
        <div className="animate-fade-up">
          <div className="mb-7 text-center">
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-clay text-white shadow-soft">
              <Sparkles size={26} />
            </span>
            <h1 className="font-display text-3xl font-semibold tracking-tight">
              {profile?.name && profile.name !== "there"
                ? `Hey ${profile.name} —`
                : "Hey —"}{" "}
              what&apos;s the plan?
            </h1>
            <p className="mt-2 text-sm text-muted">
              A few quick questions and I&apos;ll pull the perfect look from your
              closet.
            </p>
          </div>

          <div className="space-y-6">
            <Question label="What's the occasion?">
              <ChipGroup options={OCCASIONS} value={occasion} onChange={setOccasion} />
            </Question>
            <Question label="What's the vibe?">
              <ChipGroup options={STYLE_VIBES} value={vibe} onChange={setVibe} />
            </Question>
            <Question
              label="Weather"
              hint={autoWeather ? `Detected: ${autoWeather}` : undefined}
            >
              <ChipGroup
                options={WEATHER_OVERRIDES}
                value={weatherPick}
                onChange={(v) =>
                  setWeatherPick(v === weatherPick ? null : v)
                }
              />
            </Question>
            <Question label="Anything else? (optional)">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder='e.g. "I want to wear my white sneakers"'
                className="w-full rounded-full border border-sand bg-surface px-5 py-3 text-sm shadow-soft outline-none focus:border-clay"
              />
            </Question>
          </div>

          <button
            type="button"
            disabled={!occasion || !vibe}
            onClick={styleMe}
            className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-clay py-4 text-sm font-semibold text-white shadow-lift transition-all enabled:hover:bg-clay-deep enabled:active:scale-[0.98] disabled:opacity-40"
          >
            <Wand2 size={17} /> Style me
          </button>
        </div>
      )}

      {phase === "thinking" && <Thinking />}

      {phase === "results" && (
        <div className="animate-fade-up">
          <button
            type="button"
            onClick={() => setPhase("ask")}
            className="mb-4 flex items-center gap-1.5 text-sm font-medium text-muted hover:text-ink"
          >
            <ArrowLeft size={15} /> Change the brief
          </button>

          {demoMode && (
            <p className="mb-4 rounded-xl bg-clay-soft px-4 py-3 text-xs leading-5 text-clay-deep">
              Demo stylist (no OpenAI key detected). Add{" "}
              <code className="font-semibold">OPENAI_API_KEY</code> to{" "}
              <code className="font-semibold">.env.local</code> for smarter,
              chattier outfits and virtual try-on.
            </p>
          )}

          {/* Option tabs */}
          {options.length > 1 && (
            <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
              {options.map((o, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelected(i)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition-all ${
                    i === selected
                      ? "border-ink bg-ink text-cream"
                      : "border-sand bg-surface text-muted"
                  }`}
                >
                  {o.title}
                </button>
              ))}
            </div>
          )}

          {options[selected] && (
            <OptionCard
              option={options[selected]}
              garments={garments}
              saved={savedIds.has(selected)}
              onSave={() => saveLook()}
              onShuffle={styleMe}
              onTryOn={() => setTryOnOpen(true)}
              hasPhoto={Boolean(profile?.photo)}
            />
          )}
        </div>
      )}

      {tryOnOpen && options[selected] && profile?.photo && (
        <TryOnModal
          person={profile.photo}
          option={options[selected]}
          garments={garments}
          onClose={() => setTryOnOpen(false)}
          onSave={(blob) => {
            saveLook(blob);
            setTryOnOpen(false);
          }}
        />
      )}
    </div>
  );
}

function Question({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-sand bg-surface p-4 shadow-soft">
      <p className="mb-3 text-sm font-semibold">
        {label}
        {hint && (
          <span className="ml-2 font-normal text-muted">{hint}</span>
        )}
      </p>
      {children}
    </div>
  );
}

function Thinking() {
  const [line, setLine] = useState(0);
  useEffect(() => {
    const t = setInterval(
      () => setLine((l) => (l + 1) % THINKING_LINES.length),
      1400
    );
    return () => clearInterval(t);
  }, []);
  return (
    <div className="flex flex-col items-center py-24 text-center">
      <span className="animate-float flex h-16 w-16 items-center justify-center rounded-3xl bg-clay text-white shadow-lift">
        <Sparkles size={28} />
      </span>
      <p className="font-display mt-6 text-xl font-semibold">
        {THINKING_LINES[line]}
      </p>
      <p className="mt-2 text-sm text-muted">Styling from your own closet</p>
    </div>
  );
}

function OptionCard({
  option,
  garments,
  saved,
  hasPhoto,
  onSave,
  onShuffle,
  onTryOn,
}: {
  option: OutfitOption;
  garments: Garment[];
  saved: boolean;
  hasPhoto: boolean;
  onSave: () => void;
  onShuffle: () => void;
  onTryOn: () => void;
}) {
  const picked = option.garmentIds
    .map((id) => garments.find((g) => g.id === id))
    .filter(Boolean) as Garment[];

  return (
    <div className="overflow-hidden rounded-3xl border border-sand bg-surface shadow-soft">
      <OutfitCollage garments={picked} className="m-3" />
      <div className="px-5 pb-5">
        <h2 className="font-display text-2xl font-semibold">{option.title}</h2>
        <p className="mt-2 text-sm leading-6 text-ink/80">{option.explanation}</p>
        {option.tip && (
          <p className="mt-3 rounded-xl bg-sage-soft px-4 py-3 text-xs leading-5 text-sage">
            💡 {option.tip}
          </p>
        )}
        <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
          {hasPhoto ? (
            <button
              type="button"
              onClick={onTryOn}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-clay py-3 text-sm font-semibold text-white shadow-soft transition-all hover:bg-clay-deep active:scale-[0.98]"
            >
              <Wand2 size={16} /> See it on me
            </button>
          ) : (
            <Link
              href="/profile"
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-clay/60 py-3 text-sm font-semibold text-white"
            >
              <Wand2 size={16} /> Add your photo to try it on
            </Link>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saved}
            className="flex flex-1 items-center justify-center gap-2 rounded-full border border-ink py-3 text-sm font-semibold transition-all enabled:hover:bg-ink enabled:hover:text-cream enabled:active:scale-[0.98] disabled:border-sage disabled:text-sage"
          >
            {saved ? (
              <>
                <Check size={16} /> Saved to lookbook
              </>
            ) : (
              <>
                <BookHeart size={16} /> Save look
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onShuffle}
            aria-label="Shuffle"
            className="flex items-center justify-center gap-2 rounded-full border border-sand px-5 py-3 text-sm font-semibold text-muted transition-all hover:text-ink active:scale-[0.98]"
          >
            <RefreshCw size={15} />
            <span className="sm:hidden">Shuffle again</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function TryOnModal({
  person,
  option,
  garments,
  onClose,
  onSave,
}: {
  person: Blob;
  option: OutfitOption;
  garments: Garment[];
  onClose: () => void;
  onSave: (blob: Blob) => void;
}) {
  const [result, setResult] = useState<Blob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const startedRef = useRef(false);
  const url = useObjectUrl(result);

  const generate = async () => {
    setGenerating(true);
    setError(null);
    setResult(null);
    try {
      const picked = option.garmentIds
        .map((id) => garments.find((g) => g.id === id))
        .filter(Boolean) as Garment[];
      const personB64 = await blobToBase64(person);
      const garmentPayloads = await Promise.all(
        picked.map(async (g) => ({
          ...(await blobToBase64(g.image)),
          label: `${g.colors.join(" ")} ${g.subcategory || g.category} (${g.category})`,
        }))
      );
      const res = await fetch("/api/tryon", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          person: personB64,
          garments: garmentPayloads,
          outfitTitle: option.title,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(
          res.status === 503
            ? "Virtual try-on needs an OpenAI API key — add OPENAI_API_KEY to .env.local and restart."
            : json.error || "Generation failed"
        );
      }
      setResult(base64ToBlob(json.image.data, json.image.mimeType));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    if (!startedRef.current) {
      startedRef.current = true;
      generate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 backdrop-blur-sm md:items-center">
      <div className="animate-fade-up flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-cream shadow-lift md:rounded-3xl">
        <div className="flex items-center justify-between border-b border-sand px-5 py-4">
          <h2 className="font-display text-xl font-semibold">
            {option.title} — on you
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

        <div className="flex-1 overflow-y-auto p-5">
          {generating && (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 rounded-2xl bg-sand/50">
              <Loader2 size={30} className="animate-spin text-clay" />
              <p className="text-sm font-medium text-muted">
                Dressing you up… ~10–20 seconds
              </p>
            </div>
          )}
          {error && (
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 rounded-2xl bg-clay-soft p-6 text-center">
              <p className="text-sm leading-6 text-clay-deep">{error}</p>
              <button
                type="button"
                onClick={generate}
                className="rounded-full bg-clay px-5 py-2.5 text-sm font-semibold text-white"
              >
                Try again
              </button>
            </div>
          )}
          {url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url}
              alt="You wearing this outfit"
              className="w-full rounded-2xl shadow-soft"
            />
          )}
        </div>

        {result && (
          <div className="flex gap-2.5 border-t border-sand px-5 py-4 pb-safe">
            <button
              type="button"
              onClick={() => onSave(result)}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
            >
              <BookHeart size={16} /> Save look
            </button>
            <a
              href={url}
              download="arshadrobe-look.png"
              aria-label="Download"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-sand text-muted hover:text-ink"
            >
              <Download size={17} />
            </a>
            <button
              type="button"
              onClick={generate}
              aria-label="Regenerate"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-sand text-muted hover:text-ink"
            >
              <RefreshCw size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
