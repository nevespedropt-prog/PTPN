"""Original rewrites of the dishes from the ten newest Tastes Better From Scratch weekly plans (see
supabase/data/tbfs-meal-plans.json). Names, steps and descriptions are written fresh, ingredient weights are
re-balanced for training diets, and macros are computed from the food list, never copied.

Dish tuple: key -> (name, prep_min, description, tags, ingredients[(food, grams)], extras[str], steps[str], inspired_by, photo_key)
"""

# name, serving label, serving_g, kcal, protein, carbs, fat  (all macros per 100 g, typical published values, rounded)
NEW_FOODS = [
    ("Corn tortilla", "1 tortilla (26 g)", 26, 218, 5.7, 44.6, 2.9),
    ("Flank steak, cooked", "100 g", 100, 192, 27.5, 0, 8.6),
    ("Turkey mince, cooked", "100 g", 100, 190, 27, 0, 9),
    ("Chicken sausage, cooked", "1 sausage (70 g)", 70, 170, 16, 3, 10),
    ("Soy sauce", "1 tbsp (15 g)", 15, 60, 6, 6, 0),
    ("Light coconut milk", "100 ml", 100, 70, 0.7, 2.8, 6.8),
    ("Curry paste", "1 tbsp (15 g)", 15, 100, 2.5, 14, 3.5),
    ("Gnocchi, cooked", "100 g", 100, 133, 3.4, 29, 0.5),
    ("Cheese tortellini, cooked", "100 g", 100, 200, 8.5, 29, 5.5),
    ("Chicken dumplings, cooked", "5 dumplings (100 g)", 100, 215, 9.5, 28, 7),
    ("Matzo meal", "30 g", 30, 365, 10.5, 78, 1.5),
    ("Cabbage", "80 g", 80, 25, 1.3, 5.8, 0.1),
    ("Braising beef, cooked lean", "100 g", 100, 230, 30, 0, 12),
    ("Light cream cheese", "30 g", 30, 150, 9, 6, 10),
    ("Pizza dough, baked", "100 g", 100, 270, 9, 50, 3),
    ("Wholemeal pita", "1 pita (60 g)", 60, 255, 10, 51, 2.6),
    ("Wholemeal burger bun", "1 bun (70 g)", 70, 265, 11, 46, 4.5),
    ("Salsa", "2 tbsp (40 g)", 40, 36, 1.5, 7.5, 0.2),
    ("Dijon mustard", "1 tsp (5 g)", 5, 66, 4, 5.8, 3.6),
    ("BBQ sauce", "1 tbsp (17 g)", 17, 150, 0.8, 36, 0.6),
    ("Plain flour", "30 g", 30, 364, 10, 76, 1),
    ("Breadcrumbs", "30 g", 30, 395, 13, 72, 5),
    ("Tortilla chips", "30 g", 30, 490, 7, 63, 24),
    ("Tomato ketchup", "1 tbsp (17 g)", 17, 100, 1.2, 25, 0.1),
]

D = {}


def dish(key, name, prep, desc, tags, ings, extras, steps, inspired, photo):
    D[key] = (name, prep, desc, tags, ings, extras, steps, inspired, photo)


# ---------- Plan 215 ----------
dish("carne_asada", "Lean carne asada tacos", 25, "Citrus-marinated flank steak in corn tortillas with fresh toppings.", ["high protein", "mexican"],
     [("Flank steak, cooked", 150), ("Corn tortilla", 78), ("Onion", 40), ("Tomato", 60), ("Avocado", 40), ("Salsa", 40), ("Greek yogurt 0% fat", 30)],
     ["lime juice", "garlic", "ground cumin", "fresh coriander"],
     ["Marinate the steak in lime juice, garlic and cumin for 30 minutes.", "Sear in a hot pan for 3 to 4 minutes per side, rest, then slice thinly across the grain.", "Warm the tortillas and fill with steak, onion, tomato, avocado, salsa and a spoon of yogurt."],
     "Carne Asada Tacos", "tacos-beef")
dish("general_tso", "Lighter General Tso's chicken", 25, "Sticky ginger-soy chicken with broccoli, baked instead of deep-fried.", ["high protein", "asian"],
     [("Chicken breast, cooked", 170), ("Broccoli", 120), ("White rice, cooked", 150), ("Soy sauce", 15), ("Honey", 12), ("Carrot", 40), ("Olive oil", 5)],
     ["fresh ginger", "garlic", "rice vinegar", "chilli flakes"],
     ["Cube the chicken and brown it in a hot pan with the oil.", "Stir together soy sauce, honey, vinegar, ginger and garlic, pour over and simmer until glossy.", "Steam the broccoli and carrot, then serve everything over rice."],
     "General Tso's Chicken", "asian-chicken-rice")
dish("tortellini_soup", "Creamy tomato tortellini soup", 25, "Tomato soup enriched with a little cream cheese, cheese tortellini and spinach.", ["comfort", "one pot"],
     [("Cheese tortellini, cooked", 120), ("Chopped tomatoes, canned", 200), ("Spinach", 60), ("Light cream cheese", 30), ("Chicken breast, cooked", 100), ("Onion", 40), ("Parmesan", 8)],
     ["garlic", "chicken or vegetable stock", "dried basil"],
     ["Soften the onion and garlic, add the tomatoes and a cup of stock and simmer for 10 minutes.", "Blend until smooth, stir in the cream cheese, then add the tortellini and shredded chicken.", "Wilt in the spinach and finish with parmesan."],
     "Creamy Tortellini Soup", "soup-tortellini")
