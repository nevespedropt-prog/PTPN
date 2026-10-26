-- Coach-written monthly reviews, separate from the live training/measurement summary.
create table public.monthly_reviews (
  client_id uuid not null references public.profiles(id) on delete cascade,
  month_start date not null check (extract(day from month_start) = 1),
  feedback text not null check (length(btrim(feedback)) between 1 and 2000),
  next_focus text not null check (length(btrim(next_focus)) between 1 and 1000),
  updated_at timestamptz not null default now(),
  primary key (client_id, month_start)
);
alter table public.monthly_reviews enable row level security;
revoke all on public.monthly_reviews from anon, authenticated;
grant select, insert, update on public.monthly_reviews to authenticated;
create policy "monthly reviews read own or coach" on public.monthly_reviews for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "monthly reviews insert coach" on public.monthly_reviews for insert to authenticated
  with check ((select public.is_coach()));
create policy "monthly reviews update coach" on public.monthly_reviews for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));
