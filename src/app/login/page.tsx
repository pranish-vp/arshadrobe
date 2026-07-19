"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Loader2, LogIn, Shirt, UserRoundPlus } from "lucide-react";
import { migrateLocalToCloud, resetDataCaches } from "@/lib/db";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Client-side pre-checks (the server enforces the same rules).
    if (!/^[a-z0-9_]{3,30}$/i.test(username.trim())) {
      setError("Username must be 3–30 letters, numbers or underscores.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(
          json.error === "no_db"
            ? "No database configured — the app runs in local mode. Add DATABASE_URL to enable accounts."
            : json.error || "Something went wrong — try again."
        );
        return;
      }
      resetDataCaches();
      // Bring any on-device data along to a brand-new account.
      await migrateLocalToCloud(json.user.id);
      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error — check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <div className="animate-float mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-clay text-white shadow-lift">
            <Shirt size={30} strokeWidth={1.8} />
          </div>
          <h1 className="font-display text-3xl font-semibold tracking-tight">
            Arsha<span className="text-clay">drobe</span>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "login"
              ? "Welcome back — your closet missed you."
              : "Create your account and build your closet."}
          </p>
        </div>

        <form
          onSubmit={submit}
          className="rounded-3xl border border-sand bg-surface p-5 shadow-soft"
        >
          <label className="block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Username
            </span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
              minLength={3}
              maxLength={30}
              pattern="[A-Za-z0-9_]+"
              title="3–30 letters, numbers or underscores"
              className="w-full rounded-full border border-sand bg-cream px-4 py-2.5 text-sm outline-none focus:border-clay"
            />
          </label>
          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">
              Password
            </span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              required
              minLength={6}
              maxLength={72}
              className="w-full rounded-full border border-sand bg-cream px-4 py-2.5 text-sm outline-none focus:border-clay"
            />
          </label>

          {error && (
            <p className="mt-3 rounded-xl bg-clay-soft px-4 py-2.5 text-xs leading-5 text-clay-deep">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-ink py-3 text-sm font-semibold text-cream transition-all enabled:hover:bg-black enabled:active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={16} className="animate-spin" />
            ) : mode === "login" ? (
              <LogIn size={16} />
            ) : (
              <UserRoundPlus size={16} />
            )}
            {mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
          }}
          className="mt-5 w-full text-center text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
        >
          {mode === "login"
            ? "New here? Create an account"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}