dish("ham_fried_rice", "Ham and egg fried rice", 15, "Fast fried rice built on lean ham, eggs and plenty of veg.", ["quick", "meal prep"],
     [("Ham, sliced", 100), ("White rice, cooked", 200), ("Eggs, whole", 100), ("Peas, frozen", 60), ("Carrot", 50), ("Soy sauce", 15), ("Olive oil", 8)],
     ["spring onions", "garlic"],
     ["Heat the oil in a wok and scramble the eggs, then set aside.", "Stir-fry the carrot, peas and chopped ham for 2 minutes.", "Add the cold rice, soy sauce and eggs and toss until piping hot."],
     "Ham Fried Rice", "fried-rice")
dish("honey_mustard_chicken", "Honey mustard chicken with potatoes", 35, "Sheet-pan chicken with a light honey and mustard glaze.", ["high protein", "one pan"],
     [("Chicken breast, cooked", 180), ("Honey", 12), ("Dijon mustard", 15), ("Potato, boiled", 200), ("Green beans", 120), ("Olive oil", 6)],
     ["garlic", "paprika"],
     ["Whisk the honey, mustard, garlic and paprika and coat the chicken.", "Roast the chicken and halved potatoes at 200C for 25 to 30 minutes.", "Steam the green beans and serve alongside."],
     "Honey Mustard Chicken", "chicken-roast")

# ---------- Plan 214 ----------
dish("tostadas", "Black bean and beef tostadas", 20, "Crisp corn tostadas piled with beans, lean beef and avocado.", ["mexican", "high protein"],
     [("Corn tortilla", 78), ("Black beans, cooked", 120), ("Beef mince 5% fat, cooked", 100), ("Avocado", 50), ("Mixed salad leaves", 30), ("Salsa", 40), ("Cheddar cheese", 15)],
     ["lime", "chilli powder"],
     ["Bake the tortillas at 200C for 6 to 8 minutes until crisp.", "Warm the beans and the beef mince with chilli powder.", "Layer beans, beef, leaves, salsa, cheese and sliced avocado on each tostada."],
     "Tostadas", "tostada")
dish("tortellini_salad", "Southwest tortellini pasta salad", 20, "Cold tortellini tossed with beans, corn and a yogurt-salsa dressing.", ["meal prep", "no cook"],
     [("Cheese tortellini, cooked", 150), ("Black beans, cooked", 80), ("Sweetcorn", 60), ("Tomato", 80), ("Bell pepper", 60), ("Greek yogurt 0% fat", 60), ("Salsa", 40), ("Chicken breast, cooked", 100)],
     ["lime juice", "coriander"],
     ["Cook the tortellini, drain and cool under cold water.", "Mix the yogurt, salsa and lime juice into a dressing.", "Toss everything together with the chopped veg, beans and chicken."],
     "Tortellini Pasta Salad", "pasta-salad")
dish("cajun_kebabs", "Cajun chicken and sausage kebabs", 30, "Spiced chicken and chicken sausage skewers with peppers, served on rice.", ["high protein", "bbq"],
     [("Chicken breast, cooked", 140), ("Chicken sausage, cooked", 70), ("Bell pepper", 100), ("Courgette", 80), ("Onion", 50), ("White rice, cooked", 150), ("Olive oil", 6)],
     ["cajun seasoning", "garlic powder"],
     ["Toss the chicken, sausage slices and chunks of veg with oil and cajun seasoning.", "Thread onto skewers and grill or griddle for 12 to 15 minutes, turning often.", "Serve on rice."],
     "Cajun Chicken & Sausage Kebabs", "kebabs")
dish("meatballs_arrabbiata", "Turkey meatballs arrabbiata", 35, "Spicy tomato sauce with baked turkey meatballs over pasta.", ["high protein", "meal prep"],
     [("Turkey mince, cooked", 150), ("Breadcrumbs", 15), ("Eggs, whole", 25), ("Chopped tomatoes, canned", 200), ("Pasta, cooked", 170), ("Onion", 40), ("Parmesan", 8)],
     ["garlic", "chilli flakes", "dried oregano"],
     ["Mix the turkey, breadcrumbs, egg and oregano, shape into balls and bake at 200C for 15 minutes.", "Simmer the tomatoes with garlic, onion and chilli for 15 minutes.", "Add the meatballs to the sauce and serve over pasta with parmesan."],
     "Meatballs Arrabiatta", "meatballs-pasta")
dish("smash_burger", "Smash burger with tomato and lettuce", 20, "Thin, crisp-edged beef patties on a wholemeal bun.", ["high protein", "quick"],
     [("Beef mince 5% fat, cooked", 140), ("Wholemeal burger bun", 70), ("Cheddar cheese", 20), ("Tomato", 60), ("Mixed salad leaves", 25), ("Potato, boiled", 150), ("Tomato ketchup", 10)],
     ["mustard", "pickles"],
     ["Roll the beef into two balls and smash flat in a very hot dry pan; season and cook 2 minutes per side.", "Melt the cheese on top and toast the bun.", "Build the burger and serve with roasted potato wedges."],
     "Smash Burger", "burger-smash")

