-- Record explicit consent to store and use health information.
alter table public.taster_sessions
  add column if not exists parq_health_storage_consent boolean not null default false,
  add column if not exists parq_health_storage_consented_at timestamptz;

