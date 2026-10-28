-- Coach-led taster profile and flexible fitness assessment.
create table public.taster_sessions (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  assessed_on date not null default current_date,
  goal text not null check (length(btrim(goal)) between 1 and 1200),
  target_date date not null,
  date_of_birth date not null,
  sex text not null check (sex in ('female','male')),
  activity_level text not null check (activity_level in ('sedentary','light','moderate','very','extra')),
  height_cm numeric not null check (height_cm between 100 and 250),
  weight_kg numeric not null check (weight_kg between 20 and 400),
  body_fat_pct numeric check (body_fat_pct between 0 and 100),
  bmi numeric not null check (bmi between 5 and 100),
  estimated_maintenance_kcal int not null check (estimated_maintenance_kcal between 500 and 10000),
  target_kcal int not null check (target_kcal between 500 and 10000),
  target_protein int not null check (target_protein >= 0),
  target_carbs int not null check (target_carbs >= 0),
  target_fat int not null check (target_fat >= 0),
  client_summary text not null default '' check (length(client_summary) <= 2400),
  coach_notes text not null default '' check (length(coach_notes) <= 4000),
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index taster_sessions_client_date on public.taster_sessions (client_id, assessed_on desc, created_at desc);

create table public.fitness_assessment_items (
  id uuid primary key default gen_random_uuid(),
  taster_session_id uuid not null references public.taster_sessions(id) on delete cascade,
  exercise_id uuid references public.exercises(id) on delete set null,
  exercise_name text not null check (length(btrim(exercise_name)) between 1 and 200),
  category text not null default '',
  result text not null default '' check (length(result) <= 200),
  unit text not null default '' check (length(unit) <= 80),
  notes text not null default '' check (length(notes) <= 1200),
  sort int not null default 0
);
create index fitness_assessment_items_session on public.fitness_assessment_items (taster_session_id, sort);

alter table public.measurements add column taster_session_id uuid unique references public.taster_sessions(id) on delete set null;

alter table public.taster_sessions enable row level security;
alter table public.fitness_assessment_items enable row level security;
revoke all on public.taster_sessions, public.fitness_assessment_items from anon, authenticated;
grant select, insert, update, delete on public.taster_sessions, public.fitness_assessment_items to authenticated;

create policy "taster read own or coach" on public.taster_sessions for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "taster coach insert" on public.taster_sessions for insert to authenticated
  with check ((select public.is_coach()) and created_by = (select auth.uid()));
create policy "taster coach update" on public.taster_sessions for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "taster coach delete" on public.taster_sessions for delete to authenticated using ((select public.is_coach()));

create policy "assessment items coach read" on public.fitness_assessment_items for select to authenticated using ((select public.is_coach()));
create policy "assessment items coach insert" on public.fitness_assessment_items for insert to authenticated
  with check ((select public.is_coach()) and exists (select 1 from public.taster_sessions t where t.id = taster_session_id));
create policy "assessment items coach update" on public.fitness_assessment_items for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
create policy "assessment items coach delete" on public.fitness_assessment_items for delete to authenticated using ((select public.is_coach()));

create policy "meas coach insert" on public.measurements for insert to authenticated
  with check ((select public.is_coach()));
create policy "meas coach update" on public.measurements for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

