---
name: import-meal-plans
description: Turn a recipe or meal plan website into original meal plan templates, recipes and photo banners in the PTPN app library. Use when the user gives a meal plan or recipe site URL and asks for modified versions, new recipes, templates, photos or "add to library".
---

# Import meal plans into PTPN

Pipeline used for the first meal plan import (plans 206 to 215). Reference files: `supabase/data/tbfs-meal-plans.json`, `supabase/tools/meal_data.py`, `supabase/tools/build_meal_plans.py`, `supabase/data/photos.json`.

## Ground rules

1. Keep facts only from the source: plan numbers, dish names, dates, URLs, rough costs. Never copy recipe text, photos or PDFs.
2. Write every recipe fresh. Re-balance portions for training diets (about 500 to 750 kcal, 40+ g protein for meat dinners).
3. Macros come from the food list, never from the source. Say they are estimates.
4. The user does not want credits or "inspired by" lines shown in the app, so none are stored or displayed. Keep the scraped facts in the data JSON only.
5. If the user says "top N download" and the site shows no counts, use the N newest and say so.
6. Tell the user what was copied (facts), what was rewritten, where photos come from and where the data is saved.

## Steps

1. **Scrape the index** with `firecrawl_scrape` (markdown). List plan numbers, dates, URLs. Then scrape each plan page for its dish list (use JSON format with a schema, about 5 credits each). Firecrawl allows about 10 requests a minute, so run 4 at a time and wait on 429s (use a background `sleep`, foreground sleep is blocked).
2. **Save facts** to `supabase/data/<source>-meal-plans.json` with a provenance note, source name, category URL, and per plan: number, posted date, url, pdf, dinners (day, dish, url, cost).
3. **Foods**: any ingredient missing from `build_seed.FOODS` goes in `NEW_FOODS` (name, serving label, serving g, kcal, protein, carbs, fat per 100 g). Ingredient names in recipes must match food names exactly.
4. **Dishes**: add `dish(key, name, prep, desc, tags, ingredients[(food, grams)], extras[], steps, source_title, photo_key)` and a `TEMPLATES` row (plan number, friendly name, goal, kcal target, description, hero dish key, 5 dish keys). `source_title` is the source dish title (kept for reference only).
5. **Validate macros** by summing ingredients per dish and flag anything outside 450 to 800 kcal or under 30 g protein. Tune grams.
6. **Photos**: use `firecrawl_scrape` on `https://www.pexels.com/search/<query>/` with `formats: ["query"]` and a prompt asking for the first 3 photo ids with alt text (5 credits, small output). Do not use `firecrawl_search` for this, the output is huge. Check the alt text matches the dish, fall back to a similar dish photo, and store ids under photo keys in `supabase/data/photos.json`. URL pattern: `https://images.pexels.com/photos/{id}/pexels-photo-{id}.jpeg?auto=compress&cs=tinysrgb&w=800`. curl to pexels is blocked in the sandbox.
7. **Build the seed**: `python3 supabase/tools/build_meal_plans.py supabase/seed_meal_plans.sql`. Ids are deterministic (`uuid_generate_v5`), so reruns are safe. Template days 6 and 7 repeat two favourite dinners, breakfast, lunch and snack come from the original recipes, servings are scaled so a day matches the template kcal. Re-run `build_seed.py` and confirm `supabase/seed.sql` is byte-identical.
8. **Schema** lives in `supabase/schema.sql` (v3 block) and `supabase/migrate_v3_meal_plans.sql` for existing databases.
9. **Test**: load schema and both seeds twice into PGlite, check counts (recipes, templates, items, photos, source links, kcal range, every item resolves) and run the browser e2e (route `images.pexels.com` to a stub image).
10. **Apply to Supabase** (project `dstxexfkxejmolnulwli`, never the MYGYM project): run the schema with `apply_migration`, then the seed in chunks (foods, recipes in three parts, photo updates plus templates, template items). Every chunk must start with the `pg_temp.sid` function, because each call is a new session. Template items can be sent as a compact `VALUES` list of names resolved with `pg_temp.sid`, about 15 KB instead of 36 KB. `execute_sql` that fetches SQL over HTTP needs user approval, so do not rely on it. Verify live counts equal the local ones.
11. **Ship**: branch `claude/...`, PR, squash merge. If the PR reports conflicts because main holds a squashed earlier PR, reset the branch to `origin/main` and re-apply with `git diff <old-base> HEAD | git apply --3way`.

## Gotchas

- Ingredient labels are lower-cased by `ing_label`, so proper nouns need to be in its exception list (`Greek`, `BBQ`, `Dijon`).
- Recipe titles with apostrophes need doubled quotes in SQL (the builder's `q()` handles it).
- Photos hotlink from Pexels. The app falls back to a gradient banner when an image fails.
- Update test expectations (recipe and food counts) in the harness when the library grows.
