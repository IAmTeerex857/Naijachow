begin;

create table public.meal_guides (
  dish_key text primary key,
  meal_name text not null,
  recipe_data jsonb not null,
  source_url text not null,
  source_title text not null,
  source_creator text,
  source_platform text not null check (source_platform in ('youtube', 'tiktok', 'instagram', 'web')),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meal_guides enable row level security;
revoke all on public.meal_guides from anon, authenticated;
create trigger meal_guides_touch before update on public.meal_guides
for each row execute function public.touch_updated_at();

update storage.buckets set public = false where id = 'catalog-assets';
drop policy if exists catalog_assets_public_read on storage.objects;

create or replace function public.purge_expired_operational_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.api_rate_limits where window_started_at < now() - interval '35 days';
  delete from public.guest_sessions where expires_at < now() - interval '7 days';
  delete from public.generation_jobs where created_at < now() - interval '90 days';
  delete from public.subscription_webhook_events where processed_at < now() - interval '180 days';
end;
$$;
revoke all on function public.purge_expired_operational_data() from public, anon, authenticated;
grant execute on function public.purge_expired_operational_data() to service_role;

commit;
