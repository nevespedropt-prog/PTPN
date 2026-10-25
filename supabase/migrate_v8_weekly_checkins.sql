-- Weekly submissions are immutable; coach feedback has separate permissions.
create table public.weekly_checkins (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  training text not null check (length(btrim(training)) between 1 and 2000),
  nutrition text not null check (length(btrim(nutrition)) between 1 and 2000),
  sleep_hours numeric not null check (sleep_hours between 0 and 24),
  energy smallint not null check (energy between 1 and 5),
  biggest_win text not null check (length(btrim(biggest_win)) between 1 and 2000),
  difficulties text not null check (length(btrim(difficulties)) between 1 and 2000),
  submitted_at timestamptz not null default now(),
  unique (client_id, week_start)
);
create table public.weekly_reviews (
  checkin_id uuid primary key references public.weekly_checkins(id) on delete cascade,
  feedback text not null check (length(btrim(feedback)) between 1 and 2000),
  next_focus text not null check (length(btrim(next_focus)) between 1 and 1000)
);
alter table public.weekly_checkins enable row level security;
alter table public.weekly_reviews enable row level security;
revoke all on public.weekly_checkins, public.weekly_reviews from anon, authenticated;
grant select, insert on public.weekly_checkins to authenticated;
grant select, insert, update on public.weekly_reviews to authenticated;
create policy "weekly checkins read" on public.weekly_checkins for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "weekly checkins submit own" on public.weekly_checkins for insert to authenticated
  with check (client_id = (select auth.uid()) and not (select public.is_coach()));
create policy "weekly reviews read" on public.weekly_reviews for select to authenticated
  using (exists (select 1 from public.weekly_checkins c where c.id = checkin_id));
create policy "weekly reviews insert coach" on public.weekly_reviews for insert to authenticated
  with check ((select public.is_coach()));
create policy "weekly reviews update coach" on public.weekly_reviews for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));