# ---------- Plan 213 ----------
dish("walking_tacos", "Walking taco bowl", 20, "All the walking taco flavour with a handful of chips and lots of toppings in a bowl.", ["fun", "high protein"],
     [("Turkey mince, cooked", 140), ("Tortilla chips", 30), ("Black beans, cooked", 80), ("Salsa", 50), ("Mixed salad leaves", 40), ("Cheddar cheese", 20), ("Greek yogurt 0% fat", 40), ("Sweetcorn", 50)],
     ["taco seasoning"],
     ["Brown the turkey with taco seasoning and a splash of water.", "Crush the chips into the bowl, then spoon over the turkey and beans.", "Top with leaves, corn, salsa, cheese and yogurt."],
     "Walking Tacos", "tacos-beef")
dish("chicken_gnocchi", "Creamy chicken and gnocchi", 25, "Pan-fried gnocchi and chicken in a light creamy sauce with spinach.", ["comfort", "high protein"],
     [("Chicken breast, cooked", 150), ("Gnocchi, cooked", 170), ("Spinach", 60), ("Light cream cheese", 30), ("Milk, semi-skimmed", 100), ("Parmesan", 10), ("Olive oil", 5)],
     ["garlic", "black pepper"],
     ["Pan-fry the gnocchi in the oil until golden and set aside.", "Warm the milk with the cream cheese and garlic until smooth, add the chicken and spinach.", "Stir the gnocchi back in and top with parmesan."],
     "Creamy Chicken & Gnocchi", "gnocchi")
dish("veggie_wrap", "Hummus and edamame veggie wrap", 10, "A crunchy plant-based wrap with edamame, hummus and raw veg.", ["vegetarian", "no cook"],
     [("Tortilla wrap", 124), ("Hummus", 60), ("Edamame", 100), ("Carrot", 50), ("Cucumber", 60), ("Spinach", 30), ("Feta", 30)],
     ["lemon juice"],
     ["Spread the hummus over the wraps.", "Layer the edamame, grated carrot, cucumber, spinach and crumbled feta.", "Squeeze over lemon, roll tightly and slice in half."],
     "Veggie Wrap", "wrap-veggie")
dish("red_curry", "Chicken red curry", 30, "Fragrant red curry with light coconut milk and vegetables.", ["high protein", "asian"],
     [("Chicken breast, cooked", 160), ("Light coconut milk", 150), ("Curry paste", 20), ("Bell pepper", 80), ("Courgette", 80), ("White rice, cooked", 160), ("Green beans", 60)],
     ["fish sauce", "lime", "fresh basil"],
     ["Fry the curry paste for a minute, pour in the coconut milk and a splash of water.", "Add the chicken and vegetables and simmer for 12 minutes.", "Finish with lime and basil and serve over rice."],
     "Red Curry", "curry-red")
dish("kung_pao", "Kung pao chicken", 25, "Spicy-sweet stir-fry with peanuts, peppers and courgette.", ["high protein", "asian"],
     [("Chicken breast, cooked", 170), ("Peanuts", 25), ("Bell pepper", 100), ("Courgette", 80), ("White rice, cooked", 150), ("Soy sauce", 15), ("Honey", 8), ("Olive oil", 5)],
     ["garlic", "ginger", "dried chillies", "rice vinegar"],
     ["Stir-fry the chicken in oil until browned, then add the vegetables and chillies.", "Add soy sauce, honey, vinegar, garlic and ginger and toss for 2 minutes.", "Stir through the peanuts and serve on rice."],
     "Kung Pao Chicken", "stirfry-protein")

# ---------- Plan 212 ----------
dish("nourish_bowl", "Quinoa nourish bowl", 25, "A big plant-forward bowl: quinoa, roasted sweet potato, chickpeas and greens.", ["vegetarian", "high fibre"],
     [("Quinoa, cooked", 150), ("Sweet potato, baked", 150), ("Chickpeas, cooked", 120), ("Kale", 40), ("Avocado", 50), ("Greek yogurt 0% fat", 60), ("Feta", 20)],
     ["lemon juice", "paprika", "tahini (optional)"],
     ["Roast the sweet potato cubes and chickpeas with paprika at 200C for 25 minutes.", "Massage the kale with lemon juice.", "Build the bowl on the quinoa and finish with sliced avocado, feta and a yogurt drizzle."],
     "Nourish Bowls", "bowl-nourish")
dish("mushroom_tacos", "Mushroom and black bean tacos", 20, "Savoury seared mushrooms and beans in warm corn tortillas.", ["vegetarian", "mexican"],
     [("Corn tortilla", 78), ("Mushrooms", 200), ("Black beans, cooked", 120), ("Avocado", 50), ("Salsa", 40), ("Greek yogurt 0% fat", 50), ("Cheddar cheese", 20), ("Olive oil", 5)],
     ["smoked paprika", "lime", "coriander"],
     ["Sear the sliced mushrooms in the oil with smoked paprika until deeply browned.", "Warm the beans and tortillas.", "Fill with mushrooms and beans and top with avocado, salsa, yogurt and cheese."],
     "Mushroom Tacos", "tacos-veg")
dish("sloppy_joes", "Turkey sloppy joes", 25, "Saucy tomato-pepper turkey on a toasted wholemeal bun.", ["high protein", "family"],
     [("Turkey mince, cooked", 150), ("Wholemeal burger bun", 70), ("Chopped tomatoes, canned", 100), ("Onion", 40), ("Bell pepper", 60), ("Tomato ketchup", 15), ("Sweetcorn", 80)],
     ["worcestershire sauce", "garlic", "smoked paprika"],
     ["Soften the onion and pepper, add the turkey and cook until browned.", "Stir in the tomatoes, ketchup, worcestershire and spices and simmer for 10 minutes.", "Pile onto the toasted bun and serve with corn."],
     "Sloppy Joes", "sloppy-joe")
