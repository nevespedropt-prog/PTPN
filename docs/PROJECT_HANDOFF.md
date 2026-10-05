# PTPN app: project handoff

Read this first when picking the project up in a new chat. Last updated 5 October 2026.

## What it is

PTPN is a premium dark, phone-first personal training coaching app (React 19, Vite, TypeScript on Supabase). One coach (nevespedro.pt@gmail.com) and their clients. Inspired by Everfit, with no payments on purpose.

- Live app: https://nevespedropt-prog.github.io/PTPN/
- Repo: https://github.com/nevespedropt-prog/PTPN (public, GitHub Pages)
- Supabase project id: dstxexfkxejmolnulwli (https://dstxexfkxejmolnulwli.supabase.co). Never touch the other project called MYGYM APP.
- GitHub repo variables VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY hold the public connection values, one value per variable. No secrets are stored in the repo.

## What is built

Clients: Home (today's workout, macro rings, habits, check-in), Train (schedule, workout player with set logging and rest timer, build your own), Nutrition (food diary, upcoming days with the coach's planned meals, Random meal idea button, Recipe book card and Meal plans row at the bottom), Progress (body, strength, photos with an Upload button for front, side, back and other, before and after), chat, community, session booking, resources, account and password change.

Coach: dashboard, clients (add client through an edge function), per-client overview, training, nutrition, habits, library (225 exercises, 16 workout templates, 6 programmes, workout and programme builders), meal plan library (apply a plan to a client, portions fitted to their calorie target), inbox, announcements, challenges, resources, session slots.

Navigation on phones: bottom bar Home, Train, Nutrition, Progress, More. More opens a slide-out drawer with the remaining pages (Coach chat, Community, Book a session, Workout videos, account, sign out). For the coach the bar is Dashboard, Clients, Library, Inbox, More.

## Data in the live database

225 exercises (104 original plus 121 from the MyGym London list), 139 foods, 105 recipes (88 with Pexels photos), 10 weekly meal plan templates with 280 items, 16 workouts, 6 programmes. Every recipe ingredient has a quantity. The meal plan shopping list adds up seasonings across the week. No credits or "inspired by" lines are shown anywhere (the user asked for this).

## Repo map

- src: the app. src/pages (coach, client, shared pages), src/components, src/lib, src/index.css design system.
- supabase/schema.sql: full schema with row-level security. supabase/migrate_v3_meal_plans.sql: upgrade for older databases.
- supabase/seed.sql (exercises, foods, original recipes, workouts, programmes), seed_meal_plans.sql (10 plans, 49 dinners, 24 foods), seed_common_meals.sql (28 everyday meals, 6 foods). Run in that order after schema.sql. Ids are deterministic so reruns are safe.
- supabase/tools: Python builders. build_seed.py, build_meal_plans.py, build_common_meals.py, plus the data modules (meal_data.py, common_meals.py, mygym_exercises.py). Regenerate seeds with the commands in the README, never edit the seed files by hand.
- supabase/data: scraped facts JSON (tbfs-meal-plans.json, internal reference only) and photos.json (Pexels ids per photo key).
- supabase/functions/create-client: the edge function behind Add client.
- tests: database (70 checks) and browser (84 checks) suites on an in-memory Postgres, no Supabase needed. See tests/README.md.
- .github/workflows: deploy.yml (builds and publishes to Pages on every push to main), test.yml (type check and both suites on every pull request and push to main).
- .claude/skills/import-meal-plans: the reusable recipe for scraping a meal plan site into original recipes, photos and seeds.

## How work is shipped

1. Work on the branch the session gives you (it has been claude/nice-knuth-bt7xu7; reset it to origin/main between pieces of work).
2. Run the tests (cd tests, npm install, npm run test:db, npm run build:e2e, npm run test:e2e).
3. Push, open a pull request, wait for the Tests check to go green, squash merge. The merge triggers the deploy. Check that run finished (about 30 to 70 seconds), then reload the app on the phone.
4. Database changes: apply to Supabase with apply_migration (data and DDL) and verify counts afterwards. Every SQL chunk must define the pg_temp.sid helper first because each call is a new session. execute_sql only returns the result of the last statement. Some writes, drops and anything that fetches remote SQL need the user's approval in the Claude session; if blocked, give the user the SQL and the SQL editor link https://supabase.com/dashboard/project/dstxexfkxejmolnulwli/sql/new.
5. Merge conflicts after a squash merge: reset the branch to origin/main and re-apply the change with git diff old-base HEAD | git apply --3way.

## Decisions worth remembering

- No payments, ever.
- Random meal idea picks from the recipe library (free, instant). Real AI-generated meals were offered but declined for now; it would need an Anthropic API key stored as a Supabase secret and a small edge function.
- Photos are hotlinked from Pexels. The banner falls back to a gradient if a photo fails. Photo ids come from firecrawl_scrape on pexels.com search pages with the query format (about 5 credits each, rate limit about 10 per minute, wait with a background sleep). Firecrawl credits were around 650 at last check.
- Recipes are original rewrites with macros computed from the food list. Only facts were taken from the source site.
- Security: row-level security on every table, client sees only their own data, coach sees everything. Helper functions are locked to signed-in users. Realtime is on for the messages table.
- Test dates: the end-to-end flows depend on the current date; the workout player test targets the Push workout by name so it holds on any weekday.

## Still open

1. Leaked-password protection: a Supabase dashboard switch (Authentication, password settings, "Prevent use of leaked passwords"). Only the user can turn it on, may need a Pro plan.
2. Test password change (Account) and a real photo upload from the phone on the live site.
3. The egg muffins photo is only a close match (an egg bake). Replace it if the user sends a better Pexels link.
4. Optional: AI-generated meals (see decisions).
5. Optional: lint warnings in a few pages (setState in effects), harmless.

## How the user likes to work

Short, plain replies. Ask a few clarifying questions with the multiple-choice question tool before large work. No em dashes, no bold lead-ins in prose, no promotional wording. Show screenshots when a change is visual. Always check the deploy finished and say so. Ask before anything destructive or outward-facing; some Supabase actions need the user's approval in the session.

## To resume in a new chat

Say: "Read docs/PROJECT_HANDOFF.md in the PTPN repo and continue from the open items." The repo is the source of truth, this file is the briefing.
