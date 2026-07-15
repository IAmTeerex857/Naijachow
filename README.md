# NaijaPlate v2 (React + Vite)

Nigerian meal-planning web app. Pick the finished dishes you can make; Claude arranges
a balanced multi-day plan (breakfast / lunch / dinner) from only those selections.

This is the **v2 rebuild**: the frontend is now **React + Vite** with the full v2 design
system (spice-red / saffron / jade palette, Bricolage Grotesque + Sora + JetBrains Mono,
light **and** dark themes). The backend is unchanged in spirit — three **Netlify Functions**
talk to Claude and a Supabase-backed image cache. Nothing secret ever reaches the browser.

## Stack

- **Frontend:** React 18 + Vite → static build in `dist/`
- **Backend:** Netlify Functions (`netlify/functions/`) → Claude Haiku + Supabase + Google Custom Search
- **Hosting:** Netlify (auto-deploy from `main`). Still fits the < $15/mo budget.

## Project layout

```
naijaplate/
├── index.html                  # Vite entry (loads fonts + /src/main.jsx)
├── vite.config.js              # React plugin + dev proxy for /api → netlify dev
├── netlify.toml                # build (vite) + /api/* redirect + security headers
├── .env.example                # server-side secrets (set these in Netlify)
├── src/
│   ├── main.jsx                # React root
│   ├── App.jsx                 # phases (select → loading → plan), state, swap logic
│   ├── data/foods.js           # the 60-dish catalogue  ← VERIFY IDS (see below)
│   ├── lib/
│   │   ├── api.js              # generatePlan / swapMeal / image fetch (+ session cache)
│   │   └── useTheme.js         # light/dark toggle, persisted
│   ├── styles/
│   │   ├── tokens.css          # v2 design tokens (:root light, .dark override)
│   │   └── global.css          # all component styles, token-driven
│   └── components/             # HeaderBand, SelectScreen, FoodCard, ImageTile,
│                               # PlanScreen, DayCard, MealSlot, NutritionStrip,
│                               # FastingCard, PremiumBanner, ThemeToggle
└── netlify/functions/
    ├── generate-plan.js        # POST /api/generate-plan  (Claude Haiku, dish pairing + dish_key)
    ├── swap-meal.js            # POST /api/swap-meal       (single-meal regen)
    └── get-food-image.js       # GET  /api/get-food-image  (memory → Supabase → Google)
```

## Run it locally

You need Node 18+. The functions need env vars, so the simplest local setup is the
Netlify CLI, which runs Vite **and** the functions together:

```bash
npm install
npm install -g netlify-cli          # one-time
cp .env.example .env                # then fill in your keys
netlify dev                         # serves app + /api/* on http://localhost:8888
```

Prefer plain Vite for pure UI work? `npm run dev` runs the app on :5173 and proxies
`/api/*` to `netlify dev` on :8888 (start both). Without functions running, image/plan
calls just fall back gracefully (emoji tiles, error message).

## Environment variables (set in Netlify → Site settings → Environment variables)

| Key | Purpose |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API (generate-plan, swap-meal) |
| `GOOGLE_SEARCH_API_KEY` | Google Custom Search (image last resort) |
| `GOOGLE_SEARCH_ENGINE_ID` | Programmable Search Engine id |
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | `sb_secret_...` service key (REST access to `image_cache`) |

⚠️ Never prefix these with `VITE_` — that would bundle them into the browser build.

## Deploy

Push to `main`; Netlify builds with `npm run build` and publishes `dist/`. The `/api/*`
redirect maps to the functions. **Do not** add `timeout = 26` under `[functions]` in
`netlify.toml` — it's invalid and breaks every deploy.

## ✅ FOOD ids are verified against Supabase

`src/data/foods.js` was reconstructed from the PRD and then **reconciled against the live
Supabase `image_cache` export** (2026-07). All 60 `food:<id>` keys resolve to a curated
image — no card falls back to the emoji tile for a missing photo. Five ids use Supabase's
longer names: `whiterice`, `wheatswallow`, `boiledyam`, `friedplantain`, `stew`.

Note: the old pre-pivot `index.html` (raw ingredients — Garri, spices, 8 categories) is
**not** the source of truth; Supabase confirms the live app uses the pivoted finished-dishes
model. If you add a dish later, curate its image in Supabase under `food:<newid>`.

## What changed vs the old single-file app

- Single `public/index.html` → componentised React + Vite build.
- New v2 visual system with **dark mode** (was light-only).
- Post-pivot model throughout: 5 dish categories (Soups / Swallows / Carbs / Protein /
  Fruits), soup-must-pair-with-swallow rules, normalized `dish_key`, **Swap** on every meal.
- Image function uses the 3-layer **Supabase + Google** cache (Unsplash fully retired).

## Not built yet (roadmap)

User accounts + saved plans, Paystack payment + gating 14/30-day, vendor section,
image-approval workflow, PDF export. See `../NaijaPlate-PRD.md` §8.
