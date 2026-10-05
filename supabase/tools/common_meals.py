"""28 everyday healthy meal ideas (7 each of breakfast, lunch, dinner, snack), most common first.
Original recipes; macros are computed from the food list. Photo keys point into supabase/data/photos.json."""

NEW_FOODS = [
    ("Mixed nuts", "1 handful (30 g)", 30, 607, 20, 21, 54),
    ("Popcorn, air-popped", "1 bowl (25 g)", 25, 387, 12, 78, 4.5),
    ("Wholemeal crackers", "4 crackers (25 g)", 25, 413, 11, 64, 12),
    ("Baked beans", "1/2 can (200 g)", 200, 90, 4.7, 15.5, 0.4),
    ("Potato, baked", "1 medium (220 g)", 220, 93, 2.5, 21, 0.1),
    ("Olives", "10 olives (40 g)", 40, 115, 0.8, 6, 11),
]

# name, meal, prep, description, tags, [(food, grams)], [extras], steps, photo_key
R = []
def r(name, meal, prep, desc, tags, ings, extras, steps, photo):
    R.append((name, meal, prep, desc, tags, ings, extras, steps, photo))

# ---------- breakfast ----------
r("Banana and peanut butter porridge", "breakfast", 8, "Creamy oats cooked in milk with sliced banana and a spoon of peanut butter.", ["quick", "high fibre"],
  [("Oats, dry", 60), ("Milk, semi-skimmed", 250), ("Banana", 100), ("Peanut butter", 15), ("Honey", 5)], ["1/4 tsp ground cinnamon"],
  ["Heat the oats and milk in a pan, stirring, for 4 to 5 minutes until thick.", "Pour into a bowl and top with sliced banana.", "Swirl in the peanut butter and honey and finish with cinnamon."], "porridge")
r("Poached eggs on toast with spinach", "breakfast", 10, "Three soft eggs on wholemeal toast over wilted spinach.", ["high protein", "quick"],
  [("Eggs, whole", 150), ("Wholemeal bread", 70), ("Spinach", 60), ("Butter", 5)], ["1 tsp white vinegar", "black pepper to taste"],
  ["Wilt the spinach in a dry pan for a minute and set aside.", "Poach the eggs in barely simmering water with a splash of vinegar for 3 minutes.", "Toast and lightly butter the bread, top with spinach and the eggs."], "eggs-toast")
r("Avocado and egg toast", "breakfast", 10, "Mashed avocado and tomato on wholemeal toast with a fried or boiled egg.", ["vegetarian", "quick"],
  [("Wholemeal bread", 70), ("Avocado", 70), ("Eggs, whole", 100), ("Tomato", 60)], ["1 tsp lemon juice", "pinch of chilli flakes"],
  ["Toast the bread and mash the avocado with lemon juice and a pinch of salt.", "Cook the eggs the way you like them.", "Spread the avocado on the toast and top with tomato, the eggs and chilli flakes."], "avocado-toast")
r("Banana and spinach protein smoothie", "breakfast", 5, "A thick green smoothie with whey and oats that keeps you full.", ["high protein", "no cook"],
  [("Banana", 120), ("Spinach", 40), ("Milk, semi-skimmed", 250), ("Whey protein powder", 30), ("Oats, dry", 30)], ["4 ice cubes"],
  ["Add the milk, banana, spinach, whey and oats to a blender.", "Blend with a handful of ice until completely smooth.", "Drink straight away."], "smoothie-green")
r("Egg breakfast burrito", "breakfast", 12, "Scrambled eggs, black beans and cheese rolled in a warm tortilla.", ["high protein", "mexican"],
  [("Tortilla wrap", 62), ("Eggs, whole", 150), ("Black beans, cooked", 60), ("Salsa", 40), ("Cheddar cheese", 15)], ["1/2 tsp smoked paprika"],
  ["Warm the beans with a pinch of paprika.", "Scramble the eggs in a non-stick pan until just set.", "Fill the tortilla with eggs, beans, cheese and salsa, fold in the ends and roll."], "burrito")
