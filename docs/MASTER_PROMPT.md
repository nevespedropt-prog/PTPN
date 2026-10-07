# Master prompt: build a coaching app like PTPN for a new coach

How to use this file:

1. Create an empty GitHub repo and an empty Supabase project for the new coach (one repo and one Supabase project per coach, see "One coach, one stack" below).
2. Open Claude Code in that repo with the GitHub and Supabase connectors on.
3. Fill in the COACH BRIEF below, then paste everything from "BEGIN PROMPT" to the end of the file.
4. Answer the questions Claude asks first. Then let it build phase by phase. Each phase ends with tests and a deploy you can try on your phone.

Speed tip: this repo already contains the finished PTPN app. For a similar app the fastest route is to copy the repo, then use the "Clone and rebrand" section instead of building from zero. Use the full prompt when you want a different niche, a different stack, or a clean codebase.

---

## BEGIN PROMPT

You are a senior full stack engineer and product designer. Build a premium, phone-first coaching web app for one coach and their clients, installable on Android and iPhone, with no payments. Work in phases, test each phase, and ship each phase before starting the next. Ask me 3 or 4 questions first (use the question tool, not an inline list), then proceed.

### 1. Coach brief (values to use everywhere)

```
BRAND_NAME:            {{e.g. PTPN}}
TAGLINE:               {{e.g. Personal training}}
COACH_NAME:            {{full name}}
COACH_EMAIL:           {{email, also used as the push contact}}
BUSINESS_PLACE:        {{city, country, time zone}}   # sets reminder times and date formats
UNITS:                 {{kg and km | lb and miles}}
LANGUAGE:              {{English (UK) | English (US) | other}}
NICHE:                 {{strength | running | yoga | nutrition only | online general}}
BRAND_COLORS:          {{background #0b0b0d, text #f4f4f5, accent #e11d2e, muted #8a8a93 or new}}
LOGO:                  {{none yet, design 3 options | file attached}}
GITHUB_REPO:           {{owner/name}}   # Pages site will be https://<owner>.github.io/<name>/
SUPABASE_PROJECT:      {{project id}}   # never touch any other project
FEATURES ON:           {{training, nutrition, progress, habits and check-ins, chat, bookings, community, workout videos, health consent, push notifications, Android download}}
MY EXISTING MATERIAL:  {{exercise list, meal plans, Instagram reel links, logo, welcome text}}
LEGAL:                 {{privacy policy URL or "I will add it"; consent wording reviewed by: ...}}
```

If a value is missing, ask for it or pick a sensible default and tell me which you chose.

### 2. Fixed technical decisions (do not re-debate)

- Frontend: React 19, Vite, TypeScript, react-router with `BrowserRouter` and `basename` from `import.meta.env.BASE_URL`. No UI framework; hand-written CSS with variables. Icons as inline SVG paths.
- Backend: Supabase only (Postgres with row-level security, Auth, one private storage bucket for progress photos, Realtime on chat messages, edge functions). No other server.
- Hosting: GitHub Pages, deployed by a GitHub Action on every push to `main`. Copy `index.html` to `404.html` so deep links work. Supabase URL and anon key come from GitHub repository variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Phone first at 390 px; a sidebar layout on desktop. Dark, premium look using the brand colours. Touch targets at least 44 px. No sideways scroll anywhere.
- Plain, friendly copy. No emojis in the UI. Sentence case headings.

### 3. Roles and security model

Two roles: `coach` and `client`. A `profiles` row is created for every auth user by a trigger. A user can edit only their own name; the role column is locked so clients cannot promote themselves.

- Clients read and write only their own rows. The coach reads everything and writes library content (exercises, workouts, programmes, recipes, templates, resources, posts).
- `public.is_coach()` is `security definer`, executable only by signed-in users.
- The coach adds clients from the app through an edge function `create-client` that checks `is_coach()` as the caller and then uses the service role to create the auth user (email, temporary password, full name). Public sign-up is allowed but new accounts are clients.
- Progress photos: private bucket, folder per client id, policies so a client touches only their folder and the coach can read all.
- Server-only data (push keys) lives in a table with RLS on, no policies, and `revoke all` from anon and authenticated.
- Every table gets row-level security tests (section 9).

### 4. Data model (tables)

Create all of these in `supabase/schema.sql` (the single source for a fresh install) with RLS policies. Add a `migrate_vN_<name>.sql` file for every later change.

