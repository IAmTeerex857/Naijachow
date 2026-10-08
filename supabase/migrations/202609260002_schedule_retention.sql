begin;

create extension if not exists pg_cron with schema extensions;

create or replace function public.purge_expired_operational_data()
returns void language plpgsql security definer set search_path = public as $$
begin
  delete from public.api_rate_limits where window_started_at < now() - interval '35 days';
  delete from public.guest_sessions where expires_at < now() - interval '7 days';
  delete from public.generation_jobs where created_at < now() - interval '90 days';
  delete from public.subscription_webhook_events where processed_at < now() - interval '180 days';
  delete from public.bachs_deleted_customers where deleted_at < now() - interval '180 days';
end;
$$;
revoke all on function public.purge_expired_operational_data() from public, anon, authenticated;
grant execute on function public.purge_expired_operational_data() to service_role;

do $$
begin
  if not exists (select 1 from cron.job where jobname = 'naijachow-operational-retention') then
    perform cron.schedule(
      'naijachow-operational-retention',
      '17 3 * * *',
      'select public.purge_expired_operational_data();'
    );
  end if;
end;
$$;

commit;