r("Veggie egg muffins", "breakfast", 30, "Baked egg cups packed with pepper and spinach, served with toast.", ["meal prep", "high protein"],
  [("Eggs, whole", 200), ("Bell pepper", 60), ("Spinach", 40), ("Cheddar cheese", 25), ("Wholemeal bread", 35)], ["black pepper to taste"],
  ["Heat the oven to 180C and grease a muffin tin.", "Whisk the eggs, then stir in chopped pepper, spinach and cheese and pour into the tin.", "Bake for 18 to 20 minutes and serve with toast. They keep for three days in the fridge."], "egg-muffins")
r("Berry chia pudding", "breakfast", 5, "Make it the night before: chia soaked in milk and yogurt, topped with berries.", ["meal prep", "no cook"],
  [("Chia seeds", 30), ("Milk, semi-skimmed", 200), ("Greek yogurt 0% fat", 100), ("Blueberries", 80), ("Honey", 8), ("Almonds", 10)], ["1/2 tsp vanilla extract"],
  ["Stir the chia, milk, yogurt, honey and vanilla together in a jar.", "Leave in the fridge overnight, stirring once after 10 minutes.", "Top with blueberries and chopped almonds."], "chia-pudding")

# ---------- lunch ----------
r("Chicken, rice and broccoli meal prep box", "lunch", 25, "The classic lunch box: plain, filling and easy to batch for the week.", ["meal prep", "high protein"],
  [("Chicken breast, cooked", 150), ("White rice, cooked", 150), ("Broccoli", 120), ("Olive oil", 5)], ["1/2 lemon", "1/2 tsp garlic powder", "black pepper to taste"],
  ["Season the chicken with garlic powder and pepper and bake or grill until cooked through.", "Steam the broccoli for 4 minutes.", "Pack with the rice, drizzle the oil and squeeze over lemon."], "bowl-chicken-rice")
r("Chicken salad sandwich", "lunch", 10, "Shredded chicken in a light yogurt and mustard dressing on wholemeal bread.", ["quick", "high protein"],
  [("Wholemeal bread", 80), ("Chicken breast, cooked", 100), ("Greek yogurt 0% fat", 30), ("Mixed salad leaves", 30), ("Tomato", 50), ("Dijon mustard", 5), ("Apple", 130)], ["black pepper to taste"],
  ["Mix the shredded chicken with the yogurt, mustard and pepper.", "Layer onto the bread with leaves and sliced tomato.", "Serve with the apple."], "chicken-sandwich")
r("Cheesy bean jacket potato", "lunch", 55, "A baked potato topped with warm baked beans and a little melted cheese.", ["vegetarian", "budget"],
  [("Potato, baked", 250), ("Baked beans", 150), ("Cheddar cheese", 30), ("Mixed salad leaves", 40)], ["black pepper to taste"],
  ["Prick the potato and bake at 200C for about 50 minutes (or microwave for 8 to 10 minutes).", "Warm the beans.", "Split the potato, pile on the beans and cheese and serve with the leaves."], "jacket-potato")
r("Greek salad with grilled chicken", "lunch", 15, "Crisp cucumber, tomato, feta and olives with sliced chicken and a little bread.", ["high protein", "mediterranean"],
  [("Chicken breast, cooked", 130), ("Cucumber", 100), ("Tomato", 120), ("Feta", 40), ("Olives", 30), ("Onion", 20), ("Olive oil", 8), ("Wholemeal bread", 40)], ["1/2 tsp dried oregano", "1 tbsp lemon juice"],
  ["Chop the cucumber, tomato and onion into chunks and add the olives.", "Toss with olive oil, lemon juice and oregano and crumble over the feta.", "Top with sliced chicken and serve with the bread."], "greek-salad")
r("Egg and avocado wrap", "lunch", 10, "Chopped boiled eggs, avocado and spinach in a tortilla.", ["vegetarian", "quick"],
  [("Tortilla wrap", 62), ("Eggs, whole", 150), ("Avocado", 60), ("Spinach", 30), ("Tomato", 60), ("Greek yogurt 0% fat", 30)], ["1 tsp lemon juice", "black pepper to taste"],
  ["Boil the eggs for 8 minutes, cool and chop.", "Mash the avocado with the yogurt and lemon juice and mix in the eggs.", "Spoon onto the wrap with spinach and tomato and roll up."], "egg-avocado-wrap")
