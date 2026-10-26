-- Optional client setup, kept separate from health consent and coaching plans.
create table public.client_onboarding (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  goals text not null check (length(btrim(goals)) between 1 and 1200),
  experience text not null check (experience in ('beginner', 'returning', 'regular')),
  equipment text not null check (length(btrim(equipment)) between 1 and 1200),
  preferred_days smallint[] not null check (
    cardinality(preferred_days) between 1 and 7
    and preferred_days <@ array[1,2,3,4,5,6,7]::smallint[]
    and array_position(preferred_days, null) is null
  ),
  food_preferences text not null default '' check (length(food_preferences) <= 1200),
  training_ready boolean not null default false,
  nutrition_ready boolean not null default false,
  contact_ready boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.client_onboarding enable row level security;
revoke all on public.client_onboarding from anon, authenticated;
grant select, insert, update on public.client_onboarding to authenticated;
create policy "onboarding read own or coach" on public.client_onboarding for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "onboarding insert own" on public.client_onboarding for insert to authenticated
  with check (client_id = (select auth.uid()) and not (select public.is_coach()));
create policy "onboarding update own" on public.client_onboarding for update to authenticated
  using (client_id = (select auth.uid()) and not (select public.is_coach()))
  with check (client_id = (select auth.uid()) and not (select public.is_coach()));
