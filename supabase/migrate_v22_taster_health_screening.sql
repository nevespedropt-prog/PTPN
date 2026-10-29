-- Compact coach-recorded health screening and exercise consent for taster sessions.
alter table public.taster_sessions
  add column if not exists parq_answers jsonb not null default '{}'::jsonb check (jsonb_typeof(parq_answers) = 'object'),
  add column if not exists parq_health_details text not null default '' check (length(parq_health_details) <= 2400),
  add column if not exists parq_injury_details text not null default '' check (length(parq_injury_details) <= 1600),
  add column if not exists parq_medication_details text not null default '' check (length(parq_medication_details) <= 1600),
  add column if not exists parq_allergy_details text not null default '' check (length(parq_allergy_details) <= 1600),
  add column if not exists parq_exercise_consent boolean not null default false,
  add column if not exists parq_consented_at timestamptz;

create policy "assessment items client read own" on public.fitness_assessment_items for select to authenticated
  using (exists (
    select 1 from public.taster_sessions t
    where t.id = taster_session_id and t.client_id = (select auth.uid())
  ));

