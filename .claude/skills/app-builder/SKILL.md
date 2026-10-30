---
name: app-builder
description: How to build, change, test and ship features in the PTPN coaching app (React, Vite, TypeScript, Supabase, GitHub Pages) end to end. Use when the user asks to add or change an app feature, screen, database table, notification, logo or icon, install or download option, asks to turn a recipe or meal plan site into meal plan templates, recipes and photos, or asks to "deploy", "ship", "check the deploy" or "save it". Covers the working style, the code map, the database rules, the test and release flow, and the gotchas learned building it.
---

# PTPN app builder

PTPN is a premium dark, phone-first personal training app for one coach (Pedro Neves) and his clients. No payments. Live at https://nevespedropt-prog.github.io/PTPN/ . Repo: nevespedropt-prog/PTPN. Supabase project id: `dstxexfkxejmolnulwli` (never touch the other project, "MYGYM APP"). Read `docs/PROJECT_HANDOFF.md` first for the current state, then this file for how to work.

## How the user works (follow this)

1. For anything bigger than a small tweak, ask 3 or 4 clarifying questions with the AskUserQuestion tool before building. When the user says "go", "surprise me" or gives no preference, pick a sensible default, say what you chose, and keep it easy to change.
2. Short, plain messages. No em dashes, no emojis, no bold lead-in labels in prose, sentence case headings. Say what was built, what was tested, what could not be tested.
3. Always report whether the deploy finished, and never say it finished without checking the workflow run. If a check is still running, say so.
4. Confirm before destructive or outward-facing actions (drops, deletes, sending anything to third parties). Tell the user when a step needs their approval and give them the SQL plus the SQL editor link: https://supabase.com/dashboard/project/dstxexfkxejmolnulwli/sql/new
5. Mention one improvement or automation idea when it is relevant, not every time.
6. Do not claim you saw something on a real phone. The sandbox has only desktop Chromium, cannot reach github.io, Instagram or Pexels, and has no Android SDK. Say which things need a real-device check.
7. Read `AGENTS.md` at the repo root first. It holds the standing rules: one scoped change at a time, no polling loops (check CI or a deploy once after its normal window), stop and re-diagnose when the same approach fails twice, never claim passed, merged or live without checking once.

## Code map

- `src/App.tsx`: shell, routes, bottom tab bar, "More" drawer, coach and client route sets. `/get-app` is public.
- `src/pages/`: `client/` (Home, Train, Nutrition, Progress), `coach/` (Dashboard, Clients, ClientDetail, Library, WorkoutBuilder, ProgramBuilder, Assign), plus `WorkoutPlayer`, `MealPlans`, `Recipes`, `Resources` (shown as "Workout videos", route `/resources`), `Community`, `Chat`, `Account`, `More`, `GetApp`, `Login`.
- `src/components/`: `Logo.tsx` (mark and custom wordmark), `Consent.tsx` (health and data consent gate), `Install.tsx` (install card, offline bar, APK link), `Pickers.tsx`, `ui.tsx` (Sheet, Empty, Skeleton...), `Icon.tsx`.
- `src/lib/`: `training.ts` (prescription text, weight parsing, cardio fields per workout style), `nutrition.ts`, `push.ts`, `oneRepMax.ts`, `supabase.ts`.
- `src/auth.tsx`: session and profile (profile is cached in localStorage so the app opens offline).
- `public/`: `sw.js` (service worker, bump `VERSION` when caching rules change), `manifest.webmanifest`, `icons/` (generated), `favicon.svg`.
- `supabase/`: `schema.sql` (full schema with row-level security), `migrate_v*.sql` (upgrades for the live DB), seeds (`seed.sql`, `seed_meal_plans.sql`, `seed_common_meals.sql`, `seed_videos.sql`), `functions/` (edge functions `create-client`, `send-push`), `tools/` (Python seed builders).
- `mobile/`: thin Capacitor Android wrapper that opens the live site. Built by `.github/workflows/android.yml` into the `android-latest` release (`PTPN.apk`).
- `branding/`: master logo `ptpn-logo.svg`, `make-icons.mjs` (regenerates every icon), all explored logo options, brand sheet, example welcome guide.
- `tests/`: own `package.json`. See below.
- `.claude/skills/import-meal-plans/`: separate skill for importing meal plan sites.

## Design rules

Dark premium look: background #0b0b0d, chalk #f4f4f5, PTPN red #e11d2e, steel #8a8a93. Phone first (390 px wide), then a sidebar layout on desktop. Reuse existing classes (`card`, `stack`, `row`, `field`, `inline-inputs`, `chips`, `badge`, `btn`, `ghost`, `soft`, `sm`) and the `Sheet` component before writing new CSS. Touch targets at least 44 px. Never leave a page that can scroll sideways.

