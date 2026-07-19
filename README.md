# Arshadrobe 👗✨

**Your closet, styled by AI.** Catalog your wardrobe, ask for outfit ideas for any
occasion, and see a photo of *you* wearing the look.

Installable PWA · works on phone & desktop · your photos never leave your device
(except to the OpenAI API for tagging & try-on).

## Quick start

```bash
npm install
npm run dev
```

Open http://localhost:3000 — the whole app works immediately in **demo mode**
(manual tagging + rule-based stylist).

## Enable the full AI (recommended)

1. Get an API key at https://platform.openai.com/api-keys
2. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY=your-key`
3. Restart the dev server

That unlocks:
- **Auto-tagging** — snap a garment, `gpt-5-mini` fills in category/colors/season/formality
- **AI stylist** — conversational outfit ideas built only from clothes you own
- **Virtual try-on** — a photorealistic image of you wearing the outfit
  (`gpt-image-1` with high input fidelity for accurate faces)

## How it works

| Piece | Tech |
|---|---|
| App | Next.js (App Router) + TypeScript + Tailwind v4, installable PWA |
| Accounts | Username + password (scrypt-hashed) with cookie sessions when `DATABASE_URL` is set; no login needed in local mode |
| Storage | **Neon Postgres** when `DATABASE_URL` is set (per-account, synced); IndexedDB on-device otherwise. First sign-in auto-migrates local data up. |
| Images | **Cloudinary** free CDN when configured; otherwise stored inside Neon — both free |
| AI calls | Next.js API routes (`/api/tag`, `/api/stylist`, `/api/tryon`) → OpenAI — the key stays server-side |
| Background removal | `@imgly/background-removal`, fully in-browser (free) |
| Weather | Open-Meteo (free, no key) for weather-aware outfits |

## Project map

```
src/
  app/            pages: home, onboarding, wardrobe, stylist, lookbook, profile
  app/api/        AI routes: tag, stylist, tryon, health
  app/api/auth/   signup, login, logout, me (cookie sessions)
  app/api/data/   DB routes: profile, garments, outfits, clear (Neon Postgres)
  components/     AppShell (nav), AddGarmentSheet, GarmentCard, OutfitCollage, …
  lib/            types, db facade (cloud/local), image utils, weather, fallback stylist
  lib/server/     OpenAI client, Neon client, auth, image storage (server-only)
public/sw.js      service worker (offline shell)
```

See `SPEC.md` for the full product spec and roadmap.
