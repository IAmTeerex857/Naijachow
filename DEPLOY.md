# Deploying NaijaPlate v2 to Netlify

**Yes — this is production-ready.** The Vite build passes, and all three Netlify functions
were verified against live Claude, Supabase, and (partially) Google. The local-only quirks you
saw (the `NODE_TLS_REJECT_UNAUTHORIZED` workaround and downloading a portable Node) are about
this laptop's antivirus/firewall — **none of that is in the code, so Netlify is unaffected.**

## What Netlify needs (nothing secret is committed)

- `netlify.toml` (already correct): builds with `npm run build`, publishes `dist/`, serves
  functions from `netlify/functions/`, and redirects `/api/*` → functions.
- Node 18+ (Netlify default is fine; `package.json` pins `engines.node >=18`).
- The 5 secrets set as **Netlify environment variables** (NOT in the repo).

---

## Step 1 — Get this code into your GitHub repo

Your Netlify site auto-deploys from `github.com/Adetola19/Food-App-3` (branch `main`). The
repo currently holds the **old** single-file app, so replace it with this v2 app.

**Recommended: make this app the repo root.** Put the *contents* of the `naijaplate/` folder
(i.e. `index.html`, `package.json`, `netlify.toml`, `src/`, `netlify/`, `public/`, `.gitignore`,
etc.) at the top level of the repo, replacing the old files. Then `netlify.toml` works as-is.

Ways to do it:
- **GitHub web UI:** delete old files, then upload the new ones (drag-and-drop). Simple but manual.
- **Git (if you have it working outside this sandbox):**
  ```bash
  # from inside naijaplate/
  git init && git add . && git commit -m "v2: React+Vite rebuild with v2 design"
  git branch -M main
  git remote add origin https://github.com/Adetola19/Food-App-3.git
  git push -f origin main      # -f because it replaces the old history
  ```

**Alternative: keep it in a subfolder.** If you'd rather leave `naijaplate/` as a subfolder,
set **Base directory = `naijaplate`** in Netlify (Site settings → Build & deploy → Build
settings). Everything else stays the same.

> ⚠️ Do NOT commit `.env` — it's gitignored on purpose. Real keys go in Netlify only (Step 2).

## Step 2 — Set environment variables in Netlify

Netlify → your site → **Site settings → Environment variables** → add these 5 (Production context):

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your `sk-ant-...` key |
| `SUPABASE_URL` | `https://uhluzpknigiibovmaisj.supabase.co` |
| `SUPABASE_SERVICE_KEY` | your `sb_secret_...` key |
| `GOOGLE_SEARCH_API_KEY` | your Google API key |
| `GOOGLE_SEARCH_ENGINE_ID` | your Programmable Search Engine id |

(Rotate these first if you're worried about exposure — they were in a shared file/chat.)

## Step 3 — Deploy

Push to `main` → Netlify builds automatically. Watch **Deploys** for a green build. A red build
is almost always a `netlify.toml` typo. Then open your live URL and generate a plan.

---

## Post-deploy notes

- **Google images for meal combos:** enable the **"Custom Search API"** in your Google Cloud
  project (Console → APIs & Services → Enable APIs → Custom Search API) and make sure the API key
  is authorized for it. Until then, food-card images (from Supabase) work fine; only new plated
  `dish:` combo images stay as emoji tiles.
- **Editing after deploy:** you now have a build step. Edit locally (or in a cloud editor) and
  push; Netlify rebuilds. You can no longer hand-edit one HTML file in the GitHub UI.
- **Budget:** unchanged and still under ~$15/mo — Haiku is cheap, Netlify free tier, Supabase
  free tier, Google 100 free image queries/day (cache-first keeps this near zero).
