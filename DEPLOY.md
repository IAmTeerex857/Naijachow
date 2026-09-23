# Vercel Deployment

## 1. Rotate credentials

Credentials were previously placed in the tracked `.env.example`. Rotate the Supabase service-role, Supadata, Trigger.dev, and Azure OpenAI keys before deployment. Put replacements in `.env.local`, Vercel Environment Variables, and Trigger.dev Environment Variables.

## 2. Link Supabase

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

Review all files under `supabase/migrations/` before `db push`.

In Supabase Authentication settings:

- Enable email magic links.
- Set the Site URL after the first Vercel deployment.
- Add localhost and Vercel preview URLs to Redirect URLs during development.
- Disable password signup if magic-link-only access is required.

## 3. Configure Trigger.dev

Set `TRIGGER_SECRET_KEY`, `SUPADATA_API_KEY`, Supabase server credentials, and Azure OpenAI credentials in the Trigger.dev environment.

```bash
npm run trigger:dev
npm run trigger:deploy
```

Connect Trigger.dev's GitHub integration after the repository is connected to Vercel.

## 4. Connect Vercel

1. Import `Adetola19/Food-App-3` in Vercel.
2. Select the Vite framework preset.
3. Keep build command `npm run build` and output directory `dist`.
4. Add every variable from `.env.example` with the appropriate environment scope.
5. Deploy once and copy the production URL into `APP_URL` and Supabase Auth settings.

Pushes to `main` will deploy production. Pull requests will receive preview deployments.

## 5. Required checks

Run before deployment:

```bash
npm ci
npm run check
```

`npx vercel build` requires the local repository to be linked with `vercel link` or authenticated through `VERCEL_TOKEN`.

## 6. Deferred integrations

- Bachs monthly subscriptions and webhook verification
- Resend transactional email templates
- A durable global request quota beyond the one-use guest database record
