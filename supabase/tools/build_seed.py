"""Run: python3 supabase/tools/build_seed.py supabase/seed.sql
Generates supabase/seed.sql: built-in exercise library, foods, recipes, workout and programme templates.
Deterministic UUIDs (uuid5) so the seed can be re-run and cross-referenced."""
import uuid, sys

NS = uuid.UUID('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11')
def uid(kind, name): return "pg_temp.sid(" + q(f'{kind}:{name}') + ")"
def pyuid(kind, name): return str(uuid.uuid5(NS, f'{kind}:{name}'))
def q(s): return "'" + str(s).replace("'", "''") + "'"
def arr(xs): return "array[" + ",".join(q(x) for x in xs) + "]::text[]" if xs else "'{}'::text[]"

# ---------- exercises: name, muscle, equipment, category, cue ----------
EX = [
 # chest
 ("Barbell bench press","Chest","Barbell","strength","Feet planted, shoulder blades pinched, lower the bar to mid-chest and press up."),
 ("Incline barbell bench press","Chest","Barbell","strength","Bench at 30 degrees, bar to upper chest, elbows about 45 degrees from the body."),
 ("Dumbbell bench press","Chest","Dumbbells","strength","Lower the dumbbells to chest level with control, press up and slightly together."),
 ("Incline dumbbell press","Chest","Dumbbells","strength","Bench at 30 degrees, press from upper chest, keep wrists stacked over elbows."),
 ("Dumbbell fly","Chest","Dumbbells","strength","Soft elbows, open wide until you feel a chest stretch, hug back up."),
 ("Cable crossover","Chest","Cable","strength","Step forward, bring handles together in a wide arc in front of the chest."),
 ("Machine chest press","Chest","Machine","strength","Handles at mid-chest, press without locking out hard, control the return."),
 ("Push-up","Chest","Bodyweight","strength","Hands under shoulders, body in one line, chest to just above the floor."),
 ("Dips","Chest","Bodyweight","strength","Lean slightly forward, lower until shoulders are level with elbows, press up."),
 # back
 ("Deadlift","Back","Barbell","strength","Bar over mid-foot, flat back, push the floor away and stand tall."),
 ("Barbell row","Back","Barbell","strength","Hinge to 45 degrees, pull the bar to the lower ribs, control down."),
 ("Pull-up","Back","Bodyweight","strength","Overhand grip, pull chest toward the bar, full hang at the bottom."),
 ("Chin-up","Back","Bodyweight","strength","Underhand grip, drive elbows down, chin over the bar."),
 ("Lat pulldown","Back","Cable","strength","Slight lean back, pull the bar to the upper chest, elbows down and in."),
 ("Seated cable row","Back","Cable","strength","Tall chest, row the handle to the stomach, squeeze shoulder blades."),
 ("Single-arm dumbbell row","Back","Dumbbells","strength","Hand and knee on bench, row the dumbbell to the hip."),
 ("T-bar row","Back","Barbell","strength","Chest up, row the handle to the chest, keep the back flat."),
 ("Face pull","Shoulders","Cable","strength","Rope at face height, pull to the forehead with elbows high, rotate out."),
 ("Inverted row","Back","Bodyweight","strength","Body straight under a bar, pull chest to the bar."),
 ("Straight-arm pulldown","Back","Cable","strength","Arms long, sweep the bar down to the thighs using the lats."),
 # shoulders
 ("Overhead press","Shoulders","Barbell","strength","Bar from the front rack, press overhead, head through at the top."),
 ("Seated dumbbell shoulder press","Shoulders","Dumbbells","strength","Back supported, press from ear height to overhead."),
 ("Arnold press","Shoulders","Dumbbells","strength","Start palms facing you, rotate out as you press overhead."),
 ("Lateral raise","Shoulders","Dumbbells","strength","Slight bend in elbows, raise out to shoulder height, slow down."),
 ("Rear delt fly","Shoulders","Dumbbells","strength","Hinge forward, raise arms out wide leading with the elbows."),
 ("Landmine press","Shoulders","Barbell","strength","Half-kneeling, press the bar end up and forward."),
 ("Push press","Shoulders","Barbell","strength","Short dip at the knees, drive with the legs and press overhead."),
 # quads
 ("Back squat","Quads","Barbell","strength","Bar on upper back, brace, sit down between the hips, drive up."),
 ("Front squat","Quads","Barbell","strength","Bar in front rack, elbows high, squat upright."),
 ("Goblet squat","Quads","Kettlebell","strength","Hold the weight at the chest, squat deep with an upright torso."),
 ("Leg press","Quads","Machine","strength","Feet shoulder width, lower until knees are near 90 degrees, press."),
 ("Bulgarian split squat","Quads","Dumbbells","strength","Rear foot on bench, drop the back knee, drive through the front heel."),
 ("Walking lunge","Quads","Dumbbells","strength","Long step, back knee toward the floor, step through."),
 ("Reverse lunge","Quads","Bodyweight","strength","Step back, lower both knees to 90 degrees, return."),
 ("Step-up","Quads","Dumbbells","strength","Whole foot on the box, drive up through the front leg."),
 ("Leg extension","Quads","Machine","strength","Extend the knees fully, pause, lower with control."),
 ("Hack squat","Quads","Machine","strength","Back against the pad, squat deep, press through mid-foot."),
 # posterior chain
 ("Romanian deadlift","Hamstrings","Barbell","strength","Soft knees, push hips back until a hamstring stretch, stand up."),
 ("Hip thrust","Glutes","Barbell","strength","Upper back on bench, drive hips up, squeeze glutes at the top."),
 ("Glute bridge","Glutes","Bodyweight","strength","Feet flat, drive hips up, ribs down, pause at the top."),
 ("Lying leg curl","Hamstrings","Machine","strength","Curl heels toward glutes, hips pressed into the pad."),
 ("Seated leg curl","Hamstrings","Machine","strength","Curl under, pause, return slowly."),
 ("Good morning","Hamstrings","Barbell","strength","Bar on back, hinge forward with a flat back, stand up."),
 ("Kettlebell swing","Glutes","Kettlebell","strength","Hike the bell back, snap the hips forward, float it to chest height."),
 ("Nordic hamstring curl","Hamstrings","Bodyweight","strength","Knees anchored, lower the body forward as slowly as possible."),
 ("Single-leg Romanian deadlift","Hamstrings","Dumbbells","strength","Hinge on one leg, back leg long, keep hips square."),
 ("Cable pull-through","Glutes","Cable","strength","Face away from the cable, hinge, drive hips through."),
 ("Sumo deadlift","Glutes","Barbell","strength","Wide stance, hands inside knees, push knees out and stand."),
 ("Trap bar deadlift","Quads","Trap bar","strength","Stand in the bar, brace, push the floor away."),
 ("Standing calf raise","Calves","Machine","strength","Full stretch at the bottom, rise high, pause."),
 ("Seated calf raise","Calves","Machine","strength","Knees under the pad, full range, slow tempo."),
 # arms
 ("Barbell curl","Biceps","Barbell","strength","Elbows by your sides, curl without swinging."),
 ("Dumbbell curl","Biceps","Dumbbells","strength","Supinate as you curl, lower slowly."),
 ("Hammer curl","Biceps","Dumbbells","strength","Neutral grip, curl to the shoulder, elbows fixed."),
 ("Preacher curl","Biceps","EZ bar","strength","Arms on the pad, curl up, lower to near straight."),
 ("Cable curl","Biceps","Cable","strength","Constant tension, squeeze at the top."),
 ("Triceps pushdown","Triceps","Cable","strength","Elbows pinned, push down to full lockout."),
 ("Overhead triceps extension","Triceps","Dumbbells","strength","Weight behind the head, extend overhead, elbows forward."),
 ("Skull crusher","Triceps","EZ bar","strength","Lower the bar toward the forehead, extend back up."),
 ("Close-grip bench press","Triceps","Barbell","strength","Hands shoulder width, elbows tucked, press."),
 ("Bench dip","Triceps","Bodyweight","strength","Hands on bench behind you, lower to 90 degrees, press up."),
 # core
 ("Plank","Core","Bodyweight","core","Forearms down, body straight, squeeze glutes and brace."),
 ("Side plank","Core","Bodyweight","core","Elbow under shoulder, hips high, body in one line."),
 ("Dead bug","Core","Bodyweight","core","Low back flat, extend opposite arm and leg slowly."),
 ("Hanging leg raise","Core","Bodyweight","core","Hang from a bar, raise legs without swinging."),
 ("Cable crunch","Core","Cable","core","Kneel, crunch the ribs toward the hips."),
 ("Ab wheel rollout","Core","Ab wheel","core","Roll out with a braced core, pull back without arching."),
 ("Russian twist","Core","Bodyweight","core","Lean back, rotate side to side from the ribs."),
 ("Pallof press","Core","Cable","core","Stand side-on to the cable, press out and resist rotation."),
 ("Bird dog","Core","Bodyweight","core","On all fours, reach opposite arm and leg, keep hips level."),
 ("Hollow hold","Core","Bodyweight","core","Low back pressed down, arms and legs extended, hold."),
 ("Mountain climber","Core","Bodyweight","cardio","Plank position, drive knees to chest quickly."),
 ("Farmer's carry","Full body","Dumbbells","strength","Heavy weights at your sides, walk tall with short steps."),
 # power / plyo
 ("Box jump","Legs","Box","plyometric","Swing arms, jump onto the box, land softly, step down."),
 ("Broad jump","Legs","Bodyweight","plyometric","Jump forward as far as possible, stick the landing."),
 ("Jump squat","Legs","Bodyweight","plyometric","Quarter squat, explode up, land softly into the next rep."),
 ("Medicine ball slam","Full body","Medicine ball","plyometric","Reach tall, slam the ball down hard, catch and repeat."),
 ("Burpee","Full body","Bodyweight","cardio","Squat, kick back to plank, chest down, jump up."),
 ("Skater jump","Legs","Bodyweight","plyometric","Bound side to side, land on one leg with control."),
 ("Tuck jump","Legs","Bodyweight","plyometric","Jump and drive knees to the chest."),
 ("Power clean","Full body","Barbell","strength","Pull from the floor, extend hard, catch in the front rack."),
 ("Hang clean","Full body","Barbell","strength","Start at mid-thigh, jump and shrug, catch in the front rack."),
 ("Thruster","Full body","Barbell","strength","Front squat straight into an overhead press."),
 ("Wall ball","Full body","Medicine ball","strength","Squat, then drive the ball to a target on the wall."),
 # cardio
 ("Running","Cardio","None","cardio","Easy, conversational pace unless stated."),
 ("Treadmill run","Cardio","Treadmill","cardio","Set speed and incline as prescribed."),
 ("Rowing machine","Cardio","Rower","cardio","Legs, then body, then arms; reverse on the way back."),
 ("Assault bike","Cardio","Air bike","cardio","Push and pull with arms and legs together."),
 ("Cycling","Cardio","Bike","cardio","Steady cadence at the prescribed effort."),
 ("Jump rope","Cardio","Rope","cardio","Small hops on the balls of the feet."),
 ("Sled push","Full body","Sled","cardio","Low body angle, drive with short powerful steps."),
 ("Stair climber","Cardio","Machine","cardio","Upright posture, avoid leaning on the rails."),
 ("Ski erg","Cardio","Ski erg","cardio","Hinge and pull down with the arms and core."),
 ("Battle ropes","Full body","Ropes","cardio","Athletic stance, fast alternating waves."),
 # mobility
 ("World's greatest stretch","Mobility","Bodyweight","mobility","Lunge, elbow to instep, rotate and reach to the ceiling."),
 ("Hip 90/90","Mobility","Bodyweight","mobility","Both knees at 90 degrees, rotate side to side tall."),
 ("Cat-cow","Mobility","Bodyweight","mobility","On all fours, alternate rounding and arching the spine."),
 ("Thoracic rotation","Mobility","Bodyweight","mobility","Side-lying, open the top arm and follow it with your eyes."),
 ("Couch stretch","Mobility","Bodyweight","mobility","Back knee against the wall, squeeze the glute, stay tall."),
 ("Pigeon stretch","Mobility","Bodyweight","mobility","Front shin across, sink hips toward the floor."),
 ("Band pull-apart","Shoulders","Band","mobility","Arms straight, pull the band apart to the chest."),
 ("Hamstring stretch","Mobility","Bodyweight","mobility","Leg straight on a low step, hinge forward gently."),
 ("Shoulder dislocates","Mobility","Band","mobility","Wide grip, pass the band over and behind the head."),
 ("Deep squat hold","Mobility","Bodyweight","mobility","Sit in the bottom of a squat, chest tall, breathe."),
]

