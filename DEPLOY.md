# Vercel Deployment

## 1. Rotate credentials

Credentials were previously placed in the tracked `.env.example`. Rotate the Supabase service-role, Supadata, and Azure OpenAI keys before deployment. Put replacements in `.env.local` and Vercel Environment Variables.

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

## 3. Connect Vercel

1. Import `IAmTeerex857/Naijachow` in Vercel.
2. Select the Vite framework preset.
3. Keep build command `npm run build` and output directory `dist`.
4. Add every variable from `.env.example` with the appropriate environment scope.
5. Deploy once and copy the production URL into `APP_URL` and Supabase Auth settings.

Set `APP_URL=https://www.naijachow.xyz`, add the live `BACHS_SECRET_KEY` and `BACHS_WEBHOOK_SECRET`, then register `https://www.naijachow.xyz/api/bachs-webhook` for `collection.succeeded`. Apply and review the payment migration before enabling checkout.

Pushes to `main` will deploy production. Pull requests will receive preview deployments.

## 4. Required checks

Run before deployment:

```bash
npm ci
npm run check
```

`npx vercel build` requires the local repository to be linked with `vercel link` or authenticated through `VERCEL_TOKEN`.

## 5. Required external setup

- Verify `naijachow.xyz` in Resend for `hello@naijachow.xyz`.
- Turnstile is optional while the user base is small; durable guest quotas remain active without it.
- Confirm the `naijachow-operational-retention` Supabase Cron job after applying migrations.
