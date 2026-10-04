"""Generates supabase/seed_meal_plans.sql: extra foods, 49 original dinner recipes, 10 weekly meal plan
templates and photo links. Source facts live in supabase/data/tbfs-meal-plans.json, photo ids in
supabase/data/photos.json.   python3 supabase/tools/build_meal_plans.py supabase/seed_meal_plans.sql"""
import json, os, sys
import build_seed as b
import meal_data as m

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = json.load(open(os.path.join(HERE, '../data/tbfs-meal-plans.json')))
PHOTOS = json.load(open(os.path.join(HERE, '../data/photos.json')))
q, arr, uid = b.q, b.arr, b.uid

for f in m.NEW_FOODS:
    b.FOOD[f[0]] = f
DISH_URL = {d['dish']: d['url'] for p in SRC['plans'] for d in p['dinners']}
PLAN = {p['number']: p for p in SRC['plans']}
DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']

def img(key):
    pid = PHOTOS[key][0]
    return f"https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=800", f"https://www.pexels.com/photo/{pid}/"

# photo for the original 28 recipes where a matching picture exists
ORIGINAL_PHOTO = {
    "Chicken burrito bowl": "bowl-chicken-rice", "Tuna and chickpea salad": "bowl-med", "Turkey and hummus wrap": "wrap-veggie",
    "Quinoa and halloumi salad": "bowl-nourish", "Prawn noodle stir-fry": "noodles-peanut", "Salmon, sweet potato and greens": "bowl-salmon",
    "Lean beef bolognese": "ragu", "Chicken thigh tray bake": "chicken-roast", "Steak, rice and asparagus": "beef-stirfry",
    "Tofu satay stir-fry": "stirfry-protein", "Chickpea and spinach curry": "curry-red",
}

def day_pool(meal):
    return [r for r in b.RECIPES if r[1] == meal]

def r_macros(name, ings):
    return b.macros(ings)

if __name__ == '__main__':
    out = ["-- PTPN meal plan library. Safe to re-run (deterministic ids, on conflict do nothing).",
           "-- Source facts: supabase/data/tbfs-meal-plans.json. Recipes are original rewrites, photos are Pexels.",
           "create or replace function pg_temp.sid(t text) returns uuid language sql immutable as $$ select extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11'::uuid, t) $$;", ""]
    out.append("insert into public.foods (id, name, serving_label, serving_g, kcal, protein, carbs, fat) values")
    out.append(",\n".join(f"({uid('food', n)},{q(n)},{q(sl)},{g},{k},{p},{c},{f})" for n, sl, g, k, p, c, f in m.NEW_FOODS) + "\non conflict (id) do nothing;\n")

    rows, dmac = [], {}
    for key, (name, prep, desc, tags, ings, extras, steps, inspired, photo) in m.D.items():
        k, p, c, f = b.macros(ings)
        dmac[key] = (k, p, c, f)
        url, credit = img(photo)
        labels = [b.ing_label(a, g) for a, g in ings] + extras
        rows.append(f"({uid('recipe', name)},{q(name)},'dinner',{q(desc)},{prep},{k},{p},{c},{f},{arr(labels)},{arr(steps)},{arr(tags)},{q(url)},{q(credit)},{q('Tastes Better From Scratch: ' + inspired)},{q(DISH_URL[inspired])})")
    out.append("insert into public.recipes (id, name, meal_type, description, prep_min, kcal, protein, carbs, fat, ingredients, steps, tags, image_url, image_credit, inspired_by, inspired_url) values")
    out.append(",\n".join(rows) + "\non conflict (id) do nothing;\n")

    # photos on the original recipes (they already exist in the database)
    for n, key in ORIGINAL_PHOTO.items():
        url, credit = img(key)
        out.append(f"update public.recipes set image_url = {q(url)}, image_credit = {q(credit)} where id = {uid('recipe', n)} and image_url is null;")
    out.append("")

    breakfasts, lunches, snacks = day_pool('breakfast'), day_pool('lunch'), day_pool('snack')
    trows, irows = [], []
    for ti, (num, tname, goal, kcal, desc, hero, keys) in enumerate(m.TEMPLATES):
        plan = PLAN[num]
        url, credit = img(m.D[hero][-1])
        trows.append(f"({uid('mpt', f'tbfs-{num}')},{q(tname)},{q(goal)},{kcal},{q(desc)},{q(url)},{q(credit)},{q(SRC['source']['name'])},{q(f'Meal plan {num}')},{q(plan['url'])},{num},{q(plan['posted'])})")
        week = keys + [keys[0], keys[2]]  # Saturday and Sunday repeat two favourites
        for d in range(7):
            dish = m.D[week[d]]
            picks = [('breakfast', breakfasts[(d + ti) % len(breakfasts)]), ('lunch', lunches[(d + ti) % len(lunches)]),
                     ('dinner', None), ('snack', snacks[(d * 2 + ti) % len(snacks)])]
            base = []
            for meal, r in picks:
                kc = dmac[week[d]][0] if r is None else b.macros(r[5])[0]
                base.append(kc)
            factor = kcal / sum(base)
            for sort, ((meal, r), kc) in enumerate(zip(picks, base)):
                s = max(0.5, round(factor * 10) / 10)
                rid = uid('recipe', dish[0]) if r is None else uid('recipe', r[0])
                irows.append(f"({uid('mpti', f'{num}:{d + 1}:{meal}')},{uid('mpt', f'tbfs-{num}')},{d + 1},{q(meal)},{rid},{s},{sort})")
    out.append("insert into public.meal_plan_templates (id, name, goal, kcal, description, image_url, image_credit, source_name, source_title, source_url, plan_no, source_posted) values")
    out.append(",\n".join(trows) + "\non conflict (id) do nothing;\n")
    out.append("insert into public.meal_plan_template_items (id, template_id, day, meal_type, recipe_id, servings, sort) values")
    out.append(",\n".join(irows) + "\non conflict (id) do nothing;\n")
    open(sys.argv[1], 'w').write("\n".join(out))
    print(f"foods {len(m.NEW_FOODS)}, dishes {len(rows)}, templates {len(trows)}, items {len(irows)}")
