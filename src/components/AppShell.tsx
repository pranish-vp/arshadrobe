"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  BookHeart,
  Home,
  Shirt,
  Sparkles,
  UserRound,
} from "lucide-react";
import { getProfile } from "@/lib/db";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/wardrobe", label: "Wardrobe", icon: Shirt },
  { href: "/stylist", label: "Stylist", icon: Sparkles, primary: true },
  { href: "/lookbook", label: "Lookbook", icon: BookHeart },
  { href: "/profile", label: "Profile", icon: UserRound },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const onboarding = pathname === "/onboarding";

  // First run → send to onboarding.
  useEffect(() => {
    if (onboarding) return;
    getProfile().then((p) => {
      if (!p?.onboarded) router.replace("/onboarding");
    });
  }, [onboarding, router]);

  if (onboarding) return <>{children}</>;

  return (
    <div className="min-h-dvh">
      {/* Desktop header */}
      <header className="sticky top-0 z-40 hidden border-b border-sand bg-cream/80 backdrop-blur-md md:block">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="font-display text-2xl font-semibold tracking-tight">
            Arsha<span className="text-clay">drobe</span>
          </Link>
          <nav className="flex items-center gap-1">
            {NAV.map(({ href, label, icon: Icon, primary }) => {
              const active =
                pathname === href ||
                (href !== "/" && pathname.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                    primary
                      ? "bg-clay text-white shadow-soft hover:bg-clay-deep"
                      : active
                        ? "bg-ink text-cream"
                        : "text-muted hover:bg-sand hover:text-ink"
                  }`}
                >
                  <Icon size={16} strokeWidth={2.2} />
                  {label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto w-full max-w-6xl px-4 pb-28 pt-4 md:px-6 md:pb-16 md:pt-8">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sand bg-surface/95 backdrop-blur-md md:hidden">
        <div className="pb-safe">
          <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 py-1.5">
            {NAV.map(({ href, label, icon: Icon, primary }) => {
              const active =
                pathname === href ||
                (href !== "/" && pathname.startsWith(href));
              if (primary) {
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-label={label}
                    className="flex flex-col items-center gap-1"
                  >
                    <span className="-mt-7 flex h-14 w-14 items-center justify-center rounded-full bg-clay text-white shadow-lift transition-transform active:scale-95">
                      <Icon size={24} strokeWidth={2.2} />
                    </span>
                    <span className="text-[10px] font-semibold text-clay">
                      {label}
                    </span>
                  </Link>
                );
              }
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex flex-col items-center gap-1 rounded-xl py-1.5 ${
                    active ? "text-ink" : "text-muted"
                  }`}
                >
                  <Icon size={22} strokeWidth={active ? 2.4 : 2} />
                  <span className="text-[10px] font-medium">{label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
    </div>
  );
}
