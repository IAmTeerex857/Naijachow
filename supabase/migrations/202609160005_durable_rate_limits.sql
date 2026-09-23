create table public.api_rate_limits (
  key text primary key,
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on public.api_rate_limits from anon, authenticated;

create or replace function public.consume_api_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.api_rate_limits;
begin
  if p_limit < 1 or p_window_seconds < 1 then raise exception 'Invalid rate limit'; end if;

  select * into v_row from public.api_rate_limits where key = p_key for update;
  if not found then
    insert into public.api_rate_limits (key, window_started_at, request_count)
    values (p_key, now(), 1);
    return true;
  end if;

  if v_row.window_started_at + make_interval(secs => p_window_seconds) <= now() then
    update public.api_rate_limits
    set window_started_at = now(), request_count = 1, updated_at = now()
    where key = p_key;
    return true;
  end if;

  if v_row.request_count >= p_limit then return false; end if;
  update public.api_rate_limits
  set request_count = request_count + 1, updated_at = now()
  where key = p_key;
  return true;
end;
$$;

revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;

create or replace function public.release_api_rate_limit(p_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.api_rate_limits
  set request_count = greatest(request_count - 1, 0), updated_at = now()
  where key = p_key;
end;
$$;

revoke all on function public.release_api_rate_limit(text) from public, anon, authenticated;
grant execute on function public.release_api_rate_limit(text) to service_role;
