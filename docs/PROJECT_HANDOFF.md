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


## Installable app (PWA)
The app installs to the home screen on Android (Chrome install prompt) and iPhone/iPad (Share, Add to Home Screen; the More page shows the steps). Files: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` (generated from `branding/ptpn-logo.svg`, see `branding/README.md`), `src/components/Install.tsx`. The service worker only caches the app shell, built assets, fonts and recipe photos; it never caches Supabase data. Offline the app opens from the saved shell and last-known profile and shows an offline bar, but data screens stay empty until the phone reconnects. Bump `VERSION` in `public/sw.js` if the caching rules change. The workout player keeps the screen awake. Not built yet: push notifications (chat, workout reminders, announcements), native store apps.

## Getting the app on phones (no store accounts, no cost)
- Public page `/get-app` (linked from the login screen and the More page): Android Chrome install, Android .apk download, iPhone Home Screen steps.
- Android .apk: `mobile/` is a thin Capacitor wrapper that opens the live site, so web changes never need a new APK. `.github/workflows/android.yml` generates the Android project, builds a debug-signed APK and publishes it as the `android-latest` release (`PTPN.apk`). It runs when `mobile/**` changes or from the Actions tab. The APK does not get web push notifications (Android WebView has no Push API); the Chrome install does. Adding push to the APK would need a free Firebase project.
- iPhone: Apple has no free route to a downloadable file, so it is Add to Home Screen only. A TestFlight or App Store app needs an Apple Developer account (about $99 a year) and a Mac or cloud build.

## Skills
`.claude/skills/app-builder/SKILL.md` (APP BUILDER SKILL) describes how to build, test and ship features in this app. `.claude/skills/import-meal-plans/SKILL.md` covers importing meal plan sites.

## Client archive (24 October 2026)

The coach Clients page separates active clients at the top and archived clients at the bottom. Each active card has Archive client with confirmation. Archived cards have Restore client. Search covers both groups. Archiving preserves accounts, plans, history and sign-in; it does not delete or disable clients. Dashboard metrics and other client pickers are unchanged.

Archive markers use public.client_archives with coach-only RLS. Clients cannot inspect or change these markers. Restore removes only the archive marker. For existing installs apply supabase/migrate_v7_client_archives.sql before deploying this app version; schema.sql includes the same definition for fresh installs.

Database checks cover coach-only filing, denied client/anonymous access, preserving history and cascading marker cleanup. Browser checks cover cancellation, archive/restore persistence, search, section ordering and phone width. The test workflow is the release gate. Local package downloads are blocked in the ChatGPT environment, so full validation runs in GitHub Actions. Real-phone interaction still needs checking.

## Gold brand update (24 October 2026)

Replaces the old red rising-bars identity with Pedro's approved gold PTPN Be fit artwork. Source: public/brand/ptpn-gold-approved.webp; Logo.tsx shows the same approved image using cropped SVG viewports. The original PNG remains in ChatGPT for future website use. The icon master is a raster-backed SVG wrapper, not a newly drawn vector logo.

Theme tokens use warm charcoal, champagne gold and ivory. Primary controls, navigation, charts, avatars, cards, login and install assets are updated; errors, successes and nutrition categories remain distinct. The service-worker version is bumped to ptpn-gold-v3 and caches same-origin static brand files for offline use without caching Supabase data. See branding/README.md for palette and regeneration details.

No database changes. Full type, database and browser checks run on the release PR before merge. Tests cover approved artwork on desktop, phone and login, plus existing functional flows. Installed icons may require a home-screen shortcut refresh on real devices.


## Browser tab icon refresh

index.html uses favicon-gold-v1-32.png plus a multi-size favicon-gold-v1.ico fallback. Both use the approved gold monogram. A new filename avoids old favicon.svg entries retained in browser favicon caches. No database changes.


## Runtime browser icon replacement

Brave retained the old red favicon after static links changed. src/lib/branding.ts now installs the approved 32px PNG as a bundled data URL at startup and on pageshow, removing old icon links. This avoids HTTP favicon cache lookups. Static gold PNG/ICO fallbacks remain, and public/favicon.ico covers conventional fallback requests. Service-worker version is ptpn-gold-v4. Regression checks cover exact image bytes and restoration of a page with stale icon links.

## Weekly check-ins and coach reviews (25 October 2026)

Clients have a fixed weekly form on Home alongside daily check-ins. Weeks run Monday to Sunday; Sunday is suggested, with submission available any day and the previous 12 weeks accessible. Answers cover training, nutrition, average sleep and energy, biggest win and difficulties. One immutable submission per client/week prevents answers changing underneath a coach review. The coach can submit or update separate feedback and next week's focus, visible to the client.

The coach dashboard lists pending reviews among the latest 100 submissions, excluding archived clients. Each link opens the correct week in the client's Overview. Reviews show due workout completion, days with food entries (not nutrition adherence), and weight entries for that week. This feature adds no notifications, automated messages or new dependencies. Existing daily check-ins remain unchanged.

Apply supabase/migrate_v8_weekly_checkins.sql before deploying. weekly_checkins permits only own-client inserts and own/coach reads; submitted answers cannot be updated or deleted through the API. weekly_reviews permits only coach inserts/updates, with feedback readable by the owning client and coach. Both tables use RLS and deny anonymous access. Tests in tests/weekly-checkins.mjs are integrated into the existing DB/browser release checks and cover permissions, validation, submission, save failure recovery, feedback, week selection and phone layout.

## Faster food logging (25 October 2026)

Nutrition meal cards offer Copy previous day, with a preview and explicit Add copied meal action. Copying appends to the selected day/meal and preserves existing diary entries. Save this meal creates a named snapshot of all logged entries in that meal; even a single food can be saved. Add > Saved meals previews and logs these snapshots. Removing a saved meal requires confirmation and never deletes diary history. Shortcuts remain hidden on future plan days.

Snapshots preserve names, amount labels and calorie/macronutrient values at the time of saving. They intentionally omit source IDs and recipe/food links so they remain reusable if library items are removed. They do not recalculate from later recipe changes. All entries are added in one batch. Busy states prevent repeated clicks, and errors leave the preview available for checking/retry. No new dependencies, photo journalling or barcode scanning.

Apply supabase/migrate_v9_saved_meals.sql before deployment. saved_meals uses RLS: clients read/create/delete their own snapshots, coaches can read, anonymous access is denied. Account deletion cascades snapshots. Tests in tests/quick-meals.mjs cover permissions, validation, account cleanup, preview/cancellation, exact copied portions/macros, save/reuse persistence, deletion confirmation/history preservation and phone width.

## Exercise video and voice feedback (25 October 2026)

Workout exercise blocks have Technique feedback, including on completed workouts. Clients upload a short MP4/MOV/WebM clip (20 MB maximum) and an optional question. Files live in a new private exercise-videos bucket. The coach dashboard lists pending clips among the latest 100 submissions, excluding archived clients; links open the correct workout/exercise feedback sheet.

The coach can save written feedback (4,000 characters), a voice note, or both. Record uses the browser microphone only after a button press, stops after 60 seconds and releases the microphone on stop/close. Audio-file upload is a fallback (5 MB maximum). New notes can be previewed/discarded before saving; recording itself does not upload. Saving a replacement voice note removes the old object after the review is confirmed saved. Voice files live in the private exercise-voice bucket. On-demand signed URLs expire after 15 minutes. Browser codec and microphone permissions require a real-phone check.

Apply supabase/migrate_v10_exercise_feedback.sql before deployment. exercise_videos allows own-client inserts only for an exercise belonging to their assigned workout; clients cannot rewrite submissions or coach reviews. exercise_video_reviews permits coach writes and owner/coach reads. Storage policies restrict clips to client folders and voice writes to the coach. No public media URLs, new dependencies, automatic messages or new service-worker data caching.

Exercise names and item IDs are kept as snapshots, so editing/removing a template exercise does not discard existing feedback. Removing a client/workout cascades metadata and reviews. Stored media must also be removed through the Storage API/dashboard when deleting a client or workout; SQL cascades do not remove stored file bytes. Failed metadata saves clean up uploaded files only after confirming the write did not succeed. The test shim now enforces signed media access and serves real upload bytes for playback tests.

Focused tests in tests/exercise-feedback.mjs cover ownership, wrong-workout submissions, immutable requests, coach-only written/audio responses, storage isolation/limits, template-edit history, genuine video playback, invalid signed URLs, permission denial and real recording/encoding with a synthetic microphone stream, client audio playback and phone width. Screenshots are retained in CI; manual visual/device checks remain outstanding.