# ---------- foods: name, serving_label, serving_g, kcal, protein, carbs, fat (per 100 g) ----------
FOODS = [
 ("Chicken breast, cooked","100 g",100,165,31,0,3.6),
 ("Chicken thigh, cooked, skinless","100 g",100,209,26,0,10.9),
 ("Turkey breast, cooked","100 g",100,135,30,0,1),
 ("Beef mince 5% fat, cooked","100 g",100,170,26,0,7),
 ("Sirloin steak, cooked","100 g",100,206,30,0,9),
 ("Pork tenderloin, cooked","100 g",100,143,26,0,3.5),
 ("Bacon rashers, grilled","1 rasher (25 g)",25,287,23.4,0.1,21.6),
 ("Ham, sliced","1 slice (30 g)",30,107,18,1.5,3.3),
 ("Salmon fillet, cooked","100 g",100,206,22,0,12),
 ("Smoked salmon","100 g",100,117,18.3,0,4.3),
 ("Tuna, canned in water, drained","1 can (110 g)",110,116,26,0,1),
 ("Tuna steak, cooked","100 g",100,184,30,0,6.3),
 ("Cod, cooked","100 g",100,105,23,0,0.9),
 ("Mackerel, cooked","100 g",100,262,23.9,0,17.8),
 ("Sardines, canned in oil, drained","100 g",100,208,24.6,0,11.5),
 ("Prawns, cooked","100 g",100,99,24,0.2,0.3),
 ("Eggs, whole","1 large egg (50 g)",50,143,12.6,0.7,9.5),
 ("Egg whites","100 g",100,52,11,0.7,0.2),
 ("Greek yogurt 0% fat","100 g",100,59,10.3,3.6,0.4),
 ("Greek yogurt, full fat","100 g",100,97,9,4,5),
 ("Skyr, plain","1 pot (150 g)",150,63,11,4,0.2),
 ("Cottage cheese, low fat","100 g",100,72,12.4,2.7,1),
 ("Whey protein powder","1 scoop (30 g)",30,400,80,8,6),
 ("Protein bar","1 bar (60 g)",60,350,33,35,10),
 ("Tofu, firm","100 g",100,144,15.8,2.8,8.7),
 ("Tempeh","100 g",100,192,20,7.6,11),
 ("Lentils, cooked","100 g",100,116,9,20,0.4),
 ("Chickpeas, cooked","100 g",100,164,8.9,27.4,2.6),
 ("Black beans, cooked","100 g",100,132,8.9,23.7,0.5),
 ("Kidney beans, cooked","100 g",100,127,8.7,22.8,0.5),
 ("Edamame","100 g",100,121,11.9,8.9,5.2),
 ("Milk, semi-skimmed","250 ml glass",250,46,3.4,4.7,1.7),
 ("Milk, whole","250 ml glass",250,64,3.3,4.7,3.6),
 ("Almond milk, unsweetened","250 ml glass",250,13,0.5,0.3,1.1),
 ("Cheddar cheese","30 g",30,403,25,1.3,33),
 ("Mozzarella","100 g",100,280,28,3.1,17),
 ("Feta","30 g",30,264,14,4,21),
 ("Parmesan","10 g",10,431,38,4.1,29),
 ("Halloumi","100 g",100,316,21,2.2,25),
 ("White rice, cooked","1 cup (160 g)",160,130,2.7,28,0.3),
 ("Brown rice, cooked","1 cup (160 g)",160,123,2.7,25.6,1),
 ("Pasta, cooked","100 g",100,158,5.8,31,0.9),
 ("Wholewheat pasta, cooked","100 g",100,149,5.9,30,1.7),
 ("Egg noodles, cooked","100 g",100,138,4.5,25,2.1),
 ("Rice noodles, cooked","100 g",100,108,1.8,24,0.2),
 ("Oats, dry","40 g",40,389,16.9,66.3,6.9),
 ("Quinoa, cooked","100 g",100,120,4.4,21.3,1.9),
 ("Couscous, cooked","100 g",100,112,3.8,23.2,0.2),
 ("Potato, boiled","100 g",100,87,1.9,20,0.1),
 ("Sweet potato, baked","100 g",100,90,2,20.7,0.2),
 ("Wholemeal bread","1 slice (36 g)",36,247,13,41,3.4),
 ("White bread","1 slice (36 g)",36,265,9,49,3.2),
 ("Sourdough bread","1 slice (50 g)",50,274,10.7,52,3.2),
 ("Bagel, plain","1 bagel (90 g)",90,257,10,50,1.6),
 ("Tortilla wrap","1 wrap (62 g)",62,312,8.3,51.6,8),
 ("Rice cakes","1 cake (9 g)",9,387,8,81,2.8),
 ("Granola","40 g",40,471,10,64,20),
 ("Cornflakes","30 g",30,357,7.5,84,0.4),
 ("Banana","1 medium (118 g)",118,89,1.1,22.8,0.3),
 ("Apple","1 medium (182 g)",182,52,0.3,13.8,0.2),
 ("Blueberries","80 g",80,57,0.7,14.5,0.3),
 ("Strawberries","80 g",80,32,0.7,7.7,0.3),
 ("Raspberries","80 g",80,52,1.2,11.9,0.7),
 ("Orange","1 medium (130 g)",130,47,0.9,11.8,0.1),
 ("Mango","100 g",100,60,0.8,15,0.4),
 ("Pineapple","100 g",100,50,0.5,13.1,0.1),
 ("Grapes","80 g",80,69,0.7,18.1,0.2),
 ("Kiwi","1 fruit (75 g)",75,61,1.1,14.7,0.5),
 ("Medjool dates","1 date (24 g)",24,277,1.8,75,0.2),
 ("Avocado","half (75 g)",75,160,2,8.5,14.7),
 ("Broccoli","80 g",80,34,2.8,6.6,0.4),
 ("Spinach","30 g",30,23,2.9,3.6,0.4),
 ("Mixed salad leaves","30 g",30,15,1.4,2.9,0.2),
 ("Tomato","1 medium (120 g)",120,18,0.9,3.9,0.2),
 ("Chopped tomatoes, canned","200 g",200,21,1.2,3.5,0.2),
 ("Cucumber","80 g",80,15,0.7,3.6,0.1),
 ("Bell pepper","1 pepper (150 g)",150,31,1,6,0.3),
 ("Carrot","1 medium (60 g)",60,41,0.9,9.6,0.2),
 ("Onion","1 medium (110 g)",110,40,1.1,9.3,0.1),
 ("Mushrooms","80 g",80,22,3.1,3.3,0.3),
 ("Courgette","80 g",80,17,1.2,3.1,0.3),
 ("Green beans","80 g",80,31,1.8,7,0.2),
 ("Asparagus","80 g",80,20,2.2,3.9,0.1),
 ("Cauliflower","80 g",80,25,1.9,5,0.3),
 ("Kale","30 g",30,35,2.9,4.4,1.5),
 ("Peas, frozen","80 g",80,81,5.4,14.5,0.4),
 ("Sweetcorn","80 g",80,86,3.3,19,1.4),
 ("Olive oil","1 tbsp (14 g)",14,884,0,0,100),
 ("Butter","10 g",10,717,0.9,0.1,81),
 ("Peanut butter","1 tbsp (16 g)",16,588,25,20,50),
 ("Almond butter","1 tbsp (16 g)",16,614,21,19,56),
 ("Almonds","30 g",30,579,21,22,50),
 ("Walnuts","30 g",30,654,15,14,65),
 ("Cashews","30 g",30,553,18,30,44),
 ("Peanuts","30 g",30,567,26,16,49),
 ("Chia seeds","1 tbsp (12 g)",12,486,17,42,31),
 ("Ground flaxseed","1 tbsp (10 g)",10,534,18,29,42),
 ("Dark chocolate 70%","20 g",20,598,7.8,46,43),
 ("Hummus","2 tbsp (60 g)",60,166,7.9,14.3,9.6),
 ("Honey","1 tbsp (21 g)",21,304,0.3,82,0),
 ("Maple syrup","1 tbsp (20 g)",20,260,0,67,0.1),
 ("Orange juice","250 ml glass",250,45,0.7,10.4,0.2),
 ("Cola","330 ml can",330,42,0,10.6,0),
 ("Lager beer","1 pint (568 ml)",568,43,0.5,3.6,0),
 ("Red wine","175 ml glass",175,85,0.1,2.6,0),
 ("Latte, semi-skimmed","1 regular (300 ml)",300,50,3.3,4.9,1.9),
 ("Pizza margherita","1 slice (100 g)",100,266,11,33,10),
 ("Chips / fries","1 portion (150 g)",150,312,3.4,41,15),
 ("Crisps","1 bag (25 g)",25,536,7,53,34),
]
FOOD = {f[0]: f for f in FOODS}

