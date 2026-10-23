# Naijachow

Nigerian meal planning with culturally realistic dish combinations, saved preferences, flexible swaps, and cooking-video searches.

## Stack

- React 18 and Vite
- Vercel Functions
- Azure OpenAI structured output
- Supabase Auth, Postgres, Storage, and RLS
- Bachs one time payments
- Resend transactional email

## Local setup

1. Copy `.env.example` to `.env.local` and enter development credentials.
2. Run `npm ci`.
3. Run `npm run dev:full` for the frontend and Vercel Functions.
4. Run `npm run check` before opening a pull request.

Never put credentials in `.env.example`. It is a tracked documentation file.

## Commands

```bash
npm run dev             # frontend-only Vite server
npm run dev:full        # Vercel local frontend and API runtime
npm run test            # unit tests
npm run build
npm run check           # all local quality gates
```

## Main flows

### Meal planning

1. User answers planning and optional health questions.
2. User selects at least three canonical dishes.
3. Server constructs culturally valid candidate combinations.
4. Azure OpenAI selects only from those candidates and supplies descriptions and estimates.
5. Server validates and materializes every meal.
6. A signed-in user receives the plan immediately.
7. A guest receives one generation, but must sign in by email to claim and view it.

### Premium access

Premium is a one time ₦2,500 Bachs payment that unlocks longer plans for 30 days. Checkout redirects never grant access. Signed `collection.succeeded` webhooks are validated and reconciled transactionally before Premium is enabled.

### Recipes and tutorials

Each meal links to a focused YouTube search for Nigerian cooking videos. Naijachow does not select, verify, or reproduce third-party recipes.

## Database

Versioned migrations are in `supabase/migrations/` and include:

- Six-digit email OTP user profiles and preferences
- Sensitive health profiles protected by RLS
- Canonical dishes, aliases, combinations, and evidence
- One-use guest generation sessions
- Persisted and saved plans
- Curated image assets
- Bachs Premium access state and deduplicated webhook events

Apply migrations through the Supabase CLI only after reviewing them against the target project.

## Images

Every photo is a reviewed, watermark-free Wikimedia Commons image under CC0, public domain, CC BY, or CC BY-SA, listed by file title in `scripts/catalog-images.json`. `node scripts/sync-catalog-images.mjs` reads each file's licence and creator from Commons, copies the photo into the public `catalog-assets` bucket, and registers it in `assets` (food cards) or `meal_media` (exact meal photos) with its attribution. Run it with `--dry-run` first. The scraped `image_cache` table is no longer read.

Generated meals show the exact meal photo when one exists. Otherwise they show the photos of up to three components side by side, each labelled, so no single ingredient photo stands in for the whole meal. To add a photo, review it for accuracy and watermarks, add its Commons file title to the manifest, and run the sync script.

## Security notes

- Server secrets must exist only in Vercel environment variables.
- Health data must not be logged or included in analytics.
- AI output is schema-validated and restricted to server-approved candidates.
- RLS protects all user-owned records.
- API quotas are enforced atomically in Supabase; Turnstile adds guest abuse protection when configured.
- `BACHS_SECRET_KEY` and `BACHS_WEBHOOK_SECRET` are server only. Configure the Bachs endpoint as `/api/bachs-webhook` for `collection.succeeded`.

See `DEPLOY.md` for deployment steps and `docs/` for draft product policies.