r("Minestrone soup with wholemeal bread", "lunch", 30, "A thick vegetable, bean and pasta soup with a slice of bread.", ["vegetarian", "one pot"],
  [("Kidney beans, cooked", 100), ("Chopped tomatoes, canned", 200), ("Carrot", 60), ("Courgette", 80), ("Pasta, cooked", 80), ("Onion", 40), ("Green beans", 50), ("Parmesan", 8), ("Wholemeal bread", 50), ("Olive oil", 5)], ["400 ml vegetable stock", "1 clove garlic", "1 tsp dried basil"],
  ["Soften the onion, carrot and garlic in the oil for 5 minutes.", "Add the tomatoes, stock, courgette, green beans and kidney beans and simmer for 15 minutes.", "Stir in the cooked pasta, serve with parmesan and the bread."], "minestrone")
r("Tuna and sweetcorn pasta", "lunch", 15, "A quick yogurt-dressed pasta with tuna, sweetcorn and tomatoes.", ["quick", "high protein"],
  [("Pasta, cooked", 200), ("Tuna, canned in water, drained", 120), ("Sweetcorn", 60), ("Greek yogurt 0% fat", 60), ("Tomato", 80), ("Olive oil", 5), ("Mixed salad leaves", 20)], ["1 tbsp lemon juice", "black pepper to taste"],
  ["Cook the pasta, drain and let it cool a little.", "Mix the yogurt with lemon juice, oil and pepper.", "Toss through the pasta with the tuna, sweetcorn and chopped tomato and serve on the leaves."], "tuna-pasta")

# ---------- dinner ----------
r("Baked chicken with sweet potato and green beans", "dinner", 40, "Simple oven-baked chicken breast with roasted sweet potato wedges.", ["high protein", "one pan"],
  [("Chicken breast, cooked", 180), ("Sweet potato, baked", 200), ("Green beans", 120), ("Olive oil", 6)], ["1/2 tsp paprika", "1/2 tsp garlic powder", "black pepper to taste"],
  ["Heat the oven to 200C. Toss the sweet potato wedges in half the oil and roast for 15 minutes.", "Rub the chicken with the rest of the oil and the spices, add to the tray and roast for 20 to 25 minutes.", "Steam the green beans and serve everything together."], "chicken-sweet-potato")
r("Chicken fajitas", "dinner", 25, "Sizzling chicken, peppers and onion in warm tortillas with salsa and yogurt.", ["high protein", "mexican"],
  [("Chicken breast, cooked", 140), ("Bell pepper", 120), ("Onion", 60), ("Tortilla wrap", 93), ("Salsa", 40), ("Greek yogurt 0% fat", 40), ("Cheddar cheese", 10), ("Avocado", 25), ("Olive oil", 4)], ["2 tsp fajita seasoning", "1/2 lime"],
  ["Slice the chicken, peppers and onion into strips and toss with the oil and seasoning.", "Fry in a hot pan for 6 to 8 minutes until charred.", "Fill the warm tortillas and top with salsa, yogurt, cheese and avocado."], "fajitas")
r("Lean shepherd's pie", "dinner", 50, "Lean beef and vegetable filling under a light mash topping.", ["comfort", "meal prep"],
  [("Beef mince 5% fat, cooked", 150), ("Potato, boiled", 250), ("Carrot", 60), ("Peas, frozen", 60), ("Onion", 50), ("Chopped tomatoes, canned", 100), ("Milk, semi-skimmed", 30), ("Cheddar cheese", 10)], ["1 tbsp worcestershire sauce", "150 ml beef stock", "1/2 tsp dried thyme"],
  ["Brown the mince with the onion and carrot, then add the tomatoes, stock, worcestershire and thyme and simmer for 15 minutes with the peas.", "Mash the potato with the milk and pepper.", "Spoon the mince into a dish, cover with the mash and cheese and bake at 200C for 20 minutes."], "shepherds-pie")
r("Grilled salmon with new potatoes and asparagus", "dinner", 25, "A fillet of salmon with buttery potatoes and charred asparagus.", ["omega-3", "high protein"],
  [("Salmon fillet, cooked", 150), ("Potato, boiled", 200), ("Asparagus", 120), ("Olive oil", 5)], ["1/2 lemon", "1 tbsp fresh dill", "black pepper to taste"],
  ["Boil the potatoes for 15 minutes.", "Grill or pan-fry the salmon for 4 minutes each side and griddle the asparagus with the oil.", "Serve with lemon and dill."], "salmon-asparagus")
