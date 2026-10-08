alter table public.meal_media add column if not exists credit text;
alter table public.meal_media add column if not exists source_type text;

update public.meal_media
set credit = coalesce('Tutorial preview by ' || source_creator, 'Tutorial preview'),
    source_type = 'youtube'
where credit is null or source_type is null;

alter table public.meal_media alter column credit set not null;
alter table public.meal_media alter column source_type set not null;
