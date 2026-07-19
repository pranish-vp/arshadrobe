"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Check, LogOut } from "lucide-react";
import { MultiChipGroup } from "@/components/Chips";
import { getProfile, resetDataCaches, saveProfile } from "@/lib/db";
import { useObjectUrl } from "@/lib/hooks";
import { resizeToJpeg } from "@/lib/images";
import { VIBE_OPTIONS, type Profile } from "@/lib/types";

interface Health {
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

  const logout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    resetDataCaches();
    location.href = "/login";
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

      {health?.db && (
        <button
          type="button"
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-full border border-sand bg-surface py-3 text-sm font-semibold text-muted shadow-soft transition-all hover:text-ink active:scale-[0.98]"
        >
          <LogOut size={16} /> Log out
        </button>
      )}

      <p className="pb-4 text-center text-xs text-muted">
        Arshadrobe · your closet, styled by AI
      </p>
    </div>
  );
}
