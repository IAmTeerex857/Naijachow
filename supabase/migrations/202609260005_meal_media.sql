begin;

create table public.meal_media (
  dish_key text primary key,
  meal_name text not null,
  thumbnail_url text not null,
  source_url text not null,
  source_title text not null,
  source_creator text,
  credit text not null,
  source_type text not null check (source_type in ('wikimedia', 'youtube')),
  verified_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.meal_media enable row level security;
revoke all on public.meal_media from anon, authenticated;
create trigger meal_media_touch before update on public.meal_media
for each row execute function public.touch_updated_at();

commit;
