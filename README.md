# NaijaPlate

Nigerian meal planning with culturally realistic dish combinations, saved user preferences, and private TikTok/Instagram recipe imports.

## Stack

- React 18 and Vite
- Vercel Functions
- Azure OpenAI structured output
- Supabase Auth, Postgres, Storage, and RLS
- Trigger.dev background jobs
- Bachs recurring subscriptions
- Supadata social metadata and transcripts

Transactional email through Resend is intentionally deferred.

## Local setup

1. Copy `.env.example` to `.env.local` and enter development credentials.
2. Run `npm install`.
3. Run `npm run dev:full` for the frontend and Vercel Functions.
4. Run `npm run trigger:dev` separately when testing social imports.

Never put credentials in `.env.example`. It is a tracked documentation file.

## Commands

```bash
npm run dev             # frontend-only Vite server
npm run dev:full        # Vercel local frontend and API runtime
npm run test            # unit tests
npm run typecheck:trigger
npm run build
npm run check           # all local quality gates
npm run trigger:dev
npm run trigger:deploy
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

### Premium subscriptions

Premium is a recurring ₦2,500/month Bachs subscription that unlocks 14- and 30-day plans. Checkout redirects never grant access: signed Bachs subscription webhooks are validated and reconciled transactionally before Premium is enabled.

### Social imports

1. Signed-in user submits a public TikTok or Instagram URL.
2. A private import record is created in Supabase.
3. Trigger.dev retrieves metadata and transcript through Supadata.
4. Azure OpenAI extracts an editable recipe draft and separates subjective review claims.
5. The user approves, rejects, or requests changes.

Imported content is private to the importing user by default.

## Database

Versioned migrations are in `supabase/migrations/` and include:

- Magic-link user profiles and preferences
- Sensitive health profiles protected by RLS
- Canonical dishes, aliases, combinations, and evidence
- One-use guest generation sessions
- Persisted and saved plans
- Private recipes and social imports
- Curated image assets
- Bachs subscription state and deduplicated webhook events

Apply migrations through the Supabase CLI only after reviewing them against the target project.

## Images

The production image API reads approved Supabase Storage assets first, then the existing curated `image_cache`. It does not search Google or publish arbitrary scraped images. Every new asset should include provenance, licensing, attribution, and review status.

## Security notes

- Server secrets must exist only in Vercel and Trigger.dev environments.
- Health data must not be logged or included in analytics.
- AI output is schema-validated and restricted to server-approved candidates.
- RLS protects all user-owned records.
- API quotas are enforced atomically in Supabase; Turnstile adds guest abuse protection when configured.
- `BACHS_SECRET_KEY` and `BACHS_WEBHOOK_SECRET` are server-only. Configure the Bachs endpoint as `/api/bachs-webhook` for the three `customer.subscription.*` events.

See `DEPLOY.md` for deployment steps and `docs/` for draft product policies.
