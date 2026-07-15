# Resume — NaijaPlate v2

Session paused 2026-07-15 so the machine could restart. Here's exactly where things stand
and how to pick back up.

## State (what's done)

- ✅ Full **React + Vite** app built in this folder, with the **v2 design system** (light/dark,
  Bricolage Grotesque + Sora + JetBrains Mono), Select + Plan screens, swap, and the three
  Netlify functions written to the PRD contracts.
- ✅ `src/data/foods.js` — 60 dishes, **ids verified against the live Supabase image_cache**
  (zero mismatches; every card resolves to a curated photo).
- ✅ Verified locally: `npm install` succeeded, `npm run build` compiled cleanly (46 modules),
  and the preview server served the app at http://127.0.0.1:4599/ (HTTP 200, correct fonts +
  bundles, real app code present).
- ⏳ **Backend not yet exercised** — needs your secret keys (see below). Running it makes real
  (cheap) Claude calls + counts Google image quota.

## What survives the reboot vs what doesn't

- **Survives:** all source code + `node_modules/` (they're on disk here, not in temp).
- **Gone after reboot:** the portable Node runtime (was in a temp scratchpad) and the running
  preview server.

## To run the frontend again after reboot

You need a Node runtime. Either:

**Option A — install Node normally** (recommended): https://nodejs.org (LTS). Then:
```bash
cd "Naija Plate/naijaplate"
npm run build && npm run preview   # → http://localhost:4173
# or, for live editing with hot reload:
npm run dev                        # → http://localhost:5173
```
(`node_modules` is already installed, so no need to `npm install` again unless you delete it.)

**Option B — let Claude re-bootstrap portable Node** next session (network works here, so
Claude can re-download it and start the server without you installing anything).

## To run the backend (plan generation + live images)

1. Copy `.env.example` to `.env` and fill in your keys:
   - `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_KEY`, `GOOGLE_SEARCH_API_KEY`, `GOOGLE_SEARCH_ENGINE_ID`
   - Put them in `.env` directly (don't paste secrets into chat).
2. Install the Netlify CLI once: `npm install -g netlify-cli`
3. Run app + functions together: `netlify dev` → http://localhost:8888
   - ⚠️ Clicking "Plan My Meals" now makes **real billed Claude calls** and uses Google image quota.

## Open items / next choices

- Wire Premium banner → Paystack + gate 14/30-day plans.
- Uncomment/build the vendor (grocery affiliate) section.
- User accounts + saved plans (Supabase Auth).
- PDF export of plans.