# ---------- recipes: name, meal, prep, description, tags, [(food, grams)], steps ----------
RECIPES = [
 ("Protein overnight oats","breakfast",5,"Make it the night before and grab it in the morning.",["high protein","meal prep"],
  [("Oats, dry",60),("Whey protein powder",30),("Milk, semi-skimmed",200),("Blueberries",80),("Chia seeds",10)],
  ["Stir oats, whey, chia and milk together in a jar.","Refrigerate overnight.","Top with blueberries before eating."]),
 ("Greek yogurt power bowl","breakfast",5,"Fast, high protein and no cooking.",["high protein","no cook"],
  [("Greek yogurt 0% fat",250),("Granola",40),("Strawberries",100),("Honey",10)],
  ["Spoon yogurt into a bowl.","Top with granola and sliced strawberries.","Drizzle with honey."]),
 ("Veggie egg-white omelette","breakfast",12,"Big volume, low calorie, plenty of protein.",["high protein","low calorie"],
  [("Egg whites",200),("Eggs, whole",50),("Spinach",50),("Mushrooms",60),("Bell pepper",50),("Feta",20),("Wholemeal bread",36)],
  ["Saute mushrooms and pepper in a non-stick pan.","Add spinach until wilted.","Pour in whisked egg whites and egg, cook until set.","Crumble feta on top, fold, and serve with toast."]),
 ("Banana protein pancakes","breakfast",15,"Weekend pancakes that still fit your macros.",["high protein","sweet"],
  [("Oats, dry",50),("Banana",118),("Eggs, whole",100),("Whey protein powder",15),("Maple syrup",10)],
  ["Blend oats, banana, eggs and whey into a batter.","Cook small pancakes in a non-stick pan, 2 minutes per side.","Serve with maple syrup."]),
 ("Smoked salmon bagel","breakfast",5,"Omega-3s and protein in five minutes.",["high protein","quick"],
  [("Bagel, plain",90),("Cottage cheese, low fat",60),("Smoked salmon",70),("Cucumber",40)],
  ["Toast the bagel.","Spread with cottage cheese.","Layer smoked salmon and sliced cucumber."]),
 ("Scrambled eggs on sourdough","breakfast",10,"A classic with greens on the side.",["vegetarian","quick"],
  [("Eggs, whole",150),("Sourdough bread",70),("Butter",5),("Spinach",40),("Tomato",80)],
  ["Whisk eggs and scramble gently in butter.","Wilt spinach in the same pan.","Serve on toasted sourdough with sliced tomato."]),
 ("Chicken burrito bowl","lunch",15,"Meal-prep friendly and easy to scale.",["high protein","meal prep"],
  [("Chicken breast, cooked",150),("White rice, cooked",150),("Black beans, cooked",80),("Sweetcorn",50),("Tomato",60),("Avocado",50),("Mixed salad leaves",30)],
  ["Slice the cooked chicken.","Build the bowl on rice with beans, corn, tomato and leaves.","Top with sliced avocado."]),
 ("Tuna and chickpea salad","lunch",10,"No cooking, packs well for work.",["high protein","no cook"],
  [("Tuna, canned in water, drained",120),("Chickpeas, cooked",120),("Cucumber",80),("Tomato",80),("Onion",30),("Olive oil",10),("Feta",30)],
  ["Drain the tuna and chickpeas.","Chop cucumber, tomato and onion.","Toss everything with olive oil and crumbled feta."]),
 ("Turkey and hummus wrap","lunch",5,"Lunch in five minutes.",["quick","high protein"],
  [("Tortilla wrap",62),("Turkey breast, cooked",100),("Hummus",40),("Spinach",30),("Bell pepper",50)],
  ["Spread hummus over the wrap.","Add turkey, spinach and sliced pepper.","Roll tightly and cut in half."]),
 ("Quinoa and halloumi salad","lunch",15,"Vegetarian lunch with a salty crunch.",["vegetarian"],
  [("Quinoa, cooked",150),("Halloumi",60),("Spinach",40),("Tomato",80),("Cucumber",60),("Olive oil",7)],
  ["Grill halloumi slices until golden.","Toss quinoa with spinach, tomato and cucumber.","Top with halloumi and drizzle with oil."]),
 ("Prawn noodle stir-fry","lunch",15,"Quick wok dish with plenty of veg.",["high protein","quick"],
  [("Prawns, cooked",150),("Egg noodles, cooked",180),("Broccoli",80),("Bell pepper",60),("Carrot",50),("Olive oil",7)],
  ["Stir-fry broccoli, pepper and carrot in oil for 3 minutes.","Add prawns and noodles, toss until hot.","Season with soy sauce and chilli to taste."]),
 ("Lentil and vegetable soup","lunch",30,"Batch-cook for the week.",["vegan","meal prep","high fibre"],
  [("Lentils, cooked",200),("Carrot",80),("Onion",60),("Chopped tomatoes, canned",120),("Spinach",40),("Olive oil",5),("Wholemeal bread",36)],
  ["Soften onion and carrot in oil.","Add tomatoes, lentils and stock, simmer 20 minutes.","Stir in spinach and serve with bread."]),
 ("Salmon, sweet potato and greens","dinner",25,"Balanced plate for recovery days.",["high protein","omega-3"],
  [("Salmon fillet, cooked",140),("Sweet potato, baked",200),("Broccoli",100),("Olive oil",5)],
  ["Bake sweet potato wedges at 200C for 25 minutes.","Roast salmon for the last 12 minutes.","Steam broccoli and drizzle with oil."]),
 ("Lean beef bolognese","dinner",30,"Family favourite with lean mince.",["high protein","meal prep"],
  [("Beef mince 5% fat, cooked",150),("Pasta, cooked",180),("Chopped tomatoes, canned",150),("Onion",50),("Mushrooms",60),("Parmesan",10)],
  ["Brown the mince with onion and mushrooms.","Add tomatoes and simmer 20 minutes.","Serve over pasta with grated parmesan."]),
 ("Chicken thigh tray bake","dinner",40,"One tray, minimal washing up.",["high protein","one pan"],
  [("Chicken thigh, cooked, skinless",180),("Potato, boiled",200),("Bell pepper",80),("Courgette",80),("Onion",50),("Olive oil",7)],
  ["Chop potatoes and veg, toss with oil and seasoning.","Add chicken thighs and roast at 200C for 35 minutes."]),
 ("Steak, rice and asparagus","dinner",20,"Simple, high protein dinner.",["high protein"],
  [("Sirloin steak, cooked",170),("White rice, cooked",150),("Asparagus",100),("Butter",5)],
  ["Sear steak 3 minutes per side, rest 5 minutes.","Pan-fry asparagus in butter.","Serve with rice."]),
 ("Lemon cod with couscous","dinner",20,"Light and fresh, high protein.",["high protein","low fat"],
  [("Cod, cooked",180),("Couscous, cooked",150),("Peas, frozen",80),("Green beans",80),("Olive oil",5)],
  ["Bake cod with lemon for 12 minutes.","Fluff couscous with peas.","Serve with green beans and a drizzle of oil."]),
 ("Tofu satay stir-fry","dinner",20,"Plant-based dinner with a peanut kick.",["vegan","high protein"],
  [("Tofu, firm",200),("Brown rice, cooked",150),("Broccoli",80),("Bell pepper",60),("Mushrooms",60),("Peanut butter",15)],
  ["Press and cube tofu, pan-fry until golden.","Stir-fry the vegetables.","Loosen peanut butter with water and soy, toss through, serve on rice."]),
 ("Turkey chilli","dinner",35,"Freezer-friendly chilli.",["high protein","meal prep"],
  [("Turkey breast, cooked",150),("Kidney beans, cooked",100),("Chopped tomatoes, canned",150),("Onion",50),("Bell pepper",60),("White rice, cooked",150)],
  ["Soften onion and pepper.","Add turkey, beans, tomatoes and chilli spices, simmer 25 minutes.","Serve over rice."]),
 ("Chickpea and spinach curry","dinner",25,"Creamy vegetarian curry.",["vegetarian","high fibre"],
  [("Chickpeas, cooked",200),("Spinach",80),("Chopped tomatoes, canned",150),("Onion",60),("Greek yogurt, full fat",50),("White rice, cooked",150),("Olive oil",5)],
  ["Fry onion with curry spices in oil.","Add tomatoes and chickpeas, simmer 15 minutes.","Stir in spinach and yogurt, serve with rice."]),
 ("Cottage cheese and pineapple","snack",2,"Sweet, high protein snack.",["high protein","no cook"],
  [("Cottage cheese, low fat",200),("Pineapple",100)],["Top cottage cheese with pineapple chunks."]),
 ("Apple and peanut butter","snack",2,"Classic pre-workout snack.",["quick"],
  [("Apple",182),("Peanut butter",20)],["Slice the apple and dip in peanut butter."]),
 ("Protein shake and banana","snack",2,"Post-workout in under a minute.",["high protein","post-workout"],
  [("Whey protein powder",30),("Milk, semi-skimmed",300),("Banana",118)],["Shake whey with milk.","Have the banana alongside."]),
 ("Rice cakes with almond butter","snack",3,"Crunchy and quick.",["quick"],
  [("Rice cakes",27),("Almond butter",15),("Strawberries",60)],["Spread almond butter on rice cakes and top with sliced strawberries."]),
 ("Skyr with berries and almonds","snack",3,"High protein, high fibre.",["high protein","no cook"],
  [("Skyr, plain",170),("Raspberries",80),("Almonds",15)],["Top skyr with raspberries and chopped almonds."]),
 ("Hummus and veg sticks","snack",5,"Crunchy, plant-based snack.",["vegan","no cook"],
  [("Hummus",60),("Carrot",80),("Cucumber",80),("Bell pepper",60)],["Cut veg into sticks and serve with hummus."]),
 ("Boiled eggs and edamame","snack",10,"Savoury protein snack.",["high protein"],
  [("Eggs, whole",100),("Edamame",100)],["Boil eggs for 8 minutes.","Steam edamame and season with salt."]),
 ("Dark chocolate and almonds","snack",1,"A sweet treat that fits.",["sweet"],
  [("Dark chocolate 70%",20),("Almonds",20)],["Enjoy slowly."]),
]

