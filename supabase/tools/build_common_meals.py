"""Generates supabase/seed_common_meals.sql: 28 everyday meal ideas (7 breakfast, lunch, dinner, snack) with photos.
python3 supabase/tools/build_common_meals.py supabase/seed_common_meals.sql"""
import json, os, sys
import build_seed as b
import meal_data as m
import common_meals as c

HERE = os.path.dirname(os.path.abspath(__file__))
PHOTOS = json.load(open(os.path.join(HERE, '../data/photos.json')))
q, arr, uid = b.q, b.arr, b.uid
for f in m.NEW_FOODS + c.NEW_FOODS:
    b.FOOD[f[0]] = f

def img(key):
    pid = PHOTOS[key][0]
    return f"https://images.pexels.com/photos/{pid}/pexels-photo-{pid}.jpeg?auto=compress&cs=tinysrgb&w=800", f"https://www.pexels.com/photo/{pid}/"

if __name__ == '__main__':
    out = ["-- PTPN everyday meal ideas. Safe to re-run (deterministic ids, on conflict do nothing).",
           "create or replace function pg_temp.sid(t text) returns uuid language sql immutable as $$ select extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11'::uuid, t) $$;", ""]
    out.append("insert into public.foods (id, name, serving_label, serving_g, kcal, protein, carbs, fat) values")
    out.append(",\n".join(f"({uid('food', n)},{q(n)},{q(sl)},{g},{k},{p},{cb},{f})" for n, sl, g, k, p, cb, f in c.NEW_FOODS) + "\non conflict (id) do nothing;\n")
    rows = []
    for name, meal, prep, desc, tags, ings, extras, steps, photo in c.R:
        k, p, cb, f = b.macros(ings)
        url, credit = img(photo)
        labels = [b.ing_label(a, g) for a, g in ings] + extras
        rows.append(f"({uid('recipe', name)},{q(name)},{q(meal)},{q(desc)},{prep},{k},{p},{cb},{f},{arr(labels)},{arr(steps)},{arr(tags)},{q(url)})")
    out.append("insert into public.recipes (id, name, meal_type, description, prep_min, kcal, protein, carbs, fat, ingredients, steps, tags, image_url) values")
    out.append(",\n".join(rows) + "\non conflict (id) do nothing;\n")
    open(sys.argv[1], 'w').write("\n".join(out))
    print(f"foods {len(c.NEW_FOODS)}, recipes {len(rows)}")
