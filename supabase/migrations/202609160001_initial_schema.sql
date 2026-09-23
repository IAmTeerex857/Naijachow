begin;

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;

create type public.plan_status as enum ('pending_claim', 'draft', 'saved', 'archived');
create type public.import_processing_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');
create type public.import_review_status as enum ('not_ready', 'pending', 'approved', 'rejected', 'changes_requested');

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text check (char_length(display_name) <= 100),
  timezone text not null default 'Africa/Lagos',
  locale text not null default 'en-NG',
  onboarding_completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  goal text,
  household_size smallint not null default 1 check (household_size between 1 and 30),
  budget_level text check (budget_level in ('low', 'moderate', 'flexible')),
  max_cooking_minutes smallint check (max_cooking_minutes between 5 and 360),
  preferred_plan_days smallint not null default 3 check (preferred_plan_days between 1 and 30),
  fasting_enabled boolean not null default false,
  fasting_day text check (fasting_day in ('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun')),
  equipment text[] not null default '{}',
  disliked_foods text[] not null default '{}',
  updated_at timestamptz not null default now()
);

comment on table public.user_preferences is 'Non-medical planning preferences owned by one user.';

create table public.health_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  conditions text[] not null default '{}',
  allergies text[] not null default '{}',
  intolerances text[] not null default '{}',
  excluded_foods text[] not null default '{}',
  clinician_instructions text check (char_length(clinician_instructions) <= 1000),
  consented_at timestamptz not null,
  updated_at timestamptz not null default now()
);

comment on table public.health_profiles is 'Sensitive user-supplied constraints. Never include this table in analytics or logs.';

