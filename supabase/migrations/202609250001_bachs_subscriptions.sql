begin;

alter table public.subscriptions add column if not exists checkout_id text;
alter table public.subscriptions add column if not exists checkout_reference text;
alter table public.subscriptions add column if not exists checkout_url text;
alter table public.subscriptions add column if not exists checkout_expires_at timestamptz;
alter table public.subscriptions add column if not exists checkout_state text;
alter table public.subscriptions add column if not exists customer_id text;
alter table public.subscriptions add column if not exists product_id text;
alter table public.subscriptions add column if not exists amount numeric(12,2);
alter table public.subscriptions add column if not exists currency text;
alter table public.subscriptions add column if not exists provider_status text;
alter table public.subscriptions add column if not exists cancel_at_period_end boolean not null default false;
alter table public.subscriptions add column if not exists latest_event_id text;
alter table public.subscriptions add column if not exists latest_event_created_at timestamptz;
alter table public.subscriptions add column if not exists latest_event_rank integer;

create unique index if not exists subscriptions_checkout_id_key
on public.subscriptions (checkout_id) where checkout_id is not null;
create unique index if not exists subscriptions_checkout_reference_key
on public.subscriptions (checkout_reference) where checkout_reference is not null;
create unique index if not exists subscriptions_one_open_checkout_per_user
on public.subscriptions (user_id) where provider = 'bachs' and checkout_state in ('reserved', 'open');

create table if not exists public.bachs_deleted_customers (
  user_id uuid primary key,
  deleted_at timestamptz not null default now()
);

create table if not exists public.subscription_webhook_events (
  event_id text primary key,
  event_type text not null,
  event_created_at timestamptz not null,
  payload jsonb not null,
  valid_product boolean not null,
  processed_at timestamptz not null default now()
);

alter table public.subscription_webhook_events enable row level security;
alter table public.bachs_deleted_customers enable row level security;
revoke all on public.subscription_webhook_events from public, anon, authenticated;
revoke all on public.bachs_deleted_customers from public, anon, authenticated;

create or replace function public.reserve_bachs_checkout(
  p_user_id uuid, p_product_id text, p_amount numeric, p_currency text
)
returns public.subscriptions
language plpgsql
security definer
set search_path = public
as $$
declare
  v_reservation public.subscriptions;
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  if exists (select 1 from public.bachs_deleted_customers where user_id = p_user_id) then
    raise exception 'Account deletion is in progress';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'User not found';
  end if;
  if exists (
    select 1 from public.subscriptions
    where user_id = p_user_id and provider = 'bachs'
      and provider_status in ('trialing', 'active')
      and current_period_end is not null and current_period_end > now()
  ) then
    raise exception 'Premium subscription is already active';
  end if;

  update public.subscriptions set status = 'expired', checkout_state = 'expired'
  where user_id = p_user_id and provider = 'bachs' and checkout_state in ('reserved', 'open')
    and (
      (checkout_expires_at is not null and checkout_expires_at <= now())
      or (checkout_state = 'reserved' and created_at <= now() - interval '24 hours')
    );

  select * into v_reservation from public.subscriptions
  where user_id = p_user_id and provider = 'bachs' and checkout_state in ('reserved', 'open')
  order by created_at desc limit 1;
  if v_reservation.id is not null then return v_reservation; end if;

  insert into public.subscriptions (
    user_id, provider, status, provider_status, product_id, amount, currency,
    checkout_reference, checkout_state
  ) values (
    p_user_id, 'bachs', 'pending', 'pending', p_product_id,
    p_amount, p_currency, 'premium_' || p_user_id::text || '_' || gen_random_uuid()::text, 'reserved'
  ) returning * into v_reservation;
  return v_reservation;
end;
$$;

