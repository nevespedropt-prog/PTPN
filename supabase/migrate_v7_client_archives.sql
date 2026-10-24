-- Coach-only client filing. Removing this marker restores a client; no history is deleted.
create table public.client_archives (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  archived_at timestamptz not null default now()
);
alter table public.client_archives enable row level security;
revoke all on public.client_archives from public, anon, authenticated;
grant select, insert, delete on public.client_archives to authenticated;
grant all on public.client_archives to service_role;
create policy "coach reads client archives" on public.client_archives
  for select to authenticated using ((select public.is_coach()));
create policy "coach archives clients" on public.client_archives
  for insert to authenticated with check (
    (select public.is_coach()) and exists (
      select 1 from public.profiles p where p.id = client_id and p.role = 'client'
    )
  );
create policy "coach restores clients" on public.client_archives
  for delete to authenticated using ((select public.is_coach()));
