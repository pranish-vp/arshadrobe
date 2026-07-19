"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import {
  ArrowRight,
  Camera,
  Check,
  Shirt,
  Sparkles,
  Wand2,
} from "lucide-react";
import { MultiChipGroup } from "@/components/Chips";
import { saveProfile } from "@/lib/db";
import { useObjectUrl } from "@/lib/hooks";
import { resizeToJpeg } from "@/lib/images";
import { VIBE_OPTIONS } from "@/lib/types";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [photo, setPhoto] = useState<Blob | undefined>(undefined);
  const [vibes, setVibes] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoUrl = useObjectUrl(photo);

  const finish = async () => {
    setSaving(true);
    await saveProfile({
      name: name.trim() || "there",
      photo,
      vibes,
      onboarded: true,
    });
    router.replace("/wardrobe?welcome=1");
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-md">
        {/* Progress dots */}
        <div className="mb-8 flex justify-center gap-2">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-clay" : "w-1.5 bg-sand"
              }`}
            />
          ))}
        </div>

        {step === 0 && (
          <div className="animate-fade-up text-center">
            <div className="animate-float mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-clay text-white shadow-lift">
              <Shirt size={36} strokeWidth={1.8} />
            </div>
            <h1 className="font-display text-4xl font-semibold tracking-tight">
              Arsha<span className="text-clay">drobe</span>
            </h1>
            <p className="mt-3 text-sm leading-6 text-muted">
              Your closet, styled by AI. Catalog what you own, ask for the
              perfect outfit, and <em>see yourself wearing it</em>.
            </p>
            <div className="mt-8 space-y-3 text-left">
              {[
                { icon: Camera, text: "Snap your clothes — AI tags & organizes them" },
                { icon: Sparkles, text: "Ask the stylist for outfit ideas for any occasion" },
                { icon: Wand2, text: "Virtual try-on: a photo of you in the look" },
              ].map(({ icon: Icon, text }) => (
                <div
                  key={text}
                  className="flex items-center gap-3 rounded-2xl border border-sand bg-surface px-4 py-3.5 shadow-soft"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-clay-soft text-clay">
                    <Icon size={17} />
                  </span>
                  <p className="text-sm font-medium">{text}</p>
                </div>
              ))}
            </div>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What should we call you?"
              className="mt-8 w-full rounded-full border border-sand bg-surface px-5 py-3.5 text-center text-sm shadow-soft outline-none focus:border-clay"
            />
            <button
              type="button"
              onClick={() => setStep(1)}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
            >
              Let&apos;s go <ArrowRight size={16} />
            </button>
          </div>
        )}

        {step === 1 && (
          <div className="animate-fade-up text-center">
            <h2 className="font-display text-3xl font-semibold">
              Your try-on photo
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              A full-body photo lets the AI show outfits on <strong>you</strong>.
              Stand straight, good light, plain background works best.
            </p>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              hidden
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setPhoto(await resizeToJpeg(f, 1280));
                e.target.value = "";
              }}
            />
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="mx-auto mt-6 block w-56 overflow-hidden rounded-3xl border-2 border-dashed border-sand bg-surface/60 transition-colors hover:border-clay"
            >
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoUrl}
                  alt="you"
                  className="aspect-[3/4] w-full object-cover"
                />
              ) : (
                <span className="flex aspect-[3/4] flex-col items-center justify-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-clay-soft text-clay">
                    <Camera size={22} />
                  </span>
                  <span className="text-sm font-semibold">Add your photo</span>
                  <span className="px-6 text-xs text-muted">
                    Stays on your device
                  </span>
                </span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3.5 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
            >
              {photo ? "Looking good" : "Continue"} <ArrowRight size={16} />
            </button>
            {!photo && (
              <button
                type="button"
                onClick={() => setStep(2)}
                className="mt-3 text-xs font-medium text-muted underline-offset-2 hover:underline"
              >
                Skip for now — add it later in Profile
              </button>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="animate-fade-up text-center">
            <h2 className="font-display text-3xl font-semibold">
              Your style, in a word or three
            </h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Pick the vibes that feel like you — the stylist keeps them in mind.
            </p>
            <div className="mt-6 flex justify-center">
              <MultiChipGroup
                options={VIBE_OPTIONS}
                value={vibes}
                onChange={setVibes}
              />
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={finish}
              className="mt-8 flex w-full items-center justify-center gap-2 rounded-full bg-clay py-3.5 text-sm font-semibold text-white shadow-soft transition-all hover:bg-clay-deep active:scale-[0.98] disabled:opacity-50"
            >
              <Check size={16} /> Open my wardrobe
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
