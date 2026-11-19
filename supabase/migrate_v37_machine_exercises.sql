-- v37: standard gym machines for every muscle group, and every curl names its muscle.
-- Adds 51 built-in machine exercises (selectorised, plate-loaded, plus cable and wrist work where gyms have few machines).
-- Curls that did not say their muscle are renamed (a curl is not always a bicep curl); workout items and alternatives follow.
-- Safe to run twice: existing names are skipped and renames only apply to the old names.
with m(old_name, new_name) as (values
  ('Lying leg curl','Lying hamstring curl machine'),
  ('Seated leg curl','Seated hamstring curl machine'),
  ('Swiss ball single-leg curl','Swiss ball single-leg hamstring curl'),
  ('Cable reverse curl','Cable reverse forearm curl'),
  ('Fat grip dumbbell curl','Fat grip dumbbell forearm curl'),
  ('Hammer curl hold','Dumbbell hammer forearm curl hold')
), renamed as (
  update public.exercises e set name = m.new_name
  from m where e.created_by is null and e.name = m.old_name
  and not exists (select 1 from public.exercises x where x.created_by is null and lower(x.name) = lower(m.new_name))
  returning e.id, m.new_name
), items as (
  update public.workout_items w set exercise_name = r.new_name
  from renamed r where w.exercise_id = r.id
  returning w.id
)
update public.workout_alternatives a set exercise_name = r.new_name
from renamed r where a.exercise_id = r.id;