def macros(ings):
    t = [0, 0, 0, 0]
    for name, g in ings:
        f = FOOD[name]
        for i, k in enumerate((3, 4, 5, 6)):
            t[i] += f[k] * g / 100
    return [round(t[0]), round(t[1], 1), round(t[2], 1), round(t[3], 1)]

def ing_label(name, g):
    unit = 'ml' if name.startswith(('Milk', 'Almond milk', 'Orange juice')) else 'g'
    label = name if name.startswith(('Greek', 'BBQ', 'Dijon')) else name[0].lower() + name[1:]
    return f"{g} {unit} {label}"

# ---------- workouts: key, name, format, duration, rounds, description, items ----------
# item: (exercise, group, sets, reps, pct, rest, notes)
W = [
 ("fb_a","Full body A","standard",50,None,"Beginner full-body session built on the main movement patterns.",[
   ("Goblet squat","",3,"10",None,90,""),("Dumbbell bench press","",3,"10",None,90,""),("Seated cable row","",3,"12",None,90,""),
   ("Romanian deadlift","",3,"10",None,90,""),("Plank","",3,"30 s",None,60,"")]),
 ("fb_b","Full body B","standard",50,None,"Second beginner full-body session to alternate with A.",[
   ("Leg press","",3,"12",None,90,""),("Lat pulldown","",3,"10",None,90,""),("Seated dumbbell shoulder press","",3,"10",None,90,""),
   ("Glute bridge","",3,"12",None,60,""),("Dead bug","",3,"10 per side",None,45,"")]),
 ("push","Push","standard",60,None,"Chest, shoulders and triceps.",[
   ("Barbell bench press","",4,"6-8",75,150,"Last set: 1-2 reps in reserve"),("Incline dumbbell press","",3,"10",None,90,""),
   ("Overhead press","",3,"8",None,120,""),("Lateral raise","",3,"15",None,60,""),
   ("Triceps pushdown","A",3,"12",None,0,"Superset with A2"),("Overhead triceps extension","A",3,"12",None,75,"")]),
 ("pull","Pull","standard",60,None,"Back, rear delts and biceps.",[
   ("Deadlift","",3,"5",80,180,""),("Pull-up","",4,"max",None,120,"Use a band if needed"),("Barbell row","",3,"8",None,90,""),
   ("Face pull","",3,"15",None,60,""),("Hammer curl","A",3,"12",None,0,"Superset with A2"),("Barbell curl","A",3,"10",None,75,"")]),
 ("legs","Legs","standard",65,None,"Quads, hamstrings, glutes and calves.",[
   ("Back squat","",4,"6",75,180,""),("Romanian deadlift","",3,"8",None,120,""),("Bulgarian split squat","",3,"10 per leg",None,90,""),
   ("Lying leg curl","",3,"12",None,60,""),("Standing calf raise","",4,"15",None,45,"")]),
 ("upper","Upper strength","standard",60,None,"Heavy upper-body compounds.",[
   ("Barbell bench press","",5,"5",80,180,""),("Barbell row","",5,"5",None,150,""),("Overhead press","",3,"8",None,120,""),
   ("Chin-up","",3,"8",None,90,""),("Dips","",3,"max",None,90,"")]),
 ("lower","Lower strength","standard",60,None,"Heavy lower-body compounds.",[
   ("Back squat","",5,"5",80,180,""),("Romanian deadlift","",3,"8",None,120,""),("Walking lunge","",3,"12 per leg",None,90,""),
   ("Hip thrust","",3,"10",None,90,""),("Hanging leg raise","",3,"12",None,60,"")]),
 ("fxf_a","5x5 A","standard",55,None,"Classic linear strength day A.",[
   ("Back squat","",5,"5",80,180,""),("Barbell bench press","",5,"5",80,180,""),("Barbell row","",5,"5",None,150,"")]),
 ("fxf_b","5x5 B","standard",55,None,"Classic linear strength day B.",[
   ("Back squat","",5,"5",80,180,""),("Overhead press","",5,"5",80,180,""),("Deadlift","",1,"5",85,0,"")]),
 ("metcon","Metcon circuit","circuit",30,4,"4 rounds, move between exercises with minimal rest, 90 s between rounds.",[
   ("Kettlebell swing","A",None,"15",None,0,""),("Push-up","A",None,"12",None,0,""),("Jump squat","A",None,"12",None,0,""),
   ("Mountain climber","A",None,"30 s",None,0,""),("Rowing machine","A",None,"250 m",None,90,"Rest after the row")]),
 ("amrap20","20-minute AMRAP","amrap",20,None,"As many rounds as possible in 20 minutes. Log your rounds.",[
   ("Burpee","A",None,"10",None,0,""),("Goblet squat","A",None,"15",None,0,""),("Medicine ball slam","A",None,"12",None,0,""),
   ("Assault bike","A",None,"12 cal",None,0,"")]),
 ("emom16","EMOM 16","emom",16,None,"Every minute on the minute, rotate through the four stations.",[
   ("Kettlebell swing","A",None,"15",None,0,"Minute 1"),("Push-up","A",None,"12",None,0,"Minute 2"),
   ("Box jump","A",None,"10",None,0,"Minute 3"),("Plank","A",None,"40 s",None,0,"Minute 4")]),
 ("home","Home bodyweight","standard",35,None,"No equipment needed.",[
   ("Push-up","",4,"12",None,60,""),("Reverse lunge","",3,"10 per leg",None,60,""),("Glute bridge","",3,"15",None,45,""),
   ("Burpee","",3,"10",None,60,""),("Plank","",3,"40 s",None,45,""),("Mountain climber","",3,"30 s",None,45,"")]),
 ("mobility","Mobility flow","standard",20,None,"Recovery-day mobility, move slowly and breathe.",[
   ("World's greatest stretch","",2,"5 per side",None,0,""),("Hip 90/90","",2,"8",None,0,""),("Cat-cow","",2,"10",None,0,""),
   ("Thoracic rotation","",2,"8 per side",None,0,""),("Couch stretch","",2,"45 s per side",None,0,""),("Deep squat hold","",2,"60 s",None,0,"")]),
 ("intervals","Treadmill intervals","intervals",25,None,"Warm up 5 minutes, then 8 rounds of 1 minute hard, 1 minute easy.",[
   ("Treadmill run","",8,"60 s hard / 60 s easy",None,0,"Hard = 8/10 effort")]),
 ("core","Core finisher","standard",15,None,"Short core session to add after any workout.",[
   ("Ab wheel rollout","",3,"10",None,45,""),("Pallof press","",3,"12 per side",None,45,""),
   ("Hollow hold","",3,"30 s",None,45,""),("Side plank","",3,"30 s per side",None,45,"")]),
]