dish("dumpling_soup", "Chicken dumpling soup", 20, "A light ginger broth with dumplings, greens and carrots.", ["comfort", "quick"],
     [("Chicken dumplings, cooked", 180), ("Chicken breast, cooked", 80), ("Spinach", 50), ("Carrot", 50), ("Soy sauce", 10), ("Egg noodles, cooked", 80)],
     ["chicken stock", "fresh ginger", "spring onions"],
     ["Simmer the stock with ginger, soy sauce and carrot for 8 minutes.", "Add the dumplings and noodles and cook according to the pack.", "Stir in the shredded chicken and spinach and top with spring onions."],
     "Dumpling Soup", "soup-dumpling")
dish("thai_meatballs", "Thai green curry chicken meatballs", 35, "Baked chicken meatballs in a green curry coconut sauce.", ["high protein", "asian"],
     [("Chicken breast, cooked", 150), ("Breadcrumbs", 10), ("Eggs, whole", 25), ("Light coconut milk", 120), ("Curry paste", 15), ("Broccoli", 80), ("White rice, cooked", 150)],
     ["coriander", "lime", "fish sauce"],
     ["Mince or finely chop the chicken, mix with breadcrumbs, egg and coriander, shape into balls and bake for 15 minutes.", "Simmer the curry paste with the coconut milk, add the broccoli and meatballs.", "Serve with rice and a squeeze of lime."],
     "Thai Chicken Meatballs", "curry-green")

# ---------- Plan 211 ----------
dish("smothered_burritos", "Green chile chicken burritos", 30, "Chicken, beans and rice rolled up and finished with salsa and a little cheese.", ["mexican", "meal prep"],
     [("Tortilla wrap", 62), ("Chicken breast, cooked", 140), ("Black beans, cooked", 80), ("White rice, cooked", 100), ("Salsa", 80), ("Cheddar cheese", 25), ("Greek yogurt 0% fat", 40)],
     ["green chiles", "cumin"],
     ["Mix the chicken, beans and rice with cumin and a spoon of salsa.", "Roll in the tortilla, top with the rest of the salsa and cheese and bake at 200C for 12 minutes.", "Serve with a dollop of yogurt."],
     "Smothered Burritos", "burrito")
dish("chicken_avocado_wrap", "Chicken, bacon and avocado wrap", 10, "A satisfying wrap with just enough bacon for flavour.", ["quick", "high protein"],
     [("Tortilla wrap", 62), ("Chicken breast, cooked", 120), ("Avocado", 50), ("Bacon rashers, grilled", 25), ("Spinach", 30), ("Tomato", 60), ("Greek yogurt 0% fat", 40), ("Sweet potato, baked", 120)],
     ["lime juice", "black pepper"],
     ["Mash the avocado with the yogurt and lime juice.", "Spread over the wrap and add the chicken, crisp bacon, spinach and tomato.", "Roll up and serve with baked sweet potato."],
     "Chicken Avocado Wrap", "wrap-chicken")
dish("taco_salad", "Loaded taco salad", 20, "Crunchy leaves topped with seasoned beef, beans, corn and cheese.", ["high protein", "salad"],
     [("Beef mince 5% fat, cooked", 120), ("Mixed salad leaves", 80), ("Black beans, cooked", 80), ("Sweetcorn", 50), ("Tomato", 80), ("Cheddar cheese", 20), ("Salsa", 50), ("Greek yogurt 0% fat", 50), ("Tortilla chips", 20)],
     ["taco seasoning", "lime"],
     ["Brown the beef with taco seasoning.", "Pile the leaves into a bowl and add the beef, beans, corn and tomato.", "Top with cheese, salsa, yogurt and crushed chips."],
     "Taco Salad", "taco-salad")
dish("matzo_ball_soup", "Chicken and matzo ball soup", 40, "Classic comforting chicken soup with light matzo dumplings.", ["comfort", "high protein"],
     [("Chicken breast, cooked", 150), ("Matzo meal", 40), ("Eggs, whole", 50), ("Carrot", 80), ("Onion", 50), ("Egg noodles, cooked", 60), ("Olive oil", 5)],
     ["chicken stock", "celery", "fresh dill"],
     ["Mix the matzo meal with the egg and oil, chill for 20 minutes, then roll into small balls.", "Simmer the stock with the carrot, onion and celery for 15 minutes.", "Poach the matzo balls for 20 minutes, add the shredded chicken and noodles and finish with dill."],
     "Matzo Ball Soup", "soup-dumpling")
dish("beef_gyros", "Beef gyros with tzatziki", 30, "Spiced sliced beef in a warm pita with a yogurt-cucumber sauce.", ["high protein", "mediterranean"],
     [("Sirloin steak, cooked", 130), ("Wholemeal pita", 60), ("Greek yogurt 0% fat", 80), ("Cucumber", 80), ("Tomato", 70), ("Onion", 30), ("Mixed salad leaves", 20)],
     ["oregano", "garlic", "lemon juice"],
     ["Season the beef with oregano, garlic and lemon and sear, then slice thinly.", "Stir grated cucumber and garlic into the yogurt.", "Fill the pita with beef, tomato, onion, leaves and a generous spoon of tzatziki."],
     "Beef Gyros", "gyros")

