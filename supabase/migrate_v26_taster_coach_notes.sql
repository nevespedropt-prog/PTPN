-- Coach notes were a column on taster_sessions, which clients can read. Any client could fetch their
-- own row (notes included) straight from the API even though the screens hid it. Move the notes to a
-- table only the coach can read, copy what exists, then drop the column.
create table if not exists public.taster_session_notes (
  taster_session_id uuid primary key references public.taster_sessions(id) on delete cascade,
  notes text not null default '' check (char_length(notes) <= 4000),
  updated_at timestamptz not null default now()
);
alter table public.taster_session_notes enable row level security;
revoke all on public.taster_session_notes from public, anon, authenticated;
grant select, insert, update, delete on public.taster_session_notes to authenticated;
grant all on public.taster_session_notes to service_role;
drop policy if exists "taster notes coach only" on public.taster_session_notes;
create policy "taster notes coach only" on public.taster_session_notes for all to authenticated
  using ((select public.is_coach())) with check ((select public.is_coach()));

do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'taster_sessions' and column_name = 'coach_notes') then
    insert into public.taster_session_notes (taster_session_id, notes)
      select id, coach_notes from public.taster_sessions where coach_notes <> ''
      on conflict (taster_session_id) do nothing;
    alter table public.taster_sessions drop column coach_notes;
  end if;
end $$;
