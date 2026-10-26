-- Coach approval lives on the template; the chosen prescription is snapshotted per session.
create table public.workout_alternatives (
  id uuid primary key default gen_random_uuid(),
  workout_item_id uuid not null references public.workout_items(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 300),
  is_cardio boolean not null default false,
  sets smallint not null check (sets between 1 and 20),
  reps text not null default '' check (length(reps) <= 100),
  rest_sec integer not null default 90 check (rest_sec between 0 and 3600),
  notes text not null default '' check (length(notes) <= 1000),
  cardio_time text not null default '' check (length(cardio_time) <= 40),
  cardio_distance_km numeric check (cardio_distance_km > 0),
  cardio_speed_kmh numeric check (cardio_speed_kmh > 0),
  unique (workout_item_id, exercise_id)
);
alter table public.workout_alternatives enable row level security;
revoke all on public.workout_alternatives from anon, authenticated;
grant select, insert, update, delete on public.workout_alternatives to authenticated;
create policy "alternatives read assigned" on public.workout_alternatives for select to authenticated
  using (exists (select 1 from public.workout_items wi where wi.id = workout_item_id));
create policy "alternatives coach insert" on public.workout_alternatives for insert to authenticated with check ((select public.is_coach()));
create policy "alternatives coach update" on public.workout_alternatives for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "alternatives coach delete" on public.workout_alternatives for delete to authenticated using ((select public.is_coach()));

-- Invoker rights: enforce approval and retain unchanged historical snapshots after withdrawal.
create function public.validate_exercise_choices() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare
  before_choices jsonb := '{}'::jsonb;
  after_choices jsonb := coalesce(new.log->'exercise_choices', '{}'::jsonb);
  item_key text; selected jsonb; expected jsonb; wi public.workout_items%rowtype; alt public.workout_alternatives%rowtype;
begin
  if tg_op = 'UPDATE' then before_choices := coalesce(old.log->'exercise_choices', '{}'::jsonb); end if;
  if jsonb_typeof(after_choices) <> 'object' then raise exception 'Exercise choices must be an object'; end if;
  if tg_op = 'UPDATE' and new.workout_id <> old.workout_id and (before_choices <> '{}'::jsonb or after_choices <> '{}'::jsonb) then
    raise exception 'A session with exercise choices cannot change template';
  end if;
  for item_key in select jsonb_object_keys(before_choices || after_choices) loop
    if before_choices->item_key is not distinct from after_choices->item_key then continue; end if;
    if new.status <> 'scheduled' then raise exception 'Only unfinished sessions can change exercise'; end if;
    if tg_op = 'UPDATE' then
      if old.status <> 'scheduled' or exists (select 1 from jsonb_array_elements(coalesce(old.log->'items'->item_key, '[]'::jsonb)) s where s->>'done' = 'true') then
        raise exception 'This exercise already has completed sets';
      end if;
    end if;
    select * into wi from public.workout_items where id::text = item_key and workout_id = new.workout_id;
    if not found then raise exception 'Exercise is not in this workout'; end if;
    if exists (select 1 from jsonb_array_elements(coalesce(new.log->'items'->item_key, '[]'::jsonb)) s where s->>'done' = 'true') then
      raise exception 'Switch exercise before completing sets';
    end if;
    selected := after_choices->item_key;
    if selected is null then continue; end if; -- restore the original exercise
    select * into alt from public.workout_alternatives where id::text = selected->>'alternative_id' and workout_item_id = wi.id;
    if not found then raise exception 'This alternative is no longer approved'; end if;
    expected := jsonb_build_object('alternative_id', alt.id, 'is_cardio', alt.is_cardio, 'item',
      to_jsonb(wi) || jsonb_build_object('exercise_id', alt.exercise_id, 'exercise_name', alt.exercise_name,
        'sets', alt.sets, 'reps', alt.reps, 'rest_sec', alt.rest_sec, 'notes', alt.notes,
        'weight', '', 'percent_1rm', null, 'load', '', 'tempo', '', 'cardio_time', alt.cardio_time,
        'cardio_distance_km', alt.cardio_distance_km, 'cardio_speed_kmh', alt.cardio_speed_kmh));
    if selected <> expected then raise exception 'The alternative prescription changed. Reload before switching'; end if;
  end loop;
  return new;
end $$;
revoke all on function public.validate_exercise_choices() from public, anon, authenticated;
create trigger validate_session_exercise_choices before insert or update of log, workout_id, status on public.client_workouts
  for each row execute function public.validate_exercise_choices();

-- New technique clips use the actual session exercise, including preserved snapshots.
drop policy "exercise videos submit own" on public.exercise_videos;
create policy "exercise videos submit own" on public.exercise_videos for insert to authenticated
  with check (client_id = (select auth.uid()) and exists (
    select 1 from public.client_workouts cw where cw.id = client_workout_id and cw.client_id = (select auth.uid())
    and coalesce(cw.log->'exercise_choices'->(workout_item_id::text)->'item'->>'exercise_name',
      (select wi.exercise_name from public.workout_items wi where wi.id = workout_item_id and wi.workout_id = cw.workout_id)) = exercise_videos.exercise_name
  ));