# ---------- Plan 210 ----------
dish("pot_pie", "Chicken pot pie with a light topping", 45, "A creamy chicken and veg filling under a thin flaky-style crust.", ["comfort", "family"],
     [("Chicken breast, cooked", 150), ("Peas, frozen", 60), ("Carrot", 60), ("Potato, boiled", 100), ("Milk, semi-skimmed", 150), ("Plain flour", 35), ("Butter", 8), ("Onion", 40)],
     ["thyme", "chicken stock"],
     ["Make a quick sauce: melt the butter, stir in 20 g flour, then whisk in the milk and a splash of stock until thick.", "Fold in the chicken, peas, carrot, potato and thyme and spoon into a dish.", "Mix the remaining flour with a little water into a paste, pat out a thin lid, cover and bake at 200C for 25 minutes."],
     "Biscuit Chicken Pot Pie", "pot-pie")
dish("calzone", "Spinach, chicken and mozzarella calzone", 35, "A folded pizza pocket with a lean chicken and spinach filling.", ["comfort", "high protein"],
     [("Pizza dough, baked", 150), ("Mozzarella", 50), ("Chicken breast, cooked", 100), ("Spinach", 50), ("Chopped tomatoes, canned", 80), ("Mixed salad leaves", 40)],
     ["garlic", "dried oregano"],
     ["Roll the dough into a circle and spread half with tomato.", "Top that half with chicken, spinach and mozzarella, fold over and seal the edge.", "Bake at 220C for 18 to 20 minutes and serve with a side salad."],
     "Calzone", "calzone")
dish("quinoa_burger", "Quinoa and chickpea burger", 35, "Hearty vegetarian patties baked until crisp outside.", ["vegetarian", "high fibre"],
     [("Quinoa, cooked", 100), ("Chickpeas, cooked", 120), ("Eggs, whole", 50), ("Oats, dry", 25), ("Wholemeal burger bun", 70), ("Avocado", 50), ("Tomato", 50), ("Mixed salad leaves", 20)],
     ["cumin", "garlic", "parsley"],
     ["Mash the chickpeas and mix with the quinoa, egg, oats and spices.", "Shape into patties and bake at 200C for 20 minutes, turning once.", "Serve in the bun with avocado, tomato and leaves."],
     "Quinoa Burger", "burger-veg")
dish("short_rib_ragu", "Slow-braised beef ragu with pappardelle", 60, "Rich, slow-cooked lean beef sauce over wide pasta ribbons.", ["comfort", "meal prep"],
     [("Braising beef, cooked lean", 140), ("Pasta, cooked", 160), ("Chopped tomatoes, canned", 150), ("Carrot", 40), ("Onion", 50), ("Parmesan", 10), ("Olive oil", 5)],
     ["red wine (optional)", "garlic", "rosemary", "beef stock"],
     ["Brown the beef, then soften the onion, carrot and garlic in the same pan.", "Add the tomatoes, stock and rosemary, cover and simmer for 1.5 hours until it falls apart.", "Shred the beef into the sauce and serve over pasta with parmesan."],
     "Short Rib Ragu", "ragu")
dish("cabbage_roll_soup", "Beef and cabbage roll soup", 40, "All the cabbage roll flavour in one pot with rice and tomato.", ["comfort", "one pot"],
     [("Beef mince 5% fat, cooked", 130), ("Cabbage", 200), ("White rice, cooked", 120), ("Chopped tomatoes, canned", 150), ("Onion", 50), ("Carrot", 40)],
     ["beef stock", "paprika", "bay leaf"],
     ["Brown the beef with the onion and carrot.", "Add the cabbage, tomatoes, stock and paprika and simmer for 20 minutes.", "Stir in the cooked rice and heat through."],
     "Cabbage Roll Soup", "soup-cabbage")

# ---------- Plan 209 ----------
dish("peanut_noodles", "Peanut noodles with chicken", 20, "Silky peanut-soy noodles with crunchy veg and shredded chicken.", ["quick", "asian"],
     [("Rice noodles, cooked", 180), ("Peanut butter", 25), ("Soy sauce", 15), ("Chicken breast, cooked", 120), ("Carrot", 50), ("Cucumber", 60), ("Edamame", 60)],
     ["lime juice", "chilli flakes", "garlic"],
     ["Whisk the peanut butter, soy sauce, lime and garlic with a splash of warm water.", "Toss with the noodles, chicken and edamame.", "Top with carrot and cucumber ribbons and chilli."],
     "Peanut Noodles", "noodles-peanut")
dish("street_corn_bowl", "Street corn chicken rice bowl", 25, "Charred corn, spiced chicken and a tangy yogurt-lime sauce over rice.", ["high protein", "mexican"],
     [("Chicken breast, cooked", 160), ("White rice, cooked", 150), ("Sweetcorn", 100), ("Black beans, cooked", 60), ("Feta", 20), ("Greek yogurt 0% fat", 50), ("Bell pepper", 50)],
     ["lime", "chilli powder", "coriander"],
     ["Char the corn in a dry hot pan until blackened in spots.", "Season and sear the chicken, then slice.", "Build the bowl on rice with beans, pepper, chicken and corn and finish with crumbled feta and lime yogurt."],
     "Street Corn Chicken Bowl", "bowl-chicken-rice")
