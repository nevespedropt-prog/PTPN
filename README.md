# PTPN

Premium, phone-first coaching app for personal trainers and their clients. React + Vite + TypeScript on Supabase (Postgres, Auth, Storage, Realtime, Edge Functions). Dark theme, installable as a home-screen web app.

## What's inside

**Clients**
- Home: today's workout, macro rings, weekly score, coach messages, habits and a daily check-in
- Train: weekly schedule, workout player with set logging (weight and reps), rest timer, autosave, ratings and history, build-your-own workouts
- Nutrition: food diary with 100+ foods, recipes, quick add, macro targets, planned meals from the coach
- Progress: weight and body fat trends, personal records, max lifts (1RM), custom metrics, private progress photos with before and after
- Coach chat (live), community announcements, challenges with leaderboards, recipe book, resources, session booking

**Coach**
- Dashboard: compliance, unread messages, clients who need attention, recent workouts
- Clients: add clients, per-client overview, training, nutrition, habits and progress
- Library: 100+ exercises, 16 workout templates (straight sets, circuits, AMRAP, EMOM, intervals), 6 programme templates, builders for both, supersets, %1RM prescriptions
- Assign workouts and programmes by date, nutrition targets, weekly meal plans (auto-generated from the recipe book)
- Meal plan library: 10 weekly plan templates (49 original dinner recipes with photos), apply one to a client with portions fitted to their calorie target
- Inbox, announcements, challenges, resources, session slots

No payments, on purpose.

## Setup

1. Create a Supabase project. In the SQL Editor run `supabase/schema.sql`, then `supabase/seed.sql`, then `supabase/seed_meal_plans.sql` and `supabase/seed_common_meals.sql` (the seed needs the `uuid-ossp` extension, which Supabase has by default).
2. Deploy the edge function `supabase/functions/create-client` (it lets the coach create client accounts). `supabase functions deploy create-client`.
3. Copy `.env.example` to `.env` and fill in the project URL and the anon (publishable) key.
4. `npm install` then `npm run dev`.
5. Sign up in the app, then make yourself the coach (SQL at the bottom of `schema.sql`).

New sign-ups are always clients. Roles can only be changed by a coach or in the dashboard.

## Meal plan library

Ten weekly meal plan templates, 49 dinner recipes and 28 everyday meal ideas, all written fresh with macros computed from the food list. Banner photos are hotlinked from Pexels (ids in `supabase/data/photos.json`). Seeds: `supabase/seed_meal_plans.sql` and `supabase/seed_common_meals.sql`. To regenerate after editing: `python3 supabase/tools/build_meal_plans.py supabase/seed_meal_plans.sql` and `python3 supabase/tools/build_common_meals.py supabase/seed_common_meals.sql`. For an existing database, run `supabase/migrate_v3_meal_plans.sql` first.

## Deploy (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

1. Repo Settings > Pages > Source: GitHub Actions.
2. Repo Settings > Secrets and variables > Actions > Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. One variable per value, with only the value in the box.
3. In Supabase > Authentication > URL Configuration, set the Site URL to the Pages address.

## Security notes

Every table has row-level security: clients only see their own data, the coach sees everything, and the leaderboard and message-read helpers are narrow `security definer` functions. Progress photos live in a private bucket with one folder per client. Turn on leaked-password protection in Supabase Auth settings if your plan allows it.