insert into public.exercises (id, name, muscle, equipment, category, instructions)
select extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11'::uuid, 'ex:' || v.name), v.name, v.muscle, v.equipment, v.category, v.instructions
from (values
('Incline machine chest press','Chest','Machine','strength','Seat set so the handles sit at upper chest, press up and forward, control the return.'),
('Decline machine chest press','Chest','Machine','strength','Back flat on the pad, press down and forward to work the lower chest, no hard lockout.'),
('Pec deck','Chest','Machine','strength','Elbows at shoulder height, bring the pads together in front of the chest and squeeze, open slowly.'),
('Plate-loaded chest press','Chest','Machine','strength','Press the handles until the arms are nearly straight, pause, lower until you feel a chest stretch.'),
('Seated row machine','Back','Machine','strength','Chest on the pad, pull the handles to the ribs, squeeze the shoulder blades, return slowly.'),
('Machine high row','Back','Machine','strength','Pull the handles down and back to the upper ribs, elbows close, chest tall.'),
('Machine low row','Back','Machine','strength','Drive the elbows back, pull to the lower ribs and pause, do not shrug.'),
('T-bar row machine','Back','Machine','strength','Chest on the pad, pull the handles to the lower chest, hold briefly, lower under control.'),
('Assisted pull-up machine','Back','Machine','strength','Kneel on the pad, pull the chest toward the handles, lower to a full hang.'),
('Machine pullover','Back','Machine','strength','Elbows on the pads, sweep the bar down toward the hips with the lats, return to a stretch.'),
('Back extension machine','Back','Machine','strength','Hips on the pad, lower with a flat back, rise until the body is in one line.'),
('Machine shoulder press','Shoulders','Machine','strength','Handles at ear height, press up without shrugging, lower to just below the chin.'),
('Plate-loaded shoulder press','Shoulders','Machine','strength','Back against the pad, press up and slightly in, control the lowering.'),
('Machine lateral raise','Shoulders','Machine','strength','Elbows against the pads, lift out to shoulder height, lower slowly.'),
('Reverse pec deck','Shoulders','Machine','strength','Chest on the pad, open the arms out wide to the sides, squeeze the rear delts.'),
('Machine bicep curl','Biceps','Machine','strength','Upper arms flat on the pad, curl the handles up, squeeze at the top, lower fully.'),
('Machine preacher bicep curl','Biceps','Machine','strength','Armpits at the top of the pad, curl up, lower to a full stretch without swinging.'),
('Plate-loaded preacher bicep curl','Biceps','Machine','strength','Chest tall on the pad, curl up with the elbows fixed, slow negative.'),
('Machine hammer bicep curl','Biceps','Machine','strength','Neutral grip, elbows on the pad, curl up and lower under control.'),
('Machine triceps extension','Triceps','Machine','strength','Elbows on the pad, press the handles down until the arms are straight, return slowly.'),
('Seated dip machine','Triceps','Machine','strength','Keep the shoulders down, press the handles to straight arms, lower to a comfortable stretch.'),
('Assisted dip machine','Triceps','Machine','strength','Kneel on the pad, lower until the elbows reach 90 degrees, press up.'),
('Plate-loaded dip machine','Triceps','Machine','strength','Lean slightly forward, lower with control and press up without locking out hard.'),
('Machine overhead triceps extension','Triceps','Machine','strength','Elbows by the head, extend the arms up, lower behind the head to a stretch.'),
('Cable wrist curl','Forearms','Cable','strength','Forearms on a bench, palms up, curl the wrists up and lower slowly.'),
('Cable reverse wrist curl','Forearms','Cable','strength','Palms down, lift the back of the hands up, lower under control.'),
('Machine wrist curl','Forearms','Machine','strength','Forearms supported, curl the handles up with the wrists only, full range.'),
('Pendulum squat','Quads','Machine','strength','Back on the pad, feet shoulder width, squat deep and drive up through the whole foot.'),
('V-squat machine','Quads','Machine','strength','Shoulders under the pads, squat to parallel or lower, stand tall without locking the knees.'),
('Vertical leg press','Quads','Machine','strength','Lower the sled until the knees reach the chest range comfortably, press up without locking out.'),
('Belt squat machine','Quads','Machine','strength','Load hangs from the hips, squat deep with an upright torso, drive up.'),
('Standing hamstring curl machine','Hamstrings','Machine','strength','One leg at a time, curl the heel toward the glute, lower slowly.'),
('Glute-ham raise machine','Hamstrings','Machine','strength','Ankles locked in, lower the torso under control and curl back up with the hamstrings.'),
('Plate-loaded lying hamstring curl','Hamstrings','Machine','strength','Hips pressed into the pad, curl the heels to the glutes, pause, lower slowly.'),
('Hip thrust machine','Glutes','Machine','strength','Shoulders on the pad, drive the hips up until the body is flat, squeeze the glutes, lower.'),
('Standing glute kickback machine','Glutes','Machine','strength','Chest against the pad, push the heel back and up, squeeze, return slowly.'),
('Hip abduction machine','Glutes','Machine','strength','Seated tall, push the knees out against the pads, pause, close slowly.'),
('Glute bridge machine','Glutes','Machine','strength','Back on the pad, press the hips up with the heels, squeeze at the top.'),
('Reverse hyper machine','Glutes','Machine','strength','Hips on the pad, swing the legs up to body height with the glutes, lower slowly.'),
('Leg press calf raise','Calves','Machine','strength','Balls of the feet on the lower edge of the plate, press up high and lower to a deep stretch.'),
('Donkey calf raise machine','Calves','Machine','strength','Hips hinged, drive up onto the toes, pause, lower to a full stretch.'),
('Plate-loaded standing calf raise','Calves','Machine','strength','Shoulders under the pads, rise high on the toes and lower slowly.'),
('Hip adduction machine','Adductors','Machine','strength','Seated tall, squeeze the pads together with the inner thighs, open slowly.'),
('Standing hip adduction machine','Adductors','Machine','strength','Pad on the inner thigh, pull the leg across, return under control.'),
('Plate-loaded hip adduction machine','Adductors','Machine','strength','Press the pad inward with the inner thigh, pause, return slowly.'),
('Ab crunch machine','Core','Machine','core','Curl the ribs toward the hips against the pad, exhale at the top, return slowly.'),
('Rotary torso machine','Core','Machine','core','Hips still, rotate the torso against the pad, pause, return under control.'),
('Ab coaster machine','Core','Machine','core','Forearms on the pads, draw the knees up and curl the pelvis, lower slowly.'),
('Oblique crunch machine','Core','Machine','core','Side bend against the pad, squeeze the obliques, return slowly.'),
('Shrug machine','Traps','Machine','strength','Lift the shoulders straight up toward the ears, pause, lower slowly.'),
('Plate-loaded shrug machine','Traps','Machine','strength','Stand tall, shrug up and slightly back, pause at the top.')
) as v(name, muscle, equipment, category, instructions)
on conflict do nothing;