dish("pulled_pork", "BBQ pulled pork sandwich with pineapple slaw", 40, "Lean shredded pork in smoky BBQ sauce with a fruity crunchy slaw.", ["high protein", "bbq"],
     [("Pork tenderloin, cooked", 150), ("BBQ sauce", 34), ("Wholemeal burger bun", 70), ("Cabbage", 80), ("Pineapple", 60), ("Mango", 40), ("Greek yogurt 0% fat", 40)],
     ["smoked paprika", "lime juice"],
     ["Simmer or slow-cook the pork with BBQ sauce and paprika until it shreds easily.", "Toss the cabbage, pineapple and mango with the yogurt and lime juice.", "Pile the pork into the bun and top with the slaw."],
     "BBQ Pulled Pork Sandwiches", "pulled-pork")
dish("shrimp_alfredo", "Light shrimp alfredo", 20, "A creamy garlic sauce made with cream cheese and parmesan instead of heavy cream.", ["quick", "high protein"],
     [("Prawns, cooked", 150), ("Pasta, cooked", 180), ("Light cream cheese", 40), ("Milk, semi-skimmed", 100), ("Parmesan", 15), ("Spinach", 40), ("Olive oil", 5)],
     ["garlic", "black pepper", "lemon zest"],
     ["Warm the milk with the cream cheese, garlic and parmesan until smooth.", "Sear the prawns in the oil for 2 minutes.", "Toss the pasta, prawns, spinach and sauce together."],
     "Shrimp Alfredo", "pasta-shrimp")
dish("caesar_wrap", "Chicken caesar wrap", 10, "A caesar wrap with a yogurt-based dressing.", ["quick", "high protein"],
     [("Tortilla wrap", 62), ("Chicken breast, cooked", 140), ("Mixed salad leaves", 50), ("Parmesan", 12), ("Greek yogurt 0% fat", 50), ("Tomato", 60), ("Potato, boiled", 150)],
     ["lemon juice", "garlic", "dijon mustard"],
     ["Stir the yogurt with lemon juice, garlic, mustard and half the parmesan.", "Toss the leaves and chicken in the dressing.", "Pile onto the wrap with tomato, roll up and serve with boiled potatoes."],
     "Chicken Caesar Wrap", "wrap-caesar")

# ---------- Plan 208 ----------
dish("lemon_chicken_pasta", "Lemon parmesan chicken pasta", 25, "Bright lemony pasta with seared chicken and a little parmesan.", ["high protein", "quick"],
     [("Chicken breast, cooked", 150), ("Pasta, cooked", 180), ("Parmesan", 15), ("Spinach", 50), ("Olive oil", 8), ("Peas, frozen", 50)],
     ["lemon zest and juice", "garlic", "black pepper"],
     ["Sear the chicken, rest, then slice.", "Toss the hot pasta with oil, garlic, lemon zest, juice, peas and spinach until wilted.", "Fold in the chicken and parmesan."],
     "Lemon Chicken Pasta", "pasta-lemon")
dish("lomo_saltado", "Beef lomo saltado", 25, "Peruvian-style beef and onion stir-fry with tomatoes, served over rice with a few fries.", ["high protein", "latin"],
     [("Sirloin steak, cooked", 150), ("Onion", 80), ("Tomato", 100), ("White rice, cooked", 150), ("Potato, boiled", 100), ("Soy sauce", 15), ("Olive oil", 6)],
     ["garlic", "red wine vinegar", "coriander"],
     ["Roast the potato wedges at 220C for 25 minutes.", "Stir-fry the sliced beef in a very hot pan for 2 minutes, add the onion and tomato.", "Splash in the soy sauce and vinegar, toss in the potatoes and serve on rice."],
     "Lomo Saltado", "beef-stirfry")
dish("burrata_pizza", "Tomato mozzarella pizza", 30, "A thin homemade pizza with fresh mozzarella and rocket.", ["vegetarian", "weekend"],
     [("Pizza dough, baked", 150), ("Mozzarella", 70), ("Chopped tomatoes, canned", 80), ("Tomato", 60), ("Mixed salad leaves", 30), ("Chicken breast, cooked", 80)],
     ["basil", "garlic", "olive oil drizzle"],
     ["Stretch the dough thin and spread with the tomato, garlic and a pinch of salt.", "Top with torn mozzarella and sliced tomato and bake at 240C for 10 to 12 minutes.", "Scatter over the leaves, chicken and basil."],
     "Burrata Pizza", "pizza")
dish("salmon_bowl", "Salmon rice bowl", 25, "Teriyaki-style salmon over rice with edamame, cucumber and avocado.", ["omega-3", "high protein"],
     [("Salmon fillet, cooked", 140), ("White rice, cooked", 150), ("Edamame", 70), ("Cucumber", 60), ("Avocado", 40), ("Soy sauce", 12), ("Honey", 8)],
     ["rice vinegar", "sesame seeds", "spring onion"],
     ["Brush the salmon with soy sauce and honey and bake at 200C for 10 to 12 minutes.", "Dress the cucumber with a splash of rice vinegar.", "Flake the salmon over rice and top with edamame, cucumber, avocado and sesame."],
     "Salmon Bowls", "bowl-salmon")

# ---------- Plan 207 ----------
dish("salmon_tacos", "Salmon tacos with crunchy slaw", 25, "Seared salmon in corn tortillas with a lime-yogurt cabbage slaw.", ["omega-3", "mexican"],
     [("Salmon fillet, cooked", 140), ("Corn tortilla", 78), ("Cabbage", 80), ("Greek yogurt 0% fat", 50), ("Avocado", 40), ("Salsa", 30)],
     ["lime", "chilli powder", "coriander"],
     ["Rub the salmon with chilli powder and sear or bake until just cooked, then flake.", "Mix the cabbage with the yogurt and lime juice for the slaw.", "Fill warm tortillas with salmon, slaw, avocado and salsa."],
     "Salmon Tacos", "tacos-fish")
