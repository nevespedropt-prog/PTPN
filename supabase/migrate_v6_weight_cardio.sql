-- v6: Weight and Effort wording, cardio targets. Run once in the SQL editor.

-- v6: weight and effort wording, cardio targets (time, distance, speed)
alter table public.workout_items add column if not exists weight text not null default '';              -- kg ("80"), percent of the client's max ("75%") or text ("bodyweight")
alter table public.workout_items add column if not exists cardio_time text not null default '';          -- "20:00", "1:00", or minutes
alter table public.workout_items add column if not exists cardio_distance_km numeric check (cardio_distance_km >= 0);
alter table public.workout_items add column if not exists cardio_speed_kmh numeric check (cardio_speed_kmh >= 0);
-- Existing percent-of-max prescriptions show up in the new Weight field as "75%".
update public.workout_items set weight = (percent_1rm::float8)::text || '%' where weight = '' and percent_1rm is not null;
