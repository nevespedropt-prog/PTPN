-- v41: the coach can tick, untick and set the numbers on a client's habit days, past or present.
-- A client still logs their own habits only; a coach entry must belong to that client's own habit. Re-runnable.
drop policy if exists "hlogs insert own" on public.habit_logs;
drop policy if exists "hlogs update own" on public.habit_logs;
drop policy if exists "hlogs delete own" on public.habit_logs;
drop policy if exists "hlogs insert own or coach" on public.habit_logs;
drop policy if exists "hlogs update own or coach" on public.habit_logs;
drop policy if exists "hlogs delete own or coach" on public.habit_logs;
create policy "hlogs insert own or coach" on public.habit_logs for insert with check (
  (client_id = (select auth.uid()) and exists (select 1 from public.habits h where h.id = habit_id and h.client_id = (select auth.uid())))
  or ((select public.is_coach()) and exists (select 1 from public.habits h where h.id = habit_id and h.client_id = habit_logs.client_id)));
create policy "hlogs update own or coach" on public.habit_logs for update
  using (client_id = (select auth.uid()) or (select public.is_coach()))
  with check (
    (client_id = (select auth.uid()) and exists (select 1 from public.habits h where h.id = habit_id and h.client_id = (select auth.uid())))
    or ((select public.is_coach()) and exists (select 1 from public.habits h where h.id = habit_id and h.client_id = habit_logs.client_id)));
create policy "hlogs delete own or coach" on public.habit_logs for delete using (client_id = (select auth.uid()) or (select public.is_coach()));
