alter table public.taster_sessions
  add column if not exists target_weight_kg numeric check (target_weight_kg between 20 and 400),
  add column if not exists target_bmi numeric check (target_bmi between 5 and 100),
  add column if not exists bmr_kcal integer check (bmr_kcal between 500 and 10000),
  add column if not exists target_bmr_kcal integer check (target_bmr_kcal between 500 and 10000),
  add column if not exists job_description text not null default '' check (length(job_description) <= 500),
  add column if not exists fitness_level text not null default 'beginner' check (fitness_level in ('beginner','intermediate','advanced','athlete')),
  add column if not exists diet text not null default '' check (length(diet) <= 1200),
  add column if not exists goal_metric_label text not null default '' check (length(goal_metric_label) <= 80),
  add column if not exists goal_metric_current text not null default '' check (length(goal_metric_current) <= 80),
  add column if not exists goal_metric_target text not null default '' check (length(goal_metric_target) <= 80),
  add column if not exists goal_metric_unit text not null default '' check (length(goal_metric_unit) <= 40),
  add column if not exists new_habit text not null default '' check (length(new_habit) <= 200),
  add column if not exists emergency_contact_name text not null default '' check (length(emergency_contact_name) <= 160),
  add column if not exists emergency_contact_phone text not null default '' check (length(emergency_contact_phone) <= 80),
  add column if not exists emergency_contact_email text not null default '' check (length(emergency_contact_email) <= 320);

