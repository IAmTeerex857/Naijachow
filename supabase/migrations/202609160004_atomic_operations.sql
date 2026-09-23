alter table public.recipes
add column source_import_id uuid unique references public.social_imports(id) on delete cascade;

alter table public.dish_combos
add column source_recipe_id uuid unique references public.recipes(id) on delete cascade;

create or replace function public.persist_generated_plan(
  p_user_id uuid,
  p_guest_session_id uuid,
  p_duration_days smallint,
  p_selected_dish_ids text[],
  p_plan_data jsonb,
  p_model_deployment text,
  p_planning_context jsonb,
  p_idempotency_key uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plan_id uuid;
begin
  if num_nonnulls(p_user_id, p_guest_session_id) <> 1 then
    raise exception 'Exactly one owner is required';
  end if;

  if p_guest_session_id is not null then
    update public.guest_sessions
    set planning_context = p_planning_context
    where id = p_guest_session_id
      and generation_count = 1
      and claimed_by is null
      and expires_at > now();
    if not found then raise exception 'Guest reservation is invalid'; end if;
  end if;

  insert into public.meal_plans (
    user_id, guest_session_id, status, duration_days, selected_dish_ids,
    plan_data, source, model_deployment
  ) values (
    p_user_id,
    p_guest_session_id,
    case when p_user_id is null then 'pending_claim'::public.plan_status else 'draft'::public.plan_status end,
    p_duration_days,
    p_selected_dish_ids,
    p_plan_data,
    'azure-openai',
    p_model_deployment
  ) returning id into v_plan_id;

  insert into public.generation_jobs (
    user_id, guest_session_id, plan_id, idempotency_key, status, completed_at
  ) values (
    p_user_id, p_guest_session_id, v_plan_id, p_idempotency_key, 'completed', now()
  );

  return v_plan_id;
end;
$$;

create or replace function public.review_social_import(
  p_import_id uuid,
  p_user_id uuid,
  p_review_status public.import_review_status,
  p_recipe_status text,
  p_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_import public.social_imports;
  v_recipe public.recipes;
  v_combo_id uuid;
begin
  select * into v_import
  from public.social_imports
  where id = p_import_id and user_id = p_user_id
  for update;

  if not found then raise exception 'Import not found'; end if;
  if v_import.processing_status <> 'succeeded' then raise exception 'Import is not ready'; end if;
  if p_recipe_status not in ('approved', 'rejected', 'needs_review') then raise exception 'Invalid recipe status'; end if;

  update public.recipes
  set status = p_recipe_status
  where id = v_import.recipe_id and owner_id = p_user_id;
  if not found then raise exception 'Recipe not found'; end if;
  select * into v_recipe from public.recipes where id = v_import.recipe_id;

  update public.social_imports set review_status = p_review_status where id = p_import_id;
  insert into public.social_import_review_events (
    import_id, user_id, from_status, to_status, reason
  ) values (
    p_import_id, p_user_id, v_import.review_status, p_review_status, left(p_reason, 1000)
  );

  if p_review_status = 'approved' and cardinality(v_recipe.dish_ids) >= 2 then
    insert into public.dish_combos (
      canonical_name, approval_status, confidence, source_recipe_id
    ) values (
      v_recipe.title, 'pending', v_recipe.extraction_confidence, v_recipe.id
    )
    on conflict (source_recipe_id) do update set
      canonical_name = excluded.canonical_name,
      confidence = excluded.confidence
    returning id into v_combo_id;

    delete from public.dish_combo_components where combo_id = v_combo_id;
    insert into public.dish_combo_components (combo_id, dish_id, position)
    select v_combo_id, item, ordinal::smallint
    from unnest(v_recipe.dish_ids) with ordinality as dish(item, ordinal)
    where exists (select 1 from public.dishes where id = item);

    if not exists (select 1 from public.combo_evidence where combo_id = v_combo_id and source_type = 'recipe') then
      insert into public.combo_evidence (
        combo_id, source_type, source_url, creator_name, excerpt, visibility
      ) values (
        v_combo_id, 'recipe', v_recipe.source_url, v_recipe.source_creator,
        left(v_recipe.description, 500), 'private'
      );
    end if;
  end if;
end;
$$;

revoke all on function public.persist_generated_plan(uuid, uuid, smallint, text[], jsonb, text, jsonb, uuid) from public, anon, authenticated;
revoke all on function public.review_social_import(uuid, uuid, public.import_review_status, text, text) from public, anon, authenticated;
grant execute on function public.persist_generated_plan(uuid, uuid, smallint, text[], jsonb, text, jsonb, uuid) to service_role;
grant execute on function public.review_social_import(uuid, uuid, public.import_review_status, text, text) to service_role;
