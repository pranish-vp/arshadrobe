# Arshadrobe — Product & Technical Spec

> Name: **Arshadrobe** ✅
> Status: MVP implemented (Phases 0–3 + parts of 4) · Last updated: 2026-07-19

---

## 1. The Idea in One Sentence

An AI stylist that knows *your* actual closet: upload your clothes once, then every day ask
"what should I wear?" — the AI picks a real outfit from what you own and shows you a
photorealistic image of **you** wearing it.

The core magic = **Ask → AI picks from MY clothes → see MYSELF wearing it.**

---

## 2. Core User Flow

1. **Onboard** — sign up, upload 1–3 photos of yourself (your try-on "avatar"), optional style quiz.
2. **Build wardrobe** — snap/upload photos of clothes. AI removes the background and auto-tags each
   item (category, color, pattern, season, formality, material).
3. **Organize** — browse a clean, filterable grid of your closet.
4. **Ask the stylist** — "What should I wear today?" AI asks about occasion, weather, and vibe.
5. **Get an outfit** — AI assembles a complete outfit *from items you own*, shown instantly as a collage.
6. **Try it on** — AI generates a photorealistic image of *you* wearing that outfit.
7. **Save** — keep favorites in a lookbook, log what you actually wore.

---

## 3. Feature Set by Phase

### Phase 0 — Foundation
- Next.js project + PWA shell (installable, offline-aware).
- Supabase: auth, Postgres, file storage.
- DB schema for users, garments, outfits, try-on images.

### Phase 1 — The Wardrobe
- Photo upload (camera or file), multiple at once.
- Automatic background removal → clean cutout thumbnails.
- **AI auto-tagging** (Claude vision): category, subcategory, colors, pattern, season, formality, material.
- Browsable grid with filters (color, category, season, formality, favorites).
- Edit/correct tags, delete items.

### Phase 2 — The Stylist (text/collage)
- Conversational UI: AI asks occasion, weather (auto from location), vibe, formality.
- Outfit assembly from real inventory — respects category rules (one top, one bottom, shoes, etc.).
- 2–3 options per request (e.g. "safe / bold / cozy").
- "Why this works" explanation.
- Instant **collage** of the chosen items (garment cutouts arranged as a look).

### Phase 3 — Virtual Try-On (the core wow)
- Feed user photo + selected garment images to Gemini 2.5 Flash Image → render user wearing the outfit.
- Loading state shows the collage while the photorealistic image generates.
- Save generated look to lookbook.
- Regenerate / tweak.

### Phase 4 — Stickiness
- Weather-aware daily suggestion ("It's 12°C and raining — here's today's fit").
- Outfit history / diary (log what you wore, wear-count per item).
- Calendar-aware suggestions (dressy for that 8pm dinner).
- Packing assistant (capsule for a trip).
- Gap analysis + smart shopping hints ("you have no versatile jacket").
- Share-a-look for friend feedback.

---

## 4. Tech Stack (locked in)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js (App Router) + TypeScript** | Built-in secure server layer for AI calls; PWA + image optimization; one deploy. |
| Styling | **Tailwind CSS** | Fast, mobile-first, clean. |
| DB / Auth / Storage | **Supabase** | Postgres + auth + file storage, generous free tier. |
| Garment tagging + stylist reasoning | **Claude (Anthropic API)** | Strong vision tagging + outfit reasoning. |
| Virtual try-on images | **Gemini 2.5 Flash Image ("Nano Banana")** | Best current "dress this person" quality. Alternates: FASHN / Replicate VTON. |
| Background removal | **remove.bg** or in-browser model | Clean catalog cutouts. |
| Hosting | **Vercel** | Native Next.js deploy. |

**Security rule:** all paid-AI API keys live only in Next.js server routes / server actions — never
shipped to the browser.

---

## 5. Data Model (first draft)

- **users** — id, email, display name, avatar photo url(s), style preferences.
- **garments** — id, user_id, image_url, cutout_url, category, subcategory, colors[], pattern,
  season[], formality, material, wear_count, favorite, created_at.
- **outfits** — id, user_id, garment_ids[], occasion, vibe, ai_explanation, created_at.
- **tryon_images** — id, outfit_id, user_id, image_url, model_used, created_at.
- **wear_log** — id, user_id, outfit_id, worn_on (date).

---

## 6. The Try-On Reality Check

Virtual try-on (VTON) = feed a person photo + garment photo(s) → output the person wearing them.

- **Primary engine:** Gemini 2.5 Flash Image — you prompt it with the user's photo + garment cutouts.
- **Known limits:** faces can drift, fine patterns can smear, multi-garment (top+bottom+shoes at once)
  is harder than a single item; each render costs a few cents and takes a few seconds.
- **Mitigations:** show the instant collage first; generate try-on async; let the user regenerate;
  keep the user's face as a strong reference; consider a dedicated VTON API (FASHN/Kling) if Gemini
  quality isn't enough for full outfits.

---

## 7. Open Decisions / TODO

- [ ] Final app name (see options below).
- [ ] Confirm background-removal approach (API vs in-browser).
- [ ] Confirm try-on engine after a real quality test (Gemini vs dedicated VTON API).
- [ ] Design the onboarding + main screen UI.
- [ ] Cost model at expected usage levels.

---

## 8. Name Shortlist

- **Drape** — fashion-y, short, ownable. (top pick)
- **Muse** — the AI stylist as your creative muse. (top pick)
- **Wove**, **Fitly**, **Styld**, **Aura**, **Rack**, **Threadmate**, **WhatToWear**.
- **Arsha** — current folder name; keep if it's meaningful to you.