# ---------- programmes: key, name, goal, level, weeks, description, schedule(week -> [(day, workout_key)]) ----------
def every_week(weeks, days): return {w: days for w in range(1, weeks + 1)}
P = [
 ("beginner","Beginner full body","General fitness","Beginner",4,"Three full-body sessions a week alternating A and B.",
  {w: ([(1,"fb_a"),(3,"fb_b"),(5,"fb_a")] if w % 2 else [(1,"fb_b"),(3,"fb_a"),(5,"fb_b")]) for w in range(1, 5)}),
 ("ppl","Push pull legs","Muscle gain","Intermediate",6,"Six days a week, each muscle group twice.",
  every_week(6,[(1,"push"),(2,"pull"),(3,"legs"),(4,"push"),(5,"pull"),(6,"legs")])),
 ("upper_lower","Upper / lower strength","Strength","Intermediate",8,"Four heavy days a week.",
  every_week(8,[(1,"upper"),(2,"lower"),(4,"upper"),(5,"lower")])),
 ("five_by_five","Classic 5x5","Strength","Beginner",8,"Three days a week alternating A and B with steady load increases.",
  {w: ([(1,"fxf_a"),(3,"fxf_b"),(5,"fxf_a")] if w % 2 else [(1,"fxf_b"),(3,"fxf_a"),(5,"fxf_b")]) for w in range(1, 9)}),
 ("fat_loss","Fat loss conditioning","Fat loss","All levels",4,"Strength plus conditioning and a mobility day.",
  every_week(4,[(1,"fb_a"),(2,"metcon"),(4,"amrap20"),(5,"intervals"),(6,"mobility")])),
 ("home","Home training","General fitness","All levels",4,"No-equipment plan with a mobility day.",
  every_week(4,[(1,"home"),(3,"home"),(5,"home"),(7,"mobility")])),
]