## Database rules

- Every table has row-level security. Clients read and write only their own rows; the coach can read everything. Helper `public.is_coach()` is locked to signed-in users.
- Schema change = three places: append to `supabase/schema.sql` (fresh installs), add `supabase/migrate_vN_<name>.sql` (existing DB), and apply it to the live project with the Supabase `apply_migration` tool. Apply the migration before the app that needs it is deployed, or saves will fail.
- Server-only data (for example `push_config`) uses RLS with no policies and `revoke all` from anon and authenticated. Secrets never go in the repo. A one-off secrets SQL file is sent to the user, not committed.
- Seed ids are deterministic: `extensions.uuid_generate_v5('6f1c1e4a-8d3b-4c55-9a9e-5b1d2e7c0a11', 'kind:name')`, wrapped as `pg_temp.sid(text)` (redefine it in every `apply_migration` chunk). Seeds use `on conflict (id) do nothing` so they are safe to re-run.
- **New tables inherit wide default grants.** Supabase gives `anon` and `authenticated` all privileges on every new table in `public`, so RLS is the only guard. In each migration `revoke all ... from public, anon, authenticated` and grant back only what is needed (look at `migrate_v7_client_archives.sql`). Views need `with (security_invoker = true)`. Audit with `get_advisors` after DDL.
- **Private columns:** anything the coach must keep from a client (notes, internal remarks) goes in its own coach-only table, never a column of a table the client can read. The app hiding it is not protection, `select *` returns it.
- **Approvals:** Supabase `apply_migration` and `execute_sql` ask the user to approve some statements (destructive ones such as drop column). If the prompt is never answered the call times out after 230 seconds. Do not retry the same call. Plain `create table` and policy statements went through; for the rest, add the new things first, deploy, then hand the user the destructive SQL as a file. Add before you remove, so the live app never breaks between steps.
- `execute_sql` returns only the last statement's result. Some writes and DDL need the user's approval in the session; if blocked, hand the user the SQL.
- Things that need pg_net or pg_cron (triggers that call edge functions, schedules) go in a migration file only, not in `schema.sql`, because the in-memory test database does not have them.

## Build loop

1. Branch: the session gives a work branch (`claude/nice-knuth-bt7xu7`). Start each piece of work from the latest main: `git fetch origin main && git checkout -B <branch> origin/main`.
2. Make the change. Keep it minimal and match the surrounding code.
3. `npx tsc -b` must be clean.
4. Add tests (see below) and run them: `cd tests && CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test`. Look at the screenshots in `tests/.out/shots/` for anything visual and fix what looks wrong.
5. Commit with a clear message. Commit messages end with the attribution lines given in the session reminder.
6. `git push -f -u origin <branch>`, open a PR (body ends with the attribution line from the reminder), wait for the Tests check, squash merge. Then check the Deploy run (about 30 to 70 seconds) and report the result. Merging to main also triggers the Tests run and, when `mobile/**` changed, the Android build.
7. GitHub MCP quirks: `pull_request_read` method `get_check_runs` for PR checks (can be empty for a minute after opening); `actions_list` method `list_workflow_runs` with `workflow_runs_filter` `{"branch":"main","event":"push"}` to see deploys (the `workflow_id` argument does not filter); `get_job_logs` needs `job_id` and returns the tail, so request enough lines to include the failure; `actions_get` method `get_workflow_run` for one run. Wait with a background `sleep` (foreground sleep is blocked) and tell the user what you are waiting for.
8. After a squash merge the branch history differs from main. Always restart from `origin/main` for the next piece of work.

## Tests

- `tests/db.test.mjs`: PGlite (in-memory Postgres) loaded with the real schema and seeds. Checks row-level security and library counts. When you add a table, add policy checks. When seeds change, update the counts here and in `shim.mjs` and `e2e.mjs`.
- `tests/e2e.mjs`: builds the app against `tests/shim.mjs` (a Supabase-compatible HTTP shim) and drives Chromium through coach and client flows, plus iPhone and Android profiles (manifest, offline, install card, Get the app, cardio logging).
- `.github/workflows/test.yml` runs the type check and both suites on every PR and push to main. The CI browser is newer than the sandbox one. Known differences: headless Chrome reports `Notification.permission` as denied (the test fakes "default"), and timing is slower, so wait for elements instead of counting once.
- Write checks that survive any weekday and date rollover. Target items by name (for example the 'Push' workout), not by position.

## Feature notes and decisions to keep

