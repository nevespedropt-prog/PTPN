-- Personal meal snapshots for quick reuse in the existing food diary.
create table public.saved_meals (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.profiles(id) on delete cascade,
  name text not null check (name = btrim(name) and length(name) between 1 and 80),
  items jsonb not null check (
    jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100
    and octet_length(items::text) <= 65536
  ),
  unique (client_id, name)
);
alter table public.saved_meals enable row level security;
revoke all on public.saved_meals from anon, authenticated;
grant select, insert, delete on public.saved_meals to authenticated;
create policy "saved meals read" on public.saved_meals for select to authenticated
  using (client_id = (select auth.uid()) or (select public.is_coach()));
create policy "saved meals insert own" on public.saved_meals for insert to authenticated
  with check (client_id = (select auth.uid()));
create policy "saved meals delete own" on public.saved_meals for delete to authenticated
  using (client_id = (select auth.uid()));