r("Stuffed peppers with beef and rice", "dinner", 45, "Roasted peppers filled with seasoned mince, rice and melted mozzarella.", ["high protein", "meal prep"],
  [("Bell pepper", 250), ("Beef mince 5% fat, cooked", 120), ("White rice, cooked", 120), ("Chopped tomatoes, canned", 100), ("Onion", 40), ("Mozzarella", 30)], ["1 tsp smoked paprika", "1 clove garlic"],
  ["Halve the peppers and remove the seeds.", "Mix the mince, rice, tomatoes, onion, garlic and paprika and spoon into the pepper halves.", "Top with mozzarella and bake at 200C for 30 minutes."], "stuffed-peppers")
r("Vegetable and bean chilli with rice", "dinner", 35, "A big pot of two-bean chilli with pepper and courgette.", ["vegetarian", "meal prep"],
  [("Kidney beans, cooked", 100), ("Black beans, cooked", 80), ("Chopped tomatoes, canned", 200), ("Bell pepper", 100), ("Onion", 50), ("Courgette", 80), ("Brown rice, cooked", 160), ("Cheddar cheese", 20), ("Greek yogurt 0% fat", 30)], ["1 tsp chilli powder", "1 tsp ground cumin", "1 clove garlic"],
  ["Soften the onion, pepper and courgette with garlic, chilli and cumin.", "Add the tomatoes and beans and simmer for 20 minutes.", "Serve over rice with grated cheese and a spoon of yogurt."], "bean-chilli")
r("Grilled pork loin with roast potatoes and broccoli", "dinner", 40, "Lean pork with crisp roast potatoes and steamed broccoli.", ["high protein", "weekend"],
  [("Pork tenderloin, cooked", 170), ("Potato, boiled", 220), ("Broccoli", 120), ("Olive oil", 8)], ["1 sprig rosemary", "1 clove garlic", "black pepper to taste"],
  ["Roast the halved potatoes with half the oil and rosemary at 210C for 35 minutes.", "Rub the pork with the remaining oil, garlic and pepper and grill or roast for 20 minutes, then rest and slice.", "Steam the broccoli and serve together."], "pork-roast")

# ---------- snacks ----------
r("Banana", "snack", 1, "The easiest grab-and-go snack.", ["no cook", "quick"],
  [("Banana", 120)], [], ["Peel and eat. Pair with a handful of nuts if you need more staying power."], "banana")
r("Handful of mixed nuts", "snack", 1, "A palm-sized portion of almonds, walnuts, cashews and peanuts.", ["no cook", "healthy fats"],
  [("Mixed nuts", 30)], [], ["Measure out 30 g so it stays a snack and not a meal."], "mixed-nuts")
r("Cheese and wholemeal crackers", "snack", 3, "A small cheddar slice stack on wholemeal crackers with a few grapes.", ["quick", "no cook"],
  [("Cheddar cheese", 30), ("Wholemeal crackers", 25), ("Grapes", 60)], [],
  ["Slice the cheese and lay it on the crackers.", "Serve with the grapes."], "cheese-crackers")
r("Protein bar", "snack", 1, "A ready-made bar for when you are out and about.", ["no cook", "high protein"],
  [("Protein bar", 60)], [], ["Check the label: aim for around 20 g protein and under 4 g sugar."], "protein-bar")
r("Air-popped popcorn", "snack", 5, "A big bowl of plain popcorn for very few calories.", ["low calorie", "high fibre"],
  [("Popcorn, air-popped", 25)], ["pinch of salt"], ["Pop the kernels in an air popper or a covered pan with no oil.", "Season with a pinch of salt."], "popcorn")
r("Clementines", "snack", 2, "Two easy-peel citrus fruits with a good dose of vitamin C.", ["no cook", "low calorie"],
  [("Orange", 160)], [], ["Peel and eat."], "clementines")
r("Turkey and cucumber roll-ups", "snack", 5, "Sliced turkey rolled around cucumber and a little cream cheese.", ["high protein", "low calorie"],
  [("Turkey breast, cooked", 60), ("Cucumber", 60), ("Light cream cheese", 20)], ["black pepper to taste"],
  ["Spread the cream cheese on the turkey slices.", "Lay a cucumber stick on each and roll up."], "turkey-rolls")

assert len(R) == 28
