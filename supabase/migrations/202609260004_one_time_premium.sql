begin;

create or replace function public.reconcile_bachs_payment(
  p_event_id text,
  p_event_created_at timestamptz,
  p_payload jsonb,
  p_user_id uuid,
  p_checkout_id text,
  p_reference text,
  p_customer_id text,
  p_amount numeric,
  p_currency text,
  p_valid_payment boolean
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_purchase public.subscriptions;
begin
  if not p_valid_payment then return 'ignored_invalid_payment'; end if;
  if exists (select 1 from public.subscription_webhook_events where event_id = p_event_id) then
    return 'duplicate';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  select * into v_purchase from public.subscriptions
  where provider = 'bachs'
    and user_id = p_user_id
    and checkout_id = p_checkout_id
    and checkout_reference = p_reference
  for update;

  if v_purchase.id is null then return 'ignored_missing_checkout'; end if;
  if exists (select 1 from public.bachs_deleted_customers where user_id = p_user_id)
     or not exists (select 1 from auth.users where id = p_user_id) then
    insert into public.subscription_webhook_events (
      event_id, event_type, event_created_at, payload, valid_product
    ) values (p_event_id, 'collection.succeeded', p_event_created_at, p_payload, true)
    on conflict (event_id) do nothing;
    return 'ignored_deleted_user';
  end if;

  insert into public.subscription_webhook_events (
    event_id, event_type, event_created_at, payload, valid_product
  ) values (p_event_id, 'collection.succeeded', p_event_created_at, p_payload, true)
  on conflict (event_id) do nothing;
  if not found then return 'duplicate'; end if;

  update public.subscriptions set
    customer_id = p_customer_id,
    product_id = 'naijachow_premium_30_day',
    amount = p_amount,
    currency = p_currency,
    provider_status = 'active',
    status = 'active',
    checkout_state = 'completed',
    current_period_start = p_event_created_at,
    current_period_end = p_event_created_at + interval '30 days',
    cancel_at_period_end = false,
    latest_event_id = p_event_id,
    latest_event_created_at = p_event_created_at,
    latest_event_rank = 100
  where id = v_purchase.id;

  return 'processed';
end;
$$;

revoke all on function public.reconcile_bachs_payment(text, timestamptz, jsonb, uuid, text, text, text, numeric, text, boolean) from public, anon, authenticated;
grant execute on function public.reconcile_bachs_payment(text, timestamptz, jsonb, uuid, text, text, text, numeric, text, boolean) to service_role;

commit;
