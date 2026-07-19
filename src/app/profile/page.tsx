"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Database,
  ShieldCheck,
  Sparkles,
  Trash2,
} from "lucide-react";
import { MultiChipGroup } from "@/components/Chips";
import { clearAllData, getProfile, saveProfile } from "@/lib/db";
import { useObjectUrl } from "@/lib/hooks";
import { resizeToJpeg } from "@/lib/images";
import { VIBE_OPTIONS, type Profile } from "@/lib/types";

interface Health {
  configured: boolean;
  textModel: string;
  imageModel: string;
  db: boolean;
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [health, setHealth] = useState<Health | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const photoUrl = useObjectUrl(profile?.photo ?? null);

  useEffect(() => {
    getProfile().then((p) =>
      setProfile(p ?? { name: "", vibes: [], onboarded: true })
    );
    fetch("/api/health")
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => {});
  }, []);

  const save = async () => {
    if (!profile) return;
    await saveProfile({ ...profile, onboarded: true });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1600);
  };

  const wipe = async () => {
    if (
      !confirm(
        "Delete EVERYTHING — wardrobe, looks and profile? This can't be undone."
      )
    )
      return;
    await clearAllData();
    location.href = "/onboarding";
  };

  if (!profile) return <div className="skeleton h-64 rounded-3xl" />;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="font-display text-3xl font-semibold tracking-tight">
        Profile
      </h1>

      {/* Identity */}
      <section className="rounded-3xl border border-sand bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-5">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) setProfile({ ...profile, photo: await resizeToJpeg(f, 1280) });
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="group relative h-28 w-24 shrink-0 overflow-hidden rounded-2xl border-2 border-dashed border-sand transition-colors hover:border-clay"
          >
            {photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrl}
                alt="you"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full flex-col items-center justify-center gap-1.5 text-muted">
                <Camera size={20} />
                <span className="text-[10px] font-medium">Add photo</span>
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 bg-ink/60 py-1 text-center text-[10px] font-medium text-cream opacity-0 transition-opacity group-hover:opacity-100">
              Change
            </span>
          </button>
          <div className="min-w-0 flex-1">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Name
            </label>
            <input
              value={profile.name === "there" ? "" : profile.name}
              onChange={(e) => setProfile({ ...profile, name: e.target.value })}
              placeholder="Your name"
              className="w-full rounded-full border border-sand bg-cream px-4 py-2.5 text-sm outline-none focus:border-clay"
            />
            <p className="mt-2 text-xs leading-5 text-muted">
              Your photo powers virtual try-on. Full-body, good light, plain
              background works best.
            </p>
          </div>
        </div>
        <div className="mt-5">
          <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
            Style vibes
          </label>
          <MultiChipGroup
            options={VIBE_OPTIONS}
            value={profile.vibes}
            onChange={(v) => setProfile({ ...profile, vibes: v })}
          />
        </div>
        <button
          type="button"
          onClick={save}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-cream transition-all hover:bg-black active:scale-[0.98]"
        >
          {savedFlash ? <Check size={16} /> : null}
          {savedFlash ? "Saved" : "Save profile"}
        </button>
      </section>

      {/* AI status */}
      <section className="rounded-3xl border border-sand bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              health?.configured ? "bg-sage-soft text-sage" : "bg-clay-soft text-clay"
            }`}
          >
            <Sparkles size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">
              {health?.configured ? "AI stylist connected" : "Demo mode"}
            </p>
            <p className="text-xs text-muted">
              {health?.configured
                ? `${health.textModel} · try-on via ${health.imageModel}`
                : "Auto-tagging, smart styling & try-on need an OpenAI API key"}
            </p>
          </div>
        </div>
        {!health?.configured && (
          <div className="mt-4 rounded-xl bg-cream p-4 text-xs leading-6 text-ink/80">
            <p className="font-semibold">Enable the full AI:</p>
            <ol className="ml-4 mt-1 list-decimal space-y-1">
              <li>
                Get a key at{" "}
                <span className="font-medium">platform.openai.com/api-keys</span>
              </li>
              <li>
                Create <code className="font-semibold">.env.local</code> in the
                project root with{" "}
                <code className="font-semibold">OPENAI_API_KEY=your-key</code>
              </li>
              <li>Restart the dev server</li>
            </ol>
          </div>
        )}
      </section>

      {/* Privacy + data */}
      <section className="rounded-3xl border border-sand bg-surface p-5 shadow-soft">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sage-soft text-sage">
            <ShieldCheck size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold">Private by design</p>
            <p className="text-xs leading-5 text-muted">
              {health?.db
                ? "Your wardrobe lives in your own Neon Postgres database. Images are sent to OpenAI's API solely to tag pieces and generate try-ons."
                : "Your photos and wardrobe are stored only on this device. Images are sent to OpenAI's API solely to tag pieces and generate try-ons."}
            </p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-3 border-t border-sand pt-4">
          <span
            className={`flex h-10 w-10 items-center justify-center rounded-xl ${
              health?.db ? "bg-sage-soft text-sage" : "bg-cream text-muted"
            }`}
          >
            <Database size={18} />
          </span>
          <StorageInfo cloud={health?.db ?? false} />
          <button
            type="button"
            onClick={wipe}
            className="ml-auto flex items-center gap-1.5 rounded-full border border-clay/40 px-4 py-2 text-xs font-semibold text-clay-deep transition-colors hover:bg-clay-soft"
          >
            <Trash2 size={13} /> Erase all data
          </button>
        </div>
      </section>

      <p className="pb-4 text-center text-xs text-muted">
        Arshadrobe · your closet, styled by AI
      </p>
    </div>
  );
}

function StorageInfo({ cloud }: { cloud: boolean }) {
  const [text, setText] = useState("Stored on this device");
  useEffect(() => {
    if (cloud) return;
    navigator.storage?.estimate?.().then((e) => {
      if (e.usage != null) {
        const mb = e.usage / (1024 * 1024);
        setText(`${mb < 1 ? mb.toFixed(2) : mb.toFixed(1)} MB on this device`);
      }
    });
  }, [cloud]);
  return (
    <div>
      <p className="text-sm font-semibold">
        {cloud ? "Cloud database connected" : "Local storage"}
      </p>
      <p className="text-xs text-muted">
        {cloud ? "Neon Postgres — synced across your devices" : text}
      </p>
    </div>
  );
}
