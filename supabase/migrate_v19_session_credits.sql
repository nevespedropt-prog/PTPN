create table if not exists public.client_session_credits (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  sessions_purchased integer not null default 0 check (sessions_purchased >= 0),
  completed_baseline integer not null default 0 check (completed_baseline >= 0),
  updated_at timestamptz not null default now()
);

alter table public.client_session_credits enable row level security;

drop policy if exists "session credits read" on public.client_session_credits;
create policy "session credits read" on public.client_session_credits for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));

drop policy if exists "session credits coach insert" on public.client_session_credits;
create policy "session credits coach insert" on public.client_session_credits for insert to authenticated
  with check ((select public.is_coach()));

drop policy if exists "session credits coach update" on public.client_session_credits;
create policy "session credits coach update" on public.client_session_credits for update to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

grant select, insert, update on public.client_session_credits to authenticated;