create table public.dishes (
  id text primary key check (id ~ '^[a-z0-9]+$'),
  name text not null,
  category text not null check (category in ('soup', 'swallow', 'carb', 'protein', 'fruit')),
  image_query text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dish_aliases (
  id bigint generated always as identity primary key,
  dish_id text not null references public.dishes(id) on delete cascade,
  alias extensions.citext not null unique,
  locale text not null default 'en-NG'
);

create table public.dish_combos (
  id uuid primary key default gen_random_uuid(),
  canonical_name text not null,
  meal_types text[] not null default '{lunch,dinner}',
  region text,
  approval_status text not null default 'pending' check (approval_status in ('pending', 'approved', 'rejected')),
  confidence numeric(4,3) check (confidence between 0 and 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.dish_combo_components (
  combo_id uuid not null references public.dish_combos(id) on delete cascade,
  dish_id text not null references public.dishes(id),
  position smallint not null check (position > 0),
  primary key (combo_id, dish_id),
  unique (combo_id, position)
);

create table public.combo_evidence (
  id uuid primary key default gen_random_uuid(),
  combo_id uuid not null references public.dish_combos(id) on delete cascade,
  source_type text not null check (source_type in ('editorial', 'recipe', 'tiktok', 'instagram', 'user')),
  source_url text,
  creator_name text,
  excerpt text,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  created_at timestamptz not null default now()
);

create table public.guest_sessions (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  generation_count smallint not null default 0 check (generation_count between 0 and 1),
  planning_context jsonb,
  claimed_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default now() + interval '24 hours',
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

comment on table public.guest_sessions is 'Service-role only. Stores a SHA-256 token hash, never the guest cookie value.';

create table public.meal_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_session_id uuid references public.guest_sessions(id) on delete cascade,
  status public.plan_status not null default 'draft',
  title text not null default 'Meal plan' check (char_length(title) between 1 and 120),
  duration_days smallint not null check (duration_days between 1 and 30),
  selected_dish_ids text[] not null,
  plan_data jsonb not null,
  source text not null check (source in ('azure-openai', 'local')),
  model_deployment text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  saved_at timestamptz,
  check (
    (status = 'pending_claim' and user_id is null and guest_session_id is not null)
    or (status <> 'pending_claim' and user_id is not null and guest_session_id is null)
  )
);

create unique index one_pending_plan_per_guest on public.meal_plans (guest_session_id)
where guest_session_id is not null;
create index meal_plans_user_created_idx on public.meal_plans (user_id, created_at desc);

create table public.generation_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  guest_session_id uuid references public.guest_sessions(id) on delete cascade,
  plan_id uuid references public.meal_plans(id) on delete set null,
  idempotency_key uuid not null unique,
  status text not null check (status in ('reserved', 'completed', 'failed')),
  provider_request_id text,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  check (num_nonnulls(user_id, guest_session_id) = 1)
);

create table public.recipes (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  combo_id uuid references public.dish_combos(id) on delete set null,
  title text not null check (char_length(title) between 1 and 160),
  description text,
  servings smallint check (servings between 1 and 100),
  prep_minutes smallint check (prep_minutes between 0 and 1440),
  cook_minutes smallint check (cook_minutes between 0 and 1440),
  ingredients jsonb not null default '[]',
  steps jsonb not null default '[]',
  dish_ids text[] not null default '{}',
  source_url text,
  source_creator text,
  extraction_confidence numeric(4,3) check (extraction_confidence between 0 and 1),
  status text not null default 'draft' check (status in ('draft', 'needs_review', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.social_imports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source_url text not null,
  canonical_url text not null,
  canonical_url_hash text not null,
  platform text not null check (platform in ('tiktok', 'instagram')),
  external_media_id text,
  processing_status public.import_processing_status not null default 'queued',
  review_status public.import_review_status not null default 'not_ready',
  current_step text,
  generation integer not null default 1,
  trigger_run_id text,
  supadata_job_id text,
  metadata jsonb,
  transcript_text text,
  transcript_chunks jsonb,
  extracted_claims jsonb,
  recipe_id uuid references public.recipes(id) on delete set null,
  error_code text,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (user_id, canonical_url_hash)
);

create table public.social_import_review_events (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.social_imports(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  from_status public.import_review_status not null,
  to_status public.import_review_status not null,
  reason text check (char_length(reason) <= 1000),
  created_at timestamptz not null default now()
);

create table public.assets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete cascade,
  dish_id text references public.dishes(id) on delete set null,
  recipe_id uuid references public.recipes(id) on delete cascade,
  bucket_id text not null,
  object_path text not null,
  visibility text not null default 'private' check (visibility in ('private', 'public')),
  mime_type text,
  byte_size bigint check (byte_size >= 0),
  width integer check (width > 0),
  height integer check (height > 0),
  source_url text,
  source_creator text,
  license text,
  attribution text,
  checksum text,
  review_status text not null default 'pending' check (review_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  unique (bucket_id, object_path)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  provider text not null default 'bachs',
  provider_subscription_id text unique,
  status text not null check (status in ('pending', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start timestamptz,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.touch_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles for each row execute function public.touch_updated_at();
create trigger preferences_touch before update on public.user_preferences for each row execute function public.touch_updated_at();
create trigger health_touch before update on public.health_profiles for each row execute function public.touch_updated_at();
create trigger dishes_touch before update on public.dishes for each row execute function public.touch_updated_at();
create trigger combos_touch before update on public.dish_combos for each row execute function public.touch_updated_at();
create trigger plans_touch before update on public.meal_plans for each row execute function public.touch_updated_at();
create trigger recipes_touch before update on public.recipes for each row execute function public.touch_updated_at();
create trigger imports_touch before update on public.social_imports for each row execute function public.touch_updated_at();
create trigger subscriptions_touch before update on public.subscriptions for each row execute function public.touch_updated_at();

create or replace function public.create_profile_for_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id) values (new.id) on conflict do nothing;
  insert into public.user_preferences (user_id) values (new.id) on conflict do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.create_profile_for_new_user();

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.health_profiles enable row level security;
alter table public.dishes enable row level security;
alter table public.dish_aliases enable row level security;
alter table public.dish_combos enable row level security;
alter table public.dish_combo_components enable row level security;
alter table public.combo_evidence enable row level security;
alter table public.guest_sessions enable row level security;
alter table public.meal_plans enable row level security;
alter table public.generation_jobs enable row level security;
alter table public.recipes enable row level security;
alter table public.social_imports enable row level security;
alter table public.social_import_review_events enable row level security;
alter table public.assets enable row level security;
alter table public.subscriptions enable row level security;

create policy profiles_owner on public.profiles for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy preferences_owner on public.user_preferences for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy health_owner on public.health_profiles for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy dishes_read on public.dishes for select to anon, authenticated using (active);
create policy aliases_read on public.dish_aliases for select to anon, authenticated
using (exists (select 1 from public.dishes d where d.id = dish_id and d.active));
create policy approved_combos_read on public.dish_combos for select to anon, authenticated
using (approval_status = 'approved');
create policy approved_combo_components_read on public.dish_combo_components for select to anon, authenticated
using (exists (select 1 from public.dish_combos c where c.id = combo_id and c.approval_status = 'approved'));
create policy approved_combo_evidence_read on public.combo_evidence for select to anon, authenticated
using (
  visibility = 'public'
  and exists (select 1 from public.dish_combos c where c.id = combo_id and c.approval_status = 'approved')
);
create policy plans_owner on public.meal_plans for all to authenticated
using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy generation_jobs_owner_read on public.generation_jobs for select to authenticated
using (user_id = auth.uid());
create policy recipes_owner on public.recipes for all to authenticated
using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy imports_owner_read on public.social_imports for select to authenticated
using (user_id = auth.uid());
create policy review_events_owner_read on public.social_import_review_events for select to authenticated
using (user_id = auth.uid());
create policy assets_owner_read on public.assets for select to authenticated
using (owner_id = auth.uid() or visibility = 'public');
create policy subscriptions_owner_read on public.subscriptions for select to authenticated
using (user_id = auth.uid());

insert into storage.buckets (id, name, public) values
  ('catalog-assets', 'catalog-assets', true),
  ('user-imports', 'user-imports', false)
on conflict (id) do nothing;

create policy catalog_assets_public_read on storage.objects for select
using (bucket_id = 'catalog-assets');
create policy user_imports_owner_read on storage.objects for select to authenticated
using (bucket_id = 'user-imports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy user_imports_owner_insert on storage.objects for insert to authenticated
with check (bucket_id = 'user-imports' and (storage.foldername(name))[1] = auth.uid()::text);
create policy user_imports_owner_delete on storage.objects for delete to authenticated
using (bucket_id = 'user-imports' and (storage.foldername(name))[1] = auth.uid()::text);

revoke all on public.guest_sessions from anon, authenticated;
revoke insert, update, delete on public.dishes, public.dish_aliases, public.dish_combos,
  public.dish_combo_components, public.combo_evidence from anon, authenticated;
revoke insert, update, delete on public.generation_jobs, public.social_imports,
  public.social_import_review_events, public.assets, public.subscriptions from anon, authenticated;

commit;