if __name__ == '__main__':
    ex_names = {e[0] for e in EX}
    out = ["-- PTPN built-in library. Safe to re-run (deterministic ids, on conflict do nothing).",
           "create or replace function pg_temp.sid(t text) returns uuid language sql immutable as $$ select extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11'::uuid, t) $$;", ""]
    out.append("insert into public.exercises (id, name, muscle, equipment, category, instructions) values")
    out.append(",\n".join(f"({(uid('ex',n))},{q(n)},{q(m)},{q(eq)},{q(c)},{q(cue)})" for n,m,eq,c,cue in EX) + "\non conflict (id) do nothing;\n")
    out.append("insert into public.foods (id, name, serving_label, serving_g, kcal, protein, carbs, fat) values")
    out.append(",\n".join(f"({(uid('food',n))},{q(n)},{q(sl)},{g},{k},{p},{c},{f})" for n,sl,g,k,p,c,f in FOODS) + "\non conflict (id) do nothing;\n")
    rows = []
    for n, meal, prep, desc, tags, ings, steps in RECIPES:
        k, p, c, f = macros(ings)
        rows.append(f"({(uid('recipe',n))},{q(n)},{q(meal)},{q(desc)},{prep},{k},{p},{c},{f},{arr([ing_label(a,b) for a,b in ings])},{arr(steps)},{arr(tags)})")
    out.append("insert into public.recipes (id, name, meal_type, description, prep_min, kcal, protein, carbs, fat, ingredients, steps, tags) values")
    out.append(",\n".join(rows) + "\non conflict (id) do nothing;\n")
    out.append("insert into public.workouts (id, name, format, duration_min, rounds, description) values")
    out.append(",\n".join(f"({(uid('w',k))},{q(n)},{q(fm)},{d if d else 'null'},{r if r else 'null'},{q(desc)})" for k,n,fm,d,r,desc,_ in W) + "\non conflict (id) do nothing;\n")
    items = []
    for k, n, fm, d, r, desc, its in W:
        for i, (ex, grp, sets, reps, pct, rest, notes) in enumerate(its):
            assert ex in ex_names, ex
            items.append(f"({(uid('wi',k+':'+str(i)))},{(uid('w',k))},{(uid('ex',ex))},{q(ex)},{i},{q(grp)},{sets if sets else 'null'},{q(reps)},{pct if pct else 'null'},{rest if rest is not None else 'null'},{q(notes)})")
    out.append("insert into public.workout_items (id, workout_id, exercise_id, exercise_name, sort, group_label, sets, reps, percent_1rm, rest_sec, notes) values")
    out.append(",\n".join(items) + "\non conflict (id) do nothing;\n")
    out.append("insert into public.programs (id, name, goal, level, weeks, description) values")
    out.append(",\n".join(f"({(uid('p',k))},{q(n)},{q(g)},{q(l)},{w},{q(desc)})" for k,n,g,l,w,desc,_ in P) + "\non conflict (id) do nothing;\n")
    days = []
    for k, n, g, l, w, desc, sched in P:
        for week, ds in sched.items():
            for day, wk in ds:
                days.append(f"({(uid('pd',f'{k}:{week}:{day}:{wk}'))},{(uid('p',k))},{week},{day},{(uid('w',wk))})")
    out.append("insert into public.program_days (id, program_id, week, day, workout_id) values")
    out.append(",\n".join(days) + "\non conflict (id) do nothing;\n")

    open(sys.argv[1], 'w').write("\n".join(out))
    print(f"exercises {len(EX)}, foods {len(FOODS)}, recipes {len(RECIPES)}, workouts {len(W)}, items {len(items)}, programs {len(P)}, program days {len(days)}")
    for r in RECIPES:
        print(f"  {r[0]:34s} {macros(r[5])}")