dish("med_meatball_bowl", "Mediterranean turkey meatball bowl", 35, "Herby turkey meatballs on couscous with cucumber, tomato and feta.", ["high protein", "mediterranean"],
     [("Turkey mince, cooked", 150), ("Couscous, cooked", 160), ("Cucumber", 70), ("Tomato", 80), ("Feta", 25), ("Hummus", 40), ("Breadcrumbs", 10), ("Eggs, whole", 25)],
     ["oregano", "lemon juice", "parsley"],
     ["Mix the turkey, breadcrumbs, egg and oregano, shape into balls and bake at 200C for 15 minutes.", "Fluff the couscous with lemon juice and parsley.", "Serve the meatballs on the couscous with cucumber, tomato, feta and a spoon of hummus."],
     "Mediterranean Meatball Bowl", "bowl-med")
dish("creamy_herb_pasta", "Creamy garlic and herb pasta", 20, "Light herb cream cheese sauce with cherry tomatoes and chicken.", ["quick", "comfort"],
     [("Pasta, cooked", 180), ("Light cream cheese", 40), ("Chicken breast, cooked", 130), ("Tomato", 100), ("Spinach", 40), ("Parmesan", 10), ("Milk, semi-skimmed", 60)],
     ["garlic", "mixed herbs", "black pepper"],
     ["Warm the cream cheese with the milk, garlic and herbs until smooth.", "Toss through the pasta, chicken and halved tomatoes.", "Wilt in the spinach and finish with parmesan."],
     "Boursin Pasta", "pasta-creamy")
dish("cevapi", "Beef cevapi with pita and yogurt", 30, "Grilled spiced minced-beef rolls served in pita with onion and yogurt.", ["high protein", "balkan"],
     [("Beef mince 5% fat, cooked", 150), ("Wholemeal pita", 60), ("Onion", 50), ("Greek yogurt 0% fat", 70), ("Tomato", 70), ("Bell pepper", 60), ("Cucumber", 50)],
     ["garlic", "paprika", "bicarbonate of soda (a pinch)"],
     ["Mix the mince with garlic, paprika and a splash of water, shape into short finger-sized rolls.", "Grill or pan-fry for 8 to 10 minutes, turning until browned.", "Serve in the pita with onion, tomato, pepper, cucumber and yogurt."],
     "Cevapi", "cevapi")
dish("panang_curry", "Chicken panang curry", 30, "A rich peanutty panang-style curry that stays light on calories.", ["high protein", "asian"],
     [("Chicken breast, cooked", 160), ("Light coconut milk", 150), ("Curry paste", 20), ("Peanut butter", 12), ("Bell pepper", 80), ("Green beans", 60), ("White rice, cooked", 150)],
     ["lime leaves or lime juice", "fish sauce", "basil"],
     ["Fry the curry paste with the peanut butter for a minute.", "Add the coconut milk, chicken, pepper and beans and simmer for 12 minutes.", "Finish with basil and lime and serve over rice."],
     "Panang Curry", "curry-red")

# ---------- Plan 206 ----------
dish("sweet_sour_chicken", "Baked sweet and sour chicken", 30, "Crisp-baked chicken in a pineapple and pepper sweet-sour sauce.", ["high protein", "asian"],
     [("Chicken breast, cooked", 170), ("Pineapple", 100), ("Bell pepper", 100), ("Onion", 40), ("White rice, cooked", 150), ("Tomato ketchup", 20), ("Honey", 8)],
     ["rice vinegar", "soy sauce", "garlic"],
     ["Bake the cubed chicken at 220C for 15 minutes until golden.", "Simmer the ketchup, honey, vinegar, soy sauce and garlic with the peppers, onion and pineapple.", "Toss the chicken through the sauce and serve on rice."],
     "Sweet and Sour Chicken", "sweet-sour")
dish("beef_tacos", "Lean ground beef tacos", 20, "Weeknight tacos with lean beef, crisp lettuce and tomato.", ["high protein", "mexican"],
     [("Beef mince 5% fat, cooked", 140), ("Corn tortilla", 78), ("Tomato", 70), ("Mixed salad leaves", 30), ("Cheddar cheese", 20), ("Salsa", 40), ("Greek yogurt 0% fat", 40), ("Black beans, cooked", 60)],
     ["taco seasoning", "lime"],
     ["Brown the beef with taco seasoning and a splash of water.", "Warm the tortillas and the beans.", "Fill with beef, beans, leaves, tomato, cheese, salsa and yogurt."],
     "Ground Beef Tacos", "tacos-beef")
dish("black_bean_burger", "Smoky black bean burger", 30, "A firm homemade black bean patty on a wholemeal bun.", ["vegetarian", "high fibre"],
     [("Black beans, cooked", 150), ("Oats, dry", 30), ("Eggs, whole", 50), ("Wholemeal burger bun", 70), ("Avocado", 50), ("Tomato", 50), ("Sweet potato, baked", 150), ("Mixed salad leaves", 20)],
     ["smoked paprika", "cumin", "garlic"],
     ["Mash the beans with the oats, egg and spices and shape into a patty.", "Pan-fry or bake for 6 minutes per side.", "Serve in the bun with avocado, tomato, leaves and baked sweet potato."],
     "Black Bean Burger", "burger-veg")