create or replace function public.finalize_bachs_checkout(
  p_user_id uuid, p_reference text, p_checkout_id text, p_checkout_url text, p_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.subscriptions set
    checkout_id = p_checkout_id,
    checkout_url = p_checkout_url,
    checkout_expires_at = p_expires_at,
    checkout_state = 'open'
  where user_id = p_user_id and provider = 'bachs' and checkout_reference = p_reference
    and checkout_state in ('reserved', 'open');
  return found;
end;
$$;

create or replace function public.fail_bachs_checkout(p_user_id uuid, p_reference text)
returns void
language sql
security definer
set search_path = public
as $$
  update public.subscriptions set status = 'expired', checkout_state = 'failed'
  where user_id = p_user_id and provider = 'bachs' and checkout_reference = p_reference
    and checkout_state = 'reserved' and checkout_id is null;
$$;

create or replace function public.begin_bachs_account_deletion(p_user_id uuid)
returns table (provider_subscription_id text)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  insert into public.bachs_deleted_customers (user_id) values (p_user_id)
  on conflict (user_id) do nothing;
  update public.subscriptions set status = 'expired', checkout_state = 'failed'
  where user_id = p_user_id and provider = 'bachs' and checkout_state in ('reserved', 'open');
  return query select s.provider_subscription_id from public.subscriptions s
  where s.user_id = p_user_id and s.provider = 'bachs'
    and s.provider_subscription_id is not null
    and s.provider_status in ('trialing', 'active', 'past_due', 'unpaid', 'paused');
end;
$$;

create or replace function public.abort_bachs_account_deletion(p_user_id uuid)
returns void language sql security definer set search_path = public as $$
  delete from public.bachs_deleted_customers where user_id = p_user_id;
$$;

create or replace function public.reconcile_bachs_subscription(
  p_event_id text,
  p_event_type text,
  p_event_created_at timestamptz,
  p_payload jsonb,
  p_user_id uuid,
  p_checkout_id text,
  p_subscription_id text,
  p_customer_id text,
  p_product_id text,
  p_amount numeric,
  p_currency text,
  p_provider_status text,
  p_period_start timestamptz,
  p_period_end timestamptz,
  p_cancel_at_period_end boolean,
  p_event_rank integer,
  p_deleted_cancelled boolean,
  p_valid_product boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := p_user_id;
  v_status text;
  v_existing public.subscriptions;
  v_user_exists boolean;
begin
  if not p_valid_product then return 'ignored_invalid_product'; end if;
  if p_event_type not in (
    'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'
  ) then return 'ignored_event'; end if;

  if exists (select 1 from public.subscription_webhook_events where event_id = p_event_id) then
    return 'duplicate';
  end if;

  select * into v_existing from public.subscriptions
  where provider = 'bachs' and provider_subscription_id = p_subscription_id;

  if v_existing.id is null and p_checkout_id is not null then
    select * into v_existing from public.subscriptions
    where provider = 'bachs' and checkout_id = p_checkout_id;
  end if;

  if v_user_id is null then v_user_id := v_existing.user_id; end if;
  if v_user_id is null and p_checkout_id is not null then
    select user_id into v_user_id from public.subscriptions
    where provider = 'bachs' and checkout_id = p_checkout_id
    order by created_at desc limit 1;
  end if;
  if v_user_id is null then return 'ignored_missing_user'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user_id::text, 0));
  select * into v_existing from public.subscriptions
  where provider = 'bachs' and provider_subscription_id = p_subscription_id
  for update;
  if v_existing.id is null and p_checkout_id is not null then
    select * into v_existing from public.subscriptions
    where provider = 'bachs' and checkout_id = p_checkout_id
    for update;
  end if;
  if v_existing.id is not null and v_existing.user_id <> v_user_id then return 'ignored_user_mismatch'; end if;

  select exists (select 1 from auth.users where id = v_user_id) into v_user_exists;
  if exists (select 1 from public.bachs_deleted_customers where user_id = v_user_id) or not v_user_exists then
    if not p_deleted_cancelled then return 'cancel_orphan'; end if;
    insert into public.subscription_webhook_events (
      event_id, event_type, event_created_at, payload, valid_product
    ) values (p_event_id, p_event_type, p_event_created_at, p_payload, true)
    on conflict (event_id) do nothing;
    if not found then return 'duplicate'; end if;
    return 'cancelled_orphan';
  end if;

  insert into public.subscription_webhook_events (
    event_id, event_type, event_created_at, payload, valid_product
  ) values (p_event_id, p_event_type, p_event_created_at, p_payload, true)
  on conflict (event_id) do nothing;
  if not found then return 'duplicate'; end if;

  -- For equal provider timestamps, prefer the more restrictive status; use the
  -- event ID only to make otherwise equal deliveries deterministic.
  if v_existing.latest_event_created_at is not null and (
    v_existing.latest_event_created_at > p_event_created_at
    or (
      v_existing.latest_event_created_at = p_event_created_at
      and coalesce(v_existing.latest_event_rank, 0) > p_event_rank
    )
    or (
      v_existing.latest_event_created_at = p_event_created_at
      and coalesce(v_existing.latest_event_rank, 0) = p_event_rank
      and coalesce(v_existing.latest_event_id, '') >= p_event_id
    )
  ) then return 'ignored_stale_event'; end if;

  v_status := case
    when p_provider_status in ('trialing', 'active') then 'active'
    when p_provider_status in ('past_due', 'unpaid') then 'past_due'
    when p_provider_status = 'canceled' then 'cancelled'
    else 'expired'
  end;

  if v_existing.id is not null then
    update public.subscriptions set
      provider_subscription_id = p_subscription_id,
      checkout_id = coalesce(p_checkout_id, checkout_id),
      customer_id = p_customer_id,
      product_id = p_product_id,
      amount = p_amount,
      currency = p_currency,
      provider_status = p_provider_status,
      status = v_status,
      checkout_state = 'completed',
      current_period_start = p_period_start,
      current_period_end = p_period_end,
      cancel_at_period_end = p_cancel_at_period_end,
      latest_event_id = p_event_id,
      latest_event_created_at = p_event_created_at,
      latest_event_rank = p_event_rank
    where id = v_existing.id;
  else
    insert into public.subscriptions (
      user_id, provider, provider_subscription_id, checkout_id, customer_id,
      product_id, amount, currency, provider_status, status, checkout_state, current_period_start,
      current_period_end, cancel_at_period_end, latest_event_id, latest_event_created_at,
      latest_event_rank
    ) values (
      v_user_id, 'bachs', p_subscription_id, p_checkout_id, p_customer_id,
      p_product_id, p_amount, p_currency, p_provider_status, v_status, 'completed', p_period_start,
      p_period_end, p_cancel_at_period_end, p_event_id, p_event_created_at, p_event_rank
    );
  end if;
  return 'processed';
end;
$$;

revoke all on function public.reserve_bachs_checkout(uuid, text, numeric, text) from public, anon, authenticated;
revoke all on function public.finalize_bachs_checkout(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.fail_bachs_checkout(uuid, text) from public, anon, authenticated;
revoke all on function public.begin_bachs_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.abort_bachs_account_deletion(uuid) from public, anon, authenticated;
revoke all on function public.reconcile_bachs_subscription(text, text, timestamptz, jsonb, uuid, text, text, text, text, numeric, text, text, timestamptz, timestamptz, boolean, integer, boolean, boolean) from public, anon, authenticated;
grant execute on function public.reserve_bachs_checkout(uuid, text, numeric, text) to service_role;
grant execute on function public.finalize_bachs_checkout(uuid, text, text, text, timestamptz) to service_role;
grant execute on function public.fail_bachs_checkout(uuid, text) to service_role;
grant execute on function public.begin_bachs_account_deletion(uuid) to service_role;
grant execute on function public.abort_bachs_account_deletion(uuid) to service_role;
grant execute on function public.reconcile_bachs_subscription(text, text, timestamptz, jsonb, uuid, text, text, text, text, numeric, text, text, timestamptz, timestamptz, boolean, integer, boolean, boolean) to service_role;

commit;
