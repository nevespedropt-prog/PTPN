-- v34: speed. Several tables had two permissive row-level-security policies that both applied to the
-- same action, so the database evaluated both on every query. Behaviour does not change: for each
-- action the allowed rows are exactly the same as before.
--
-- 1. "<table> coach write" (and "items write") were FOR ALL policies, so they also applied to SELECT
--    next to the table's read policy. Every read policy already lets the coach read (or is open to any
--    signed-in user, which the coach always is), so the coach SELECT part added nothing. Each FOR ALL
--    policy is replaced by separate INSERT, UPDATE and DELETE policies with the same conditions.
-- 2. Pairs of policies for the same single action (bookings and measurements insert, profiles update,
--    fitness assessment items read) are merged into one policy that ORs the same conditions.
--
-- Safe to run twice. To undo, recreate the FOR ALL policies from schema.sql and drop the new ones.
do $$
declare
  p record;
  base text;
  roles text;
begin
  for p in
    select * from pg_policies
    where schemaname = 'public' and cmd = 'ALL' and permissive = 'PERMISSIVE'
      and tablename in ('challenges', 'client_packages', 'habits', 'meal_plan_items', 'meal_plan_template_items',
        'meal_plan_templates', 'metrics', 'nutrition_targets', 'payments', 'posts', 'program_days', 'programs',
        'recipes', 'resources', 'sessions', 'workout_items')
  loop
    base := regexp_replace(p.policyname, 'write$', '');
    select string_agg(quote_ident(r), ', ') into roles from unnest(p.roles) r;
    execute format('drop policy if exists %I on public.%I', base || 'insert', p.tablename);
    execute format('drop policy if exists %I on public.%I', base || 'update', p.tablename);
    execute format('drop policy if exists %I on public.%I', base || 'delete', p.tablename);
    execute format('create policy %I on public.%I for insert to %s with check (%s)', base || 'insert', p.tablename, roles, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for update to %s using (%s) with check (%s)', base || 'update', p.tablename, roles, p.qual, coalesce(p.with_check, p.qual));
    execute format('create policy %I on public.%I for delete to %s using (%s)', base || 'delete', p.tablename, roles, p.qual);
    execute format('drop policy %I on public.%I', p.policyname, p.tablename);
  end loop;
end $$;

-- bookings and measurements: a client adds their own rows, the coach adds anyone's
drop policy if exists "bookings coach insert" on public.bookings;
drop policy if exists "bookings insert own" on public.bookings;
drop policy if exists "bookings insert own or coach" on public.bookings;
create policy "bookings insert own or coach" on public.bookings for insert to public
  with check ((client_id = (select auth.uid())) or (select public.is_coach()));

drop policy if exists "meas coach insert" on public.measurements;
drop policy if exists "meas insert own" on public.measurements;
drop policy if exists "meas insert own or coach" on public.measurements;
create policy "meas insert own or coach" on public.measurements for insert to public
  with check ((client_id = (select auth.uid())) or (select public.is_coach()));

-- profiles: a user updates their own profile (role cannot change), the coach updates any profile
drop policy if exists "profiles coach update" on public.profiles;
drop policy if exists "profiles update own" on public.profiles;
drop policy if exists "profiles update own or coach" on public.profiles;
create policy "profiles update own or coach" on public.profiles for update to public
  using ((id = (select auth.uid())) or public.is_coach())
  with check (
    public.is_coach()
    or ((id = (select auth.uid())) and (role = (select p.role from public.profiles p where p.id = (select auth.uid()))))
  );

-- fitness assessment items: the coach reads all, a client reads the items of their own taster session
drop policy if exists "assessment items client read own" on public.fitness_assessment_items;
drop policy if exists "assessment items coach read" on public.fitness_assessment_items;
drop policy if exists "assessment items read" on public.fitness_assessment_items;
create policy "assessment items read" on public.fitness_assessment_items for select to authenticated
  using (
    (select public.is_coach())
    or exists (
      select 1 from public.taster_sessions t
      where t.id = fitness_assessment_items.taster_session_id and t.client_id = (select auth.uid())
    )
  );
