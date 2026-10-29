-- Coach ticks: "I have looked at this" for dashboard priorities and health-screening alerts.
-- fingerprint describes what the coach looked at. When new items arrive the fingerprint no longer
-- matches, so the item shows as unchecked again. Only the coach can read or change these rows.
create table if not exists public.coach_acknowledgements (
  coach_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null check (char_length(item_key) between 1 and 200),
  fingerprint text not null check (char_length(fingerprint) between 1 and 200),
  acknowledged_at timestamptz not null default now(),
  primary key (coach_id, item_key)
);
alter table public.coach_acknowledgements enable row level security;
revoke all on public.coach_acknowledgements from public, anon, authenticated;
grant select, insert, update, delete on public.coach_acknowledgements to authenticated;
grant all on public.coach_acknowledgements to service_role;
drop policy if exists "coach manages own acknowledgements" on public.coach_acknowledgements;
create policy "coach manages own acknowledgements" on public.coach_acknowledgements
  for all to authenticated
  using (coach_id = (select auth.uid()) and (select public.is_coach()))
  with check (coach_id = (select auth.uid()) and (select public.is_coach()));
