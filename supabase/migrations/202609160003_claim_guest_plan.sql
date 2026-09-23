create or replace function public.claim_guest_plan_for_user(p_token_hash text, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_guest public.guest_sessions;
  v_plan public.meal_plans;
begin
  select * into v_guest
  from public.guest_sessions
  where token_hash = p_token_hash
    and generation_count = 1
    and claimed_by is null
    and expires_at > now()
  for update;

  if not found then raise exception 'No claimable guest session'; end if;

  update public.meal_plans
  set user_id = p_user_id, guest_session_id = null, status = 'draft'
  where guest_session_id = v_guest.id and status = 'pending_claim'
  returning * into v_plan;

  if v_plan.id is null then raise exception 'No claimable plan'; end if;

  update public.guest_sessions
  set claimed_by = p_user_id, claimed_at = now(), planning_context = null
  where id = v_guest.id;

  if v_guest.planning_context is not null then
    insert into public.user_preferences (
      user_id, goal, household_size, budget_level, max_cooking_minutes
    ) values (
      p_user_id,
      v_guest.planning_context->>'goal',
      coalesce((v_guest.planning_context->>'householdSize')::smallint, 1),
      v_guest.planning_context->>'budgetLevel',
      (v_guest.planning_context->>'maxCookingMinutes')::smallint
    )
    on conflict (user_id) do update set
      goal = excluded.goal,
      household_size = excluded.household_size,
      budget_level = excluded.budget_level,
      max_cooking_minutes = excluded.max_cooking_minutes
    where public.user_preferences.goal is null
      and public.user_preferences.budget_level is null
      and public.user_preferences.max_cooking_minutes is null;

    if coalesce((v_guest.planning_context->>'healthConsent')::boolean, false) then
      insert into public.health_profiles (
        user_id, conditions, excluded_foods, clinician_instructions, consented_at
      ) values (
        p_user_id,
        array(select jsonb_array_elements_text(v_guest.planning_context->'conditions')),
        array(
          select value from unnest(
            regexp_split_to_array(coalesce(v_guest.planning_context->>'foodsToAvoid', ''), '\s*,\s*')
          ) as value where btrim(value) <> ''
        ),
        nullif(v_guest.planning_context->>'clinicianInstructions', ''),
        now()
      )
      on conflict (user_id) do nothing;
    end if;
  end if;

  return jsonb_build_object(
    'planId', v_plan.id,
    'plan', v_plan.plan_data,
    'selectedIds', to_jsonb(v_plan.selected_dish_ids)
  );
end;
$$;

revoke all on function public.claim_guest_plan_for_user(text, uuid) from public, anon, authenticated;
grant execute on function public.claim_guest_plan_for_user(text, uuid) to service_role;
