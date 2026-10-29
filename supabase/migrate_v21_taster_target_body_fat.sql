alter table public.taster_sessions
  add column if not exists target_body_fat_pct numeric check (target_body_fat_pct between 0 and 100);

