"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";

export default function EmptyState({
  icon: Icon,
  title,
  body,
  actionLabel,
  actionHref,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  actionLabel?: string;
  actionHref?: string;
  onAction?: () => void;
}) {
  const button = (
    <span className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream shadow-soft transition-transform hover:scale-[1.02] active:scale-95">
      {actionLabel}
    </span>
  );
  return (
    <div className="animate-fade-up flex flex-col items-center rounded-3xl border border-dashed border-sand bg-surface/60 px-6 py-16 text-center">
      <div className="animate-float mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-clay-soft text-clay">
        <Icon size={30} strokeWidth={1.8} />
      </div>
      <h3 className="font-display text-2xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{body}</p>
      {actionLabel && (
        <div className="mt-6">
          {actionHref ? (
            <Link href={actionHref}>{button}</Link>
          ) : (
            <button type="button" onClick={onAction}>
              {button}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
