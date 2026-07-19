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
import { useAlerts } from "@/components/AlertProvider";
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

const THINKING_STEPS = [
  "Reading your closet",
  "Checking the weather",
  "Pairing colors",
  "Balancing the vibe",
  "Final touches",
];

export default function StylistPage() {
  const { toast } = useAlerts();
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
  const [demoReason, setDemoReason] = useState<"no_key" | "error" | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [tryOnOpen, setTryOnOpen] = useState(false);
  // Stable outfit id + latest try-on per option, so auto-save upserts one
  // lookbook entry instead of creating duplicates on regenerate.
  const outfitIdsRef = useRef(new Map<number, string>());
  const tryOnRef = useRef(new Map<number, Blob>());

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
    outfitIdsRef.current.clear();
    tryOnRef.current.clear();
    const ctx: StylistContext = {
      occasion,
      vibe,
      weather,
      note: note.trim() || undefined,
    };
    let opts: OutfitOption[] = [];
    let demo: "no_key" | "error" | null = null;
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
        demo = res.status === 503 ? "no_key" : "error";
      }
    } catch {
      demo = "error";
    }
    if (!opts.length) {
      opts = fallbackOutfits(garments, ctx);
      demo = demo ?? "error";
    }
    setDemoReason(demo);
    setOptions(opts);
    setSelected(0);
    setPhase(opts.length ? "results" : "ask");
    if (!opts.length) {
      toast(
        "Couldn't build a complete outfit — add a few more pieces (a top, a bottom and shoes go a long way).",
        "error"
      );
    }
  };

  const saveLook = async (tryOn?: Blob) => {
    const opt = options[selected];
    if (!opt) return;
    let id = outfitIdsRef.current.get(selected);
    if (!id) {
      id = uid();
      outfitIdsRef.current.set(selected, id);
    }
    await putOutfit({
      id,
      createdAt: Date.now(),
      title: opt.title,
      occasion: occasion ?? "",
      vibe: vibe ?? "",
      explanation: opt.explanation,
      tip: opt.tip,
      garmentIds: opt.garmentIds,
      tryOn: tryOn ?? tryOnRef.current.get(selected),
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
                maxLength={300}
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

          {demoReason && (
            <p className="mb-4 rounded-xl bg-clay-soft px-4 py-3 text-xs leading-5 text-clay-deep">
              {demoReason === "no_key" ? (
                <>
                  Demo stylist — no OpenAI key configured. Add{" "}
                  <code className="font-semibold">OPENAI_API_KEY</code> to{" "}
                  <code className="font-semibold">.env.local</code> (or your
                  hosting provider&apos;s environment settings, then redeploy)
                  to unlock the full AI stylist and try-on.
                </>
              ) : (
                <>
                  The AI stylist couldn&apos;t respond just now, so these are
                  quick picks from your closet. Tap{" "}
                  <span className="font-semibold">Shuffle</span> to try the AI
                  again.
                </>
              )}
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
          initial={tryOnRef.current.get(selected) ?? null}
          onClose={() => setTryOnOpen(false)}
          onGenerated={(blob) => {
            tryOnRef.current.set(selected, blob);
            saveLook(blob).catch(() =>
              toast("Couldn't save the look automatically — try again.", "error")
            );
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
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // The stylist API doesn't stream progress — estimate it: ease toward
    // 95% over the typical response time; the phase change reveals results.
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      setProgress(Math.min(95, Math.round(100 * (1 - Math.exp(-t / 6)))));
    }, 250);
    return () => clearInterval(timer);
  }, []);

  // Map progress onto the checklist: each step owns an equal band.
  const stepIndex = Math.min(
    THINKING_STEPS.length - 1,
    Math.floor((progress / 100) * THINKING_STEPS.length)
  );

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center py-16 text-center">
      <span className="animate-float flex h-16 w-16 items-center justify-center rounded-3xl bg-clay text-white shadow-lift">
        <Sparkles size={28} />
      </span>
      <p className="font-display mt-6 text-2xl font-semibold">
        Styling you… {progress}%
      </p>
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-sand">
        <div
          className="h-full rounded-full bg-clay transition-all duration-300 ease-out"
          style={{ width: `${Math.max(4, progress)}%` }}
        />
      </div>

      <ul className="mt-7 w-full space-y-2.5 text-left">
        {THINKING_STEPS.map((step, i) => (
          <li
            key={step}
            className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium transition-all duration-500 ${
              i < stepIndex
                ? "border-sand bg-surface text-muted"
                : i === stepIndex
                  ? "border-clay/40 bg-clay-soft text-ink shadow-soft"
                  : "border-transparent text-muted/50"
            }`}
          >
            {i < stepIndex ? (
              <Check size={16} className="shrink-0 text-sage" />
            ) : i === stepIndex ? (
              <Loader2 size={16} className="shrink-0 animate-spin text-clay" />
            ) : (
              <span className="h-4 w-4 shrink-0 rounded-full border border-sand" />
            )}
            {step}
            {i === stepIndex && "…"}
          </li>
        ))}
      </ul>
      <p className="mt-5 text-xs text-muted">
        Building looks only from pieces you own
      </p>
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
  initial,
  onClose,
  onGenerated,
}: {
  person: Blob;
  option: OutfitOption;
  garments: Garment[];
  /** Previously generated try-on for this option — shown instead of regenerating. */
  initial: Blob | null;
  onClose: () => void;
  onGenerated: (blob: Blob) => void;
}) {
  const [result, setResult] = useState<Blob | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const startedRef = useRef(false);
  const url = useObjectUrl(result);

  const generate = async () => {
    // Pieces may have been deleted since this option was suggested.
    const picked = option.garmentIds
      .map((id) => garments.find((g) => g.id === id))
      .filter(Boolean) as Garment[];
    if (!picked.length) {
      setError(
        "The pieces in this look are no longer in your wardrobe — go back and restyle."
      );
      return;
    }
    setGenerating(true);
    setError(null);
    setResult(null);
    setProgress(0);
    setElapsed(0);
    // The image API doesn't stream progress, so estimate: ease toward 95%
    // over the typical generation time, then snap to 100% on arrival.
    const startedAt = Date.now();
    const timer = setInterval(() => {
      const t = (Date.now() - startedAt) / 1000;
      setElapsed(Math.round(t));
      setProgress(Math.min(95, Math.round(100 * (1 - Math.exp(-t / 14)))));
    }, 300);
    try {
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
            ? "Virtual try-on needs an AI key — add GEMINI_API_KEY or OPENAI_API_KEY to your environment and restart."
            : res.status === 429
              ? "Today's free image quota is used up. Gemini's free limit resets daily — or enable billing on your AI provider for more generations."
              : json.error || "Generation failed"
        );
      }
      const blob = base64ToBlob(json.image.data, json.image.mimeType);
      setResult(blob);
      onGenerated(blob); // auto-save to lookbook + database
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      clearInterval(timer);
      setProgress(100);
      setGenerating(false);
    }
  };

  useEffect(() => {
    // Only auto-generate when there's no previous render to show.
    if (!startedRef.current && !initial) {
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
            <div className="flex aspect-[3/4] flex-col items-center justify-center gap-4 rounded-2xl bg-sand/50 px-8">
              <Loader2 size={26} className="animate-spin text-clay" />
              <p className="font-display text-lg font-semibold">
                Dressing you up… {progress}%
              </p>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-sand">
                <div
                  className="h-full rounded-full bg-clay transition-all duration-300 ease-out"
                  style={{ width: `${Math.max(4, progress)}%` }}
                />
              </div>
              <p className="text-xs text-muted">
                {elapsed > 45
                  ? "Almost there — big outfits take a little longer…"
                  : "Usually 20–40 seconds"}
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
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="You wearing this outfit"
                className="w-full rounded-2xl shadow-soft"
              />
              <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs font-medium text-sage">
                <BookHeart size={13} /> Saved to your lookbook automatically
              </p>
            </>
          )}
        </div>

        {result && (
          <div className="flex gap-2.5 border-t border-sand px-5 pt-4 pb-safe-4">
            <button
              type="button"
              onClick={onClose}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
            >
              <Check size={16} /> Done
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
