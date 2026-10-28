-- Set styles belong to exercise blocks, allowing one workout to mix single sets,
-- supersets and tri-sets.
alter table public.workout_items
  add column if not exists set_style text not null default 'single';
alter table public.workout_items
  drop constraint if exists workout_items_set_style_check;
alter table public.workout_items
  add constraint workout_items_set_style_check
  check (set_style in ('single','superset','triset'));

-- Preserve the three built-in superset sessions prepared in v16.
update public.workout_items wi
set set_style = 'superset'
from public.workouts w
where w.id = wi.workout_id
  and w.format = 'standard'
  and wi.group_label <> '';

-- Single sets, supersets and tri-sets now mix under the general Sets format.
alter table public.workouts drop constraint if exists workouts_format_check;
update public.workouts set format = 'standard' where format = 'single_sets';
alter table public.workouts alter column format set default 'standard';
alter table public.workouts add constraint workouts_format_check
  check (format in ('standard','circuit','amrap','emom','intervals'));
