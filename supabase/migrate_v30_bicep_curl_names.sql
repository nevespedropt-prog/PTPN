-- v30: biceps curls say "bicep" in their name, because a curl is not only a biceps exercise
-- (leg curls, wrist curls). Search also matches the muscle now, so "bicep" lists every biceps exercise.
-- The old TRX curl becomes TRX bicep curl; the duplicate added by v28 is removed (nothing used it yet).
-- Workout items and alternatives that point at a renamed exercise follow the new name.
delete from public.exercises where created_by is null and name = 'TRX bicep curl';

with m(old_name, new_name) as (values
  ('Barbell curl','Barbell bicep curl'),
  ('Dumbbell curl','Dumbbell bicep curl'),
  ('Hammer curl','Hammer bicep curl'),
  ('Preacher curl','Preacher bicep curl'),
  ('Cable curl','Cable bicep curl'),
  ('Incline dumbbell curl','Incline dumbbell bicep curl'),
  ('Rope curl','Rope bicep curl'),
  ('TRX curl','TRX bicep curl'),
  ('Inverted curl','Inverted bicep curl'),
  ('Concentration curl','Concentration bicep curl'),
  ('Spider curl','Spider bicep curl'),
  ('Zottman curl','Zottman bicep curl'),
  ('Cross-body hammer curl','Cross-body hammer bicep curl'),
  ('Seated alternating dumbbell curl','Seated alternating dumbbell bicep curl'),
  ('EZ bar curl','EZ bar bicep curl'),
  ('Reverse barbell curl','Reverse barbell bicep curl'),
  ('Drag curl','Drag bicep curl'),
  ('Smith machine curl','Smith machine bicep curl'),
  ('Kettlebell curl','Kettlebell bicep curl'),
  ('Resistance band curl','Resistance band bicep curl'),
  ('Resistance band hammer curl','Resistance band hammer bicep curl'),
  ('High cable curl','High cable bicep curl'),
  ('Single-arm cable curl','Single-arm cable bicep curl'),
  ('Bayesian cable curl','Bayesian cable bicep curl'),
  ('Cable hammer curl','Cable hammer bicep curl'),
  ('Incline hammer curl','Incline hammer bicep curl'),
  ('Towel curl','Towel bicep curl'),
  ('Power bag curl','Power bag bicep curl')
), renamed as (
  update public.exercises e set name = m.new_name
  from m where e.created_by is null and e.name = m.old_name
  returning e.id, m.new_name
), items as (
  update public.workout_items w set exercise_name = r.new_name
  from renamed r where w.exercise_id = r.id
  returning w.id
)
update public.workout_alternatives a set exercise_name = r.new_name
from renamed r where a.exercise_id = r.id;