dish("thai_basil_chicken", "Thai basil chicken with rice", 20, "Punchy minced chicken stir-fry with green beans, chilli and basil.", ["quick", "high protein"],
     [("Chicken breast, cooked", 160), ("Green beans", 100), ("Bell pepper", 60), ("White rice, cooked", 160), ("Eggs, whole", 50), ("Soy sauce", 12), ("Olive oil", 6)],
     ["fresh basil", "garlic", "red chilli", "fish sauce"],
     ["Stir-fry the minced chicken in the oil until browned, then add garlic, chilli, beans and pepper.", "Add the soy and fish sauce and toss until glossy, then stir in the basil.", "Serve over rice topped with a fried egg."],
     "Thai Basil Chicken", "thai-basil")
dish("swedish_meatballs", "Lighter Swedish meatballs", 35, "Tender beef meatballs in a creamy mushroom gravy with potatoes.", ["comfort", "high protein"],
     [("Beef mince 5% fat, cooked", 140), ("Breadcrumbs", 15), ("Eggs, whole", 25), ("Mushrooms", 80), ("Milk, semi-skimmed", 100), ("Greek yogurt 0% fat", 40), ("Potato, boiled", 200), ("Plain flour", 8)],
     ["beef stock", "allspice", "dill"],
     ["Mix the beef, breadcrumbs, egg and allspice, shape into balls and bake at 200C for 15 minutes.", "Fry the mushrooms, stir in the flour, then whisk in the milk and stock until thick; finish with yogurt.", "Add the meatballs to the gravy and serve with boiled potatoes and dill."],
     "Swedish Meatballs", "swedish-meatballs")

assert len(D) == 49, len(D)

# ---------------- plan templates ----------------
# number -> (name, goal, kcal target, description, hero dish key, [Mon..Fri dish keys])
TEMPLATES = [
    (215, "Taco Night and Takeaway Lite", "Balanced", 2000, "Carne asada tacos, a lighter General Tso's, creamy tortellini soup, ham fried rice and honey mustard chicken.", "carne_asada",
     ["carne_asada", "general_tso", "tortellini_soup", "ham_fried_rice", "honey_mustard_chicken"]),
    (214, "Summer Grill Week", "Muscle gain", 2500, "Tostadas, a southwest pasta salad, cajun kebabs, turkey meatballs arrabbiata and smash burgers.", "smash_burger",
     ["tostadas", "tortellini_salad", "cajun_kebabs", "meatballs_arrabbiata", "smash_burger"]),
    (213, "Comfort and Spice Week", "Balanced", 2200, "Walking taco bowls, creamy chicken and gnocchi, a veggie wrap, chicken red curry and kung pao.", "red_curry",
     ["walking_tacos", "chicken_gnocchi", "veggie_wrap", "red_curry", "kung_pao"]),
    (212, "Bowls and Cosy Soup Week", "Fat loss", 1700, "A quinoa nourish bowl, mushroom tacos, turkey sloppy joes, chicken dumpling soup and Thai chicken meatballs.", "nourish_bowl",
     ["nourish_bowl", "mushroom_tacos", "sloppy_joes", "dumpling_soup", "thai_meatballs"]),
    (211, "Wraps and Warm Bowls", "Balanced", 2000, "Green chile burritos, a chicken avocado wrap, loaded taco salad, matzo ball soup and beef gyros.", "beef_gyros",
     ["smothered_burritos", "chicken_avocado_wrap", "taco_salad", "matzo_ball_soup", "beef_gyros"]),
    (210, "Autumn Comfort Week", "Muscle gain", 2600, "Chicken pot pie, calzone, quinoa burgers, slow-braised beef ragu and beef cabbage roll soup.", "short_rib_ragu",
     ["pot_pie", "calzone", "quinoa_burger", "short_rib_ragu", "cabbage_roll_soup"]),
    (209, "Quick Noodles and Sandwiches", "Fat loss", 1800, "Peanut noodles, a street corn chicken bowl, BBQ pulled pork, light shrimp alfredo and a chicken caesar wrap.", "street_corn_bowl",
     ["peanut_noodles", "street_corn_bowl", "pulled_pork", "shrimp_alfredo", "caesar_wrap"]),
    (208, "Italian and Island Week", "Balanced", 2100, "Lemon chicken pasta, lomo saltado, tomato mozzarella pizza, salmon rice bowls and BBQ pulled pork.", "salmon_bowl",
     ["lemon_chicken_pasta", "lomo_saltado", "burrata_pizza", "salmon_bowl", "pulled_pork"]),
    (207, "Fish, Meatballs and Curry Week", "Fat loss", 1800, "Salmon tacos, a Mediterranean meatball bowl, creamy herb pasta, beef cevapi and panang curry.", "salmon_tacos",
     ["salmon_tacos", "med_meatball_bowl", "creamy_herb_pasta", "cevapi", "panang_curry"]),
    (206, "Takeout Classics, Lightened", "Muscle gain", 2400, "Sweet and sour chicken, beef tacos, black bean burgers, Thai basil chicken and Swedish meatballs.", "thai_basil_chicken",
     ["sweet_sour_chicken", "beef_tacos", "black_bean_burger", "thai_basil_chicken", "swedish_meatballs"]),
]
