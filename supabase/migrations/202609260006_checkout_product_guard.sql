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
    raise exception 'Premium access is already active';
  end if;

  update public.subscriptions set status = 'expired', checkout_state = 'expired'
  where user_id = p_user_id and provider = 'bachs' and checkout_state in ('reserved', 'open')
    and (
      product_id is distinct from p_product_id
      or amount is distinct from p_amount
      or currency is distinct from p_currency
      or (checkout_expires_at is not null and checkout_expires_at <= now())
      or (checkout_state = 'reserved' and created_at <= now() - interval '24 hours')
    );

  select * into v_reservation from public.subscriptions
  where user_id = p_user_id and provider = 'bachs' and checkout_state in ('reserved', 'open')
    and product_id = p_product_id and amount = p_amount and currency = p_currency
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

revoke all on function public.reserve_bachs_checkout(uuid, text, numeric, text) from public, anon, authenticated;
grant execute on function public.reserve_bachs_checkout(uuid, text, numeric, text) to service_role;
