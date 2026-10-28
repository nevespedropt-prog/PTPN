-- Separate single-set sessions from strict superset sessions.
alter table public.workouts drop constraint if exists workouts_format_check;
alter table public.workouts alter column format set default 'single_sets';
alter table public.workouts add constraint workouts_format_check
  check (format in ('standard','single_sets','circuit','amrap','emom','intervals'));

-- These built-in templates were designed as one-exercise-at-a-time sessions.
update public.workouts
set format = 'single_sets'
where created_by is null
  and name in (
    '5x5 A', '5x5 B', 'Core finisher', 'Full body A', 'Full body B',
    'Legs', 'Lower strength', 'Mobility flow', 'Upper strength'
  );

-- Superset templates always use complete pairs: no rest after exercise one,
-- then 60–90 seconds after exercise two.
update public.workout_items wi
set rest_sec = case
  when wi.sort % 2 = 0 then 0
  when coalesce(wi.rest_sec, 0) between 60 and 90 then wi.rest_sec
  else 75
end,
group_label = chr(65 + (wi.sort / 2))
from public.workouts w
where w.id = wi.workout_id
  and w.format = 'standard';
