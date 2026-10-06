-- v5: health information and data consent. Run once in the SQL editor.

-- ========== v5: health information and data consent ==========
-- One row per client. Health data is special category data, so we keep explicit, dated consent with a version.
create table if not exists public.client_health (
  client_id uuid primary key references public.profiles(id) on delete cascade,
  allergies text not null default '',
  health_conditions text not null default '',
  medications text not null default '',
  emergency_contact text not null default '',
  consent_data boolean not null default false,
  consent_health boolean not null default false,
  consent_accurate boolean not null default false,
  consent_version int not null default 1,
  consented_at timestamptz,
  updated_at timestamptz not null default now()
);
alter table public.client_health enable row level security;
create policy "health read own or coach" on public.client_health for select using (client_id = auth.uid() or public.is_coach());
create policy "health insert own" on public.client_health for insert with check (client_id = auth.uid());
create policy "health update own" on public.client_health for update using (client_id = auth.uid()) with check (client_id = auth.uid());
