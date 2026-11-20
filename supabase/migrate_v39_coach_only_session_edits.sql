-- v39: only the coach edits assigned sessions.
-- A client keeps full control of workouts they built themselves, and can still log sets and finish an assigned workout.
-- They can no longer move, re-assign, delete or mark as skipped a session their coach gave them, or reopen a finished one,
-- and can no longer schedule a workout they did not build. They talk to the coach, who edits it.
-- Re-runnable.
create or replace function public.guard_client_workout_changes()
returns trigger language plpgsql security definer set search_path = public as $$
declare personal boolean;
begin
  -- The coach, and server-side work (not running as the signed-in API role), are not restricted.
  if auth.uid() is null or current_setting('role', true) is distinct from 'authenticated' or public.is_coach() then return coalesce(new, old); end if;
  select (w.created_by = old.client_id) into personal from public.workouts w where w.id = old.workout_id;
  if coalesce(personal, false) then return coalesce(new, old); end if;
  if tg_op = 'DELETE' then
    raise exception 'Only your coach can remove an assigned session. Message your coach.';
  end if;
  if new.date <> old.date or new.workout_id <> old.workout_id or new.client_id <> old.client_id or new.program_id is distinct from old.program_id then
    raise exception 'Only your coach can move or change an assigned session. Message your coach.';
  end if;
  if new.status <> old.status and not (old.status = 'scheduled' and new.status = 'done') then
    raise exception 'Only your coach can change the status of an assigned session. Message your coach.';
  end if;
  if old.status <> 'scheduled' and (new.log is distinct from old.log or new.rating is distinct from old.rating
      or new.client_note is distinct from old.client_note or new.completed_at is distinct from old.completed_at) then
    raise exception 'This session is finished. Message your coach to change it.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_client_workout_changes() from public, anon, authenticated;

drop trigger if exists guard_client_workout_changes on public.client_workouts;
create trigger guard_client_workout_changes before update or delete on public.client_workouts
  for each row execute function public.guard_client_workout_changes();

-- Reads workouts as the owner, so this rule does not loop through the workouts read rule.
create or replace function public.i_built_workout(wid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.workouts w where w.id = wid and w.created_by = auth.uid()) $$;
revoke execute on function public.i_built_workout(uuid) from public, anon;
grant execute on function public.i_built_workout(uuid) to authenticated;

drop policy if exists "cw insert" on public.client_workouts;
create policy "cw insert" on public.client_workouts for insert
  with check ((select public.is_coach()) or (client_id = (select auth.uid()) and (select public.i_built_workout(workout_id))));
