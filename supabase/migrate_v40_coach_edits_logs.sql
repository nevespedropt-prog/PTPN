-- v40: the coach can add, change and delete a client's food diary entries and check-ins (daily and weekly).
-- Clients keep what they had: they manage their own food logs and daily check-ins; a weekly check-in stays final for them.
-- One rule per action (no duplicate permissive rules). Re-runnable.
drop policy if exists "food logs insert own" on public.food_logs;
drop policy if exists "food logs update own" on public.food_logs;
drop policy if exists "food logs delete own" on public.food_logs;
drop policy if exists "food logs insert own or coach" on public.food_logs;
drop policy if exists "food logs update own or coach" on public.food_logs;
drop policy if exists "food logs delete own or coach" on public.food_logs;
create policy "food logs insert own or coach" on public.food_logs for insert with check (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "food logs update own or coach" on public.food_logs for update
  using (client_id = (select auth.uid()) or (select public.is_coach())) with check (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "food logs delete own or coach" on public.food_logs for delete using (client_id = (select auth.uid()) or (select public.is_coach()));

drop policy if exists "checkins insert own" on public.checkins;
drop policy if exists "checkins update own" on public.checkins;
drop policy if exists "checkins insert own or coach" on public.checkins;
drop policy if exists "checkins update own or coach" on public.checkins;
drop policy if exists "checkins delete coach" on public.checkins;
create policy "checkins insert own or coach" on public.checkins for insert with check (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "checkins update own or coach" on public.checkins for update
  using (client_id = (select auth.uid()) or (select public.is_coach())) with check (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "checkins delete coach" on public.checkins for delete using ((select public.is_coach()));
grant delete on public.checkins to authenticated;

grant update, delete on public.weekly_checkins to authenticated;
drop policy if exists "weekly checkins submit own" on public.weekly_checkins;
drop policy if exists "weekly checkins insert own or coach" on public.weekly_checkins;
drop policy if exists "weekly checkins update coach" on public.weekly_checkins;
drop policy if exists "weekly checkins delete coach" on public.weekly_checkins;
create policy "weekly checkins insert own or coach" on public.weekly_checkins for insert to authenticated
  with check ((client_id = (select auth.uid()) and not (select public.is_coach())) or (select public.is_coach()));
create policy "weekly checkins update coach" on public.weekly_checkins for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "weekly checkins delete coach" on public.weekly_checkins for delete to authenticated using ((select public.is_coach()));