Core and people: `profiles` (id, full_name, role, created_at).
Training: `exercises` (name, muscle, equipment, category in strength/cardio/mobility/plyometric/core, instructions, video_url, created_by), `workouts` (name, description, format in standard/circuit/amrap/emom/intervals, duration_min, rounds, created_by), `workout_items` (workout_id, exercise_id nullable, exercise_name, sort, group_label for supersets, sets, reps text, load text shown as Effort, weight text shown as Weight, percent_1rm, rest_sec, tempo, notes, cardio_time, cardio_distance_km, cardio_speed_kmh), `programs` and `program_days` (week, day, workout_id), `client_workouts` (client_id, workout_id, date, status scheduled/done/skipped, log jsonb, rating, client_note, completed_at), `one_rep_maxes`.
Tracking: `measurements` (weight, body fat, notes), `habits` and `habit_logs`, `checkins` (mood, energy, sleep, note), `metrics` and `metric_logs` (coach-defined custom metrics), `progress_photos`.
Nutrition: `foods` (per 100 g macros), `recipes` (macros, ingredients with quantities, steps, image_url), `nutrition_targets`, `meal_plan_items`, `meal_plan_templates` and `meal_plan_template_items`, `food_logs`.
Engagement: `messages` (one conversation per client, read_at), `posts` (announcements with publish_at and pushed_at), `challenges` and `challenge_entries` with a leaderboard function, `resources` (links and Instagram videos), `sessions` and `bookings` (coach slots clients can book).
Compliance and push: `client_health` (allergies, health conditions, medication, emergency contact, three consent booleans, consent_version, consented_at), `push_subscriptions`, `push_config`.

Seed data (safe to re-run, deterministic ids with uuid v5, `on conflict do nothing`): an exercise library (about 100 to start, more from my material), starter workouts and programmes, a food list with macros, recipes with photos, weekly meal plan templates. Never copy text or photos from other sites; write fresh and keep only facts.

### 5. Features by phase

Phase 0, foundation: repo, Vite app, CI, Pages deploy, Supabase schema and RLS, login, role-based shell (bottom tab bar on phones with a More drawer, sidebar on desktop), design system, logo, empty states, skeleton loaders, offline bar.
Acceptance: coach and client can sign in; a client cannot read another client's data; the site deploys.

Phase 1, coach core: dashboard (who trained, who is quiet), clients list and add client, client detail with tabs (overview, training, nutrition, habits, progress, photos), exercise library with search and filters, workout builder, programme builder, assign workout or programme to a client with date and weekly repeat, "Custom workout" for one client that saves and assigns in one flow.
Acceptance: coach builds a workout, assigns it for today, and the client sees it.