- Weight field accepts kg ("80"), a percent of the client's saved max ("75%") or text; old `percent_1rm` is kept in sync. Effort holds the old `load` text (RPE 8).
- Cardio is detected from the exercise library category `cardio`. Fields shown depend on workout format (`CARDIO_FIELDS` in `training.ts`). Missing time, distance or speed is worked out on blur and when a round is ticked.
- Health and data consent: `ConsentGate` wraps the client app. Bump `CONSENT_VERSION` in `Consent.tsx` to ask every client again. Offline or server errors never lock a client out.
- Push: `send-push` edge function plus triggers and cron in `migrate_v4_push.sql`; keys live in `push_config`. iPhone only gets push after the app is added to the Home Screen. The Android APK has no web push; the Chrome install does.
- iPhone has no free downloadable file. App Store or TestFlight needs an Apple Developer account (about $99 a year) and a Mac or cloud build. The user chose to pay for nothing, so iPhone stays Add to Home Screen.
- No credits, "inspired by" lines or photo credits are shown anywhere in the app.
- Coach ticks (29 October): `coach_acknowledgements` keyed by item and fingerprint (`src/lib/ack.ts`). A tick is valid only while the fingerprint still matches, which is how new items show as unchecked.
- Health screening lives in `taster_sessions` (PAR-Q answers and two consent flags). Coach edits it in the taster tab, clients get a read-only view on Account and `/taster-session`. Coach private notes are in `taster_session_notes`.
- `/` redirects to `/home` for clients. Tests must accept either pathname.
- Source files must stay valid UTF-8. A previous tool corrupted the middle dot into U+FFFD; check with `grep -rn $'\xef\xbf\xbd' src`.
- Minimisable boxes: use `<details className="card collapsible-card">` with no `open` attribute so every box starts closed. Tests must open the box before reading inside it (see `openBox` in `tests/weekly-checkins.mjs`).
- Sessions are arranged by the coach (Sessions page, `CoachSlots.tsx`). Clients have no booking page. `bookings.session_id` is unique.
- Workout builder: "Add set line" adds another row for the same exercise (no unique constraint on `workout_items`). Clients edit their own workouts through `/build/:workoutId?cw=:id`.
- Client Home shows one "Your week" box for finished workouts. Progress has four tabs (Body, Strength, Photos, Workouts); Workouts is `MonthlyReport.tsx` (month picker, tiles, six-month bars, the month's workouts in one closed box, strength, coach review) and holds nothing about weight, body fat or photos.
- Train, Schedule shows one week at a time with arrows; clients set the date of their own workout in the builder (`?cw=`).
- Exercise library: names are unique per built-in (case-insensitive). New batches go in `supabase/tools/more_exercises.py`, are checked against every existing name, and need a migration with `on conflict do nothing`. Sled, burpee and mountain-climber style moves are strength, never cardio. Biceps curls say "bicep" in the name. Search is `src/lib/exerciseSearch.ts` (name, muscle, equipment, type, with everyday aliases); do not filter exercises by name alone.
- Anything that lists exercises must not cap at a few hundred rows (the library is 626) and each row gets the play button (`DemoLink`). Row buttons cannot contain links: wrap them in `.exrow`.
- Workout videos are Instagram reels. The app cannot fetch their images; the coach sets thumbnails (bucket `video-thumbnails`, `resources.thumbnail_path`).
- Supabase connector: SQL containing `delete` or `drop` is held for approval and times out. Split it, or give the user the SQL and the editor link.
- New tests that touch a client page need a `client_health` consent row for the user, or ConsentGate blocks the page. Delete it afterwards.
- Never run two e2e runs at once (both use port 4180). Set `CHROMIUM_PATH=/opt/pw-browsers/chromium`.
- Supabase MCP: statements with `revoke`, `drop` or `grant ... delete` can raise an approval prompt that never reaches the session and times out. Send plain `create` statements, or give the user the SQL and the editor link. After a squash merge, reset the work branch to `origin/main` before the next change.
- Logo: rising P (three bars, tallest becomes a red P) with a custom wordmark. Regenerate all icons with `node branding/make-icons.mjs`.

## Meal plan import (build meal plans from a recipe site)

Pipeline used for the first meal plan import (plans 206 to 215). Reference files: `supabase/data/tbfs-meal-plans.json`, `supabase/tools/meal_data.py`, `supabase/tools/build_meal_plans.py`, `supabase/data/photos.json`.

### Ground rules

1. Keep facts only from the source: plan numbers, dish names, dates, URLs, rough costs. Never copy recipe text, photos or PDFs.
2. Write every recipe fresh. Re-balance portions for training diets (about 500 to 750 kcal, 40+ g protein for meat dinners).
3. Macros come from the food list, never from the source. Say they are estimates.
4. The user does not want credits or "inspired by" lines shown in the app, so none are stored or displayed. Keep the scraped facts in the data JSON only.
5. If the user says "top N download" and the site shows no counts, use the N newest and say so.
6. Tell the user what was copied (facts), what was rewritten, where photos come from and where the data is saved.

### Steps

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

### Gotchas

- Ingredient labels are lower-cased by `ing_label`, so proper nouns need to be in its exception list (`Greek`, `BBQ`, `Dijon`).
- Recipe titles with apostrophes need doubled quotes in SQL (the builder's `q()` handles it).
- Photos hotlink from Pexels. The app falls back to a gradient banner when an image fails.
- Update test expectations (recipe and food counts) in the harness when the library grows.

## Verify before you claim (avoid repeat mistakes)

Mistakes in earlier sessions came from guessing instead of checking. Do these every time.

1. **Check the real state first.** Before answering "deploy", "is it live" or "what is left", run `git status`, compare the branch with `origin/main`, and look at the latest workflow runs. If nothing is pending, say so in one line instead of redoing work.
2. **Read before you write.** Open the file you are about to change and the files that use it. When renaming a label or field "everywhere", `grep -rn` for every spelling (UI text, types, tests, docs, seeds) and fix them all in the same commit.
3. **UI copy must match the real UI.** Before writing user-facing text (guides, steps, help text), grep the app for the exact button and page names. Do not describe a control from memory (for example "the dice"); use the label that is on screen.
4. **Run the whole suite, not part of it.** Use `cd tests && CHROMIUM_PATH=/opt/pw-browsers/chromium npm run test`. It rebuilds the app first. `npm run test:e2e` alone reuses the previous build and can test stale code.
5. **Reproduce CI failures with evidence, not guesses.** When CI fails on something that passes locally, read the failing line from the log, then add one temporary diagnostic (print the page state) and push once, instead of trying fixes one at a time. Known cause so far: CI Chrome is newer (notifications start as denied, slower timing). Remove diagnostics afterwards.
6. **Offline and slow network.** Supabase calls retry for several seconds when offline, so anything that blocks the first screen must have an offline shortcut (see the profile cache and the consent gate).
7. **Look at the screenshots** of every changed screen at phone width before saying it works. Fix layout problems found there.
8. **After DDL, run the Supabase advisors** (`get_advisors`, security) and mention anything new that is not intended.
9. **Never say "live", "fixed" or "tested" unless you saw it.** Say "merged, deploy running" until the deploy run shows `success`. Say what was only tested in the sandbox.
10. **Check the working tree before ending a turn.** Untracked or uncommitted files trigger the stop hook. Commit them to the branch (or delete scratch files). Scratch work belongs in the scratchpad directory.

## Be efficient

- **Parallelise.** Make independent tool calls in one message (read several files, push and open the PR, check a PR and start a timer).
- **One wait, not many.** After opening a PR, start one background `sleep` of about 120 to 150 seconds, then check. Do not post a reply for a timer notification that carries no news; just run the check and answer with the result.
- **Keep tool output small.** `list_workflow_runs` ignores `per_page` and the filters and returns about 20 full runs, so call it once per merge and read only the first entries (newest first: Tests, Deploy and, for `mobile/**` changes, Build Android app, all for the merge commit). Note their run ids and poll those with `actions_get` `get_workflow_run`, which returns one run. Use `tail_lines` just big enough for `get_job_logs`.
- **One PR per request.** Put code, tests, docs and test fixes for a request in as few commits as possible so CI runs once. Run the full local suite before pushing so CI does not find what you could have found.
- **Do not repeat explanations.** Final message: what changed, what was tested, what needs the user, in a few short paragraphs. Do not recap earlier work.
- **Reuse.** Copy the pattern of the nearest existing feature (a migration, a Sheet form, a test block) instead of inventing a new one.
- **Ask once, up front.** If the request is ambiguous, ask the 3 or 4 questions in one AskUserQuestion call; if the user says "go", choose defaults and list them.

## Final checklist before saying "done"

- [ ] Read the code first; searched for every usage of anything renamed
- [ ] tsc clean, full local suite passes (`npm run test`), screenshots looked at
- [ ] Migration applied to the live project if the schema changed (and committed as `migrate_vN`)
- [ ] PR merged, Deploy run succeeded (state the run number and time), Tests run on main noted
- [ ] Nothing claimed that was not seen; working tree clean and pushed
- [ ] Told the user what could not be tested without a real phone
- [ ] `docs/PROJECT_HANDOFF.md` updated if the feature changes how the app works
- [ ] Open items listed (user-side steps such as running SQL, switching on dashboard settings)