Phase 2, client training: Home (today's workout, week count, calories, habits, daily check-in, latest coach message), Train (week view), workout player with set logging, rest timer that starts when a set is ticked, previous-time hints, personal bests, finish with rating and note, screen kept awake. Weight accepts kilos or a percent of the client's saved max. Cardio exercises use time, distance and speed fields chosen by workout format, and the missing one is calculated.
Acceptance: a client completes a workout and the coach sees the result.

Phase 3, nutrition: food diary with macros and targets, targets with a suggested protein, carbs and fat split, recipe book with photos and a random-meal idea, weekly meal plans with a shopping list that totals ingredients and seasonings, coach applies a plan to a client (optionally fitted to their calorie target), diary can browse the next 28 days.

Phase 4, progress and habits: measurements, charts, progress photos uploaded from the device (front, side, back, back view, several angles), habits, custom metrics, 1RM table.

Phase 5, engagement: chat with unread badges and Realtime, community announcements and challenges with a leaderboard, "Workout videos" page that plays Instagram reels from pasted links (official embed, loaded on tap, grid with player and previous and next), booking of coach slots.

Phase 6, health and consent: after login, before anything else, a highlighted form for allergies, health conditions, medication (optional), emergency contact (optional), with a None tick for each, and three required consent ticks (keep personal details; coach may use the health information for safe training and nutrition; information is correct). Saved to `client_health` with date and version. Coach sees it on the client overview with allergies and conditions highlighted. Clients can edit under Account. Bump the version constant to ask everyone again. Never lock a client out when offline or when the check fails. Tell me the wording is not legal advice and must be reviewed.

Phase 7, install and notifications:
- Installable PWA: manifest, generated icons (192, 512, maskable, Apple touch), service worker caching only the app shell, built assets, fonts and photos, never Supabase data. Open offline from the last saved profile. Install card on More (one tap on Android, steps on iPhone). Public `/get-app` page.
- Push: edge function `send-push` (web-push), VAPID keys and a shared secret in `push_config`, database triggers via pg_net for new chat messages and announcements, a daily cron for workout reminders at a time that suits BUSINESS_PLACE, a cron every 5 minutes for scheduled announcements, a toggle under Account. iPhone only after the app is on the Home Screen.
- Android download: a thin Capacitor wrapper in `mobile/` that opens the live site, built by a GitHub Action into a release asset `PTPN.apk` (use the brand name). Debug-signed is fine. State that it has no web push, and that the Chrome install is better. iPhone has no free download; say so on the page.

### 6. Design system

One palette from BRAND_COLORS, a display font for headings and a clean sans for text, cards with soft borders and subtle red glow on primary actions, pill chips for filters, bottom sheets for forms, a slide-in More drawer. The logo is a monogram or symbol built from simple geometry in SVG with a custom wordmark drawn from the same parts. Keep one master SVG in `branding/`, a script that regenerates every icon from it, and a short brand sheet. If I have no logo, design three options first and let me pick.

### 7. Repository layout

```
src/                 app code (pages/, components/, lib/)
public/              sw.js, manifest.webmanifest, icons/, favicon.svg
supabase/            schema.sql, migrate_vN_*.sql, seeds, functions/, tools/
mobile/              Capacitor Android wrapper
branding/            master logo, icon generator, brand sheet
tests/               db.test.mjs, e2e.mjs, shim.mjs, README.md (own package.json)
docs/                PROJECT_HANDOFF.md, MASTER_PROMPT.md
.github/workflows/   deploy.yml, test.yml, android.yml
.claude/skills/      app-builder/SKILL.md
```

### 8. Working rules

- Work on the branch the session gives you. Start each piece from the latest `main`. One pull request per piece, squash merge after the Tests check passes, then check the Deploy run and tell me whether it finished, with the run number. Never say a deploy finished without checking.
- Apply every database migration to the live Supabase project before the app that needs it is deployed. If a write needs my approval and is blocked, give me the SQL and the SQL editor link.
- Secrets never go in the repo. Send one-off secret SQL to me as a file.
- Keep messages short and plain. No em dashes, no emojis. Say what you built, what you tested, and what could not be tested without a real phone.
- Confirm with me before anything destructive or outward-facing.
- Keep `docs/PROJECT_HANDOFF.md` current and write `.claude/skills/app-builder/SKILL.md` for this app at the end of phase 0 and update it after each phase.

### 9. Tests and CI (build with each phase, not at the end)

- `tests/db.test.mjs`: in-memory Postgres (PGlite) loaded with the real schema and seeds. Checks who can read or write what for every table, library counts, cascading deletes, push keys unreadable by clients, health data readable by the coach but not changeable.
- `tests/e2e.mjs`: a small Supabase-compatible HTTP shim over PGlite plus Playwright. Drives the coach and client flows, a phone profile for iPhone and Android (manifest, icons, offline reload, install card, Get the app page), and checks for runtime errors and sideways scroll. Fake an undecided notification permission and wait for elements instead of counting once, because the CI browser is slower and stricter than a local one. Make checks hold on any weekday.
- `test.yml` runs the type check and both suites on every pull request and push to `main`, and keeps screenshots as an artifact. Look at the screenshots for anything visual and fix what looks wrong before shipping.

### 10. Definition of done for each phase

Type check clean, both suites pass, screenshots looked at, migration applied to the live project, pull request merged, Deploy run succeeded and reported with its run number, handoff doc and skill updated, and a short list of steps I must do myself (run a SQL file, switch on a dashboard setting, test on my phone).

### 11. What to ask me first

Use the question tool for 3 or 4 questions, for example: which features are on, whether I have a logo and an exercise list, my brand colours, my units and time zone, and which phase to start with. Then confirm the plan in five lines and start phase 0.

## END PROMPT

---

## One coach, one stack (decision for selling to other coaches)

Give every coach their own GitHub repo, their own Supabase project and their own Pages site. Reasons: health and training data stays separated by default, a bug or a bad migration affects one coach, each coach can export or delete everything, and billing and ownership are clear. Costs are the Supabase plan per coach (the free tier is enough to start) and your time per setup.

Each coach is the controller of their clients' data. Before you hand over an app:
- Put the coach's own business name, contact and privacy policy in the app and the consent text.
- Have the consent wording checked by someone qualified in the coach's country.
- Tell the coach how to delete a client's data (deleting the user removes everything linked to them).

A true multi-tenant version (all coaches in one database, a `tenant_id` on every table and every policy) is possible later, but it is a bigger build and a bigger risk. Start with one stack per coach.

## Clone and rebrand (the fast route, about a day)

1. Create the new repo and copy this repo in without history. Create a new Supabase project.
2. Run `supabase/schema.sql`, then the seed files, in the new project. Deploy the edge functions `create-client` and `send-push`. Run a fresh push keys SQL (new VAPID keys and secret, new `app_url`).
3. In the new repo set the variables `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` and switch on GitHub Pages (source: GitHub Actions).
4. Rebrand:
   - `branding/ptpn-logo.svg` and the shapes in `src/components/Logo.tsx`, then `node branding/make-icons.mjs`.
   - Colours and fonts in `src/index.css` variables, `theme-color` and `apple-mobile-web-app-title` in `index.html`, `name` and `short_name` in `public/manifest.webmanifest`.
   - The text "PTPN" and "Personal training" in `Logo.tsx`, `Login.tsx`, `GetApp.tsx`, `Install.tsx`, `capacitor.config.json` (`appName`, `appId`, `server.url`) and `.github/workflows/android.yml` (APK name and release text).
   - The coach contact in `supabase/schema.sql` (`push_config.subject` default) and the release URL in `src/components/Install.tsx` (`APK_URL`).
   - The reminder time in the cron SQL (`migrate_v4_push.sql`) for the coach's time zone.
   - Replace seeds that are specific to the first coach (exercise list, videos, recipes) and update the counts in the tests.
5. Make the first coach account in Supabase Auth, set its `profiles.role` to `coach`, then run the tests and ship.
6. Update `docs/PROJECT_HANDOFF.md` and `.claude/skills/app-builder/SKILL.md` for the new app.
