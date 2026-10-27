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
The app installs to the home screen on Android (Chrome install prompt) and iPhone/iPad (Share, Add to Home Screen; the More page shows the steps). Files: `public/manifest.webmanifest`, `public/sw.js`, `public/icons/*` (generated from `branding/ptpn-logo.svg`, see `branding/README.md`), `src/components/Install.tsx`. The service worker only caches the app shell, built assets, fonts and recipe photos; it never caches Supabase data. Offline the app opens from the saved shell and last-known profile and shows an offline bar, but data screens stay empty until the phone reconnects. Bump `VERSION` in `public/sw.js` if the caching rules change. The workout player keeps the screen awake. Web push code, server function, triggers and schedules exist for chat, workout reminders and announcements. Actual delivery still requires a real registered device check. Native store distribution remains separate.

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

## Remove accidental personal workout sessions (25 October 2026)

Train now offers Remove workout on unfinished sessions whose workout was created by the signed-in client, including Coming up. A confirmation sheet names the session and explains unfinished set entries will be removed. Cancel preserves it; failures leave the dialog available for retry. The delete query checks client ownership and excludes completed sessions atomically. Completed and coach-created sessions have no remove control.

Removal deletes only that client_workouts row, preserving the reusable workout definition and other sessions/history. Sessions with exercise video feedback are refused to avoid cascading review loss or orphaned private files. No schema or permission changes. Focused browser checks cover cancellation, completed/coach controls, failed-request recovery, persisted removal, empty accidental builds, preserved definitions, protected technique feedback and phone width.

## Priority bug review (26 October 2026)

Progress measurements reject non-positive weights and percentages outside 0 to 100, guard duplicate submissions, preserve failed-save drafts and show retryable read errors instead of pretending history is empty. Deletion has confirmation and checked results. Measurement values are validated in the app; this release does not alter database constraints or historical entries.

Build my own now checks session scheduling before navigating. If a response is interrupted it checks whether the session exists; when absence is confirmed it cleans up the unused workout definition and shows an error. Unknown write outcomes prompt a refresh before retrying.

Nutrition quick-add submissions have a synchronous duplicate-write guard. Planned/random meal writes and diary removals check errors and keep selections on failure. Diary reads show a retry action; request versions prevent older day responses overwriting the currently selected day. Day navigation clears the prior day's entries while loading, and is disabled during planned/random writes.

Progress photo reads expose failures, preserve existing rows on retry errors and hide false empty states. Upload metadata failures confirm write outcome before cleaning up uploaded files. Deletion checks file and metadata responses independently: a failed file delete keeps its record, while a partial deletion explicitly asks the client to retry cleanup. These two API calls remain non-atomic; real storage/network/device behaviour still requires checking.

No schema, dependency or design-system changes. tests/bug-review.mjs covers injected GET/POST/DELETE failures, invalid values, rapid submissions, cancellation, cleanup, slow date-response races and phone width. No real client records are used for these tests. Existing security advisor findings remain unchanged, including disabled leaked-password protection.


## Guided client onboarding (26 October 2026)

An optional Coaching setup card on client Home follows the existing health/consent gate. Three steps collect goals, experience, training location/equipment, preferred days and optional food preferences. Clients submit all steps together and can update their answers later. Save failures retain answers while the sheet stays open. Closing before saving discards the draft; no sensitive draft is put into local storage. No automatic assignment, target change or outgoing message.

The client confirms three first-week steps: review training, explore nutrition, and know how to contact the coach. Links open the existing pages. These are self-reported orientation steps, not workout or nutrition adherence. Each checkbox saves independently and the checklist collapses at 3/3 while remaining expandable. Editing answers preserves checklist progress. The coach sees read-only answers and checklist completion in each client's Overview.

Apply supabase/migrate_v11_client_onboarding.sql before deploying. client_onboarding has one row per client, RLS, own-client insert/update and owner/coach reads; anonymous access and API deletion are denied. Account deletion cascades onboarding. Existing clients are invited to complete setup too, without blocking access. No new dependencies, design tokens or changes to consent.

Focused tests in tests/onboarding.mjs cover role isolation, ownership changes, invalid values, account cleanup, optional entry, read failures, cancelled setup, failed saves, duplicate submits, persistence, checklist failures/retry, edits preserving checklist, coach read-only summary and phone width. Release checks run through the existing GitHub workflow. Manual visual and real-phone review of this new feature remain outstanding. Pedro confirmed the previous priority bug fixes work on his phone.


## In-app monthly progress reports (26 October 2026)

Progress now has a Monthly tab for clients and the coach's Client Overview > Progress screen. It defaults to the previous complete month and offers the latest 12 calendar months. The current month is labelled so far and stops at today. Workout consistency counts completed sessions against all sessions due, including skipped/missed, grouped by scheduled date, not completion timestamp. Future dates are excluded. Empty periods and failed requests are distinguished.

Weight trends average duplicate weigh-ins on each date, then use a seven-calendar-day rolling average of recorded daily weights, including preceding-month days where available. Missing days are not imputed. Only finite positive weights and body-fat values between 0 and 100 are included; this does not rewrite historical data. Body-fat change is labelled in percentage points. The existing Chart component is reused. Strength lists up to eight highest estimated 1RMs from completed weighted sets and compares the same exercise name with the previous calendar month using the existing personalRecords calculation. An absent baseline is explicit; estimates are not tested maximums. Photo access opens the existing private all-history viewer and its first/latest comparison, not a new monthly-only gallery.

Coach feedback and next-month focus are saved separately per client/month in monthly_reviews. Clients can read their own reviews and cannot write coach feedback. Coach edits are idempotent upserts; failed saves retain the text, duplicate clicks are guarded and switching months warns about unsaved edits. Summary data reflects current underlying records, not an immutable snapshot. No PDF export, notifications, automated plan changes, new chart library or new dependencies. A 1,000-row safety bound causes a retry/error state rather than silently presenting a truncated report. Editing the report does not edit client records.

Apply supabase/migrate_v12_monthly_reviews.sql before deployment. Composite primary key (client_id,month_start), first-of-month validation, bounded nonblank text, RLS, owner/coach reads, coach-only writes, anonymous and authenticated-delete denial, account-deletion cascade. Existing seeded schema includes the same table/policies.

Focused tests in tests/monthly.mjs cover calendar/leap/DST boundaries, duplicate/missing/invalid measurements, current-period cutoff, consistency counts, privacy, validation, saved-review cleanup, accurate displayed comparisons, private photo navigation, failed reads/writes, delayed month responses, duplicate submissions, preserving drafts, coach feedback visibility and phone widths. Thirteen calculation checks passed locally. Existing release workflow handles type/database/browser checks. Manual visual and real-phone review of the monthly tab remain outstanding.


## Coach-approved exercise alternatives (26 October 2026)

Coach Workout Builder offers Approved alternatives for each saved exercise. Choose a library exercise and prescribe its sets/reps or cardio fields, rest and notes. Approvals save separately from the template; new items must first be saved. The working weight, percentage, effort and tempo from the original are not copied to a substitute. Only the coach can create/edit/withdraw approvals; reads follow visibility of the parent workout item. No automatic alternatives are seeded.

Clients use Choose alternative in an unfinished workout, with confirmation before clearing unfinished entries for that block. Switching is disabled after any set is completed. Restoring the original before completing a set uses its original prescription. Strength/cardio controls follow the selected exercise. Other blocks and the template are preserved. The selected exercise and full prescription are stored as log.exercise_choices[item_id] snapshots while set logs keep their original block IDs. Withdrawn approvals or removed template items do not rewrite performed history. The player resolves snapshots even if the original item is missing, and previous-session placeholders are used only for the same performed exercise.

personalRecords now reads the selected snapshot when present, including after item removal; cardio choices do not generate weighted PRs. Existing Strength and Monthly screens reuse that helper. Technique clip writes match the actual selected exercise name, and clip cards display their saved names so clips from earlier choices remain distinguishable.

Player writes are queued. A switch flushes current edits and older autosaves before saving the selection; failed switches confirm the stored result before continuing. An uncertain outcome locks editing and asks for reload. Finish cancels pending timers and waits for queued writes, preventing stale autosaves from replacing the completed log. Failed writes show a retry; confirmed failures preserve the prior entries. No new dependency, automatic messaging or plan-wide substitution.

Apply supabase/migrate_v13_exercise_alternatives.sql before deployment. workout_alternatives has RLS, coach-only writes and parent-visible reads. A security-invoker trigger validates changed snapshots against a live approval and the correct workout item, rejects switches after completed sets or completion, and permits unchanged historical choices after approval/template removal. Its function has no public/anon/authenticated EXECUTE grant. The existing technique-video insert policy now recognises the selected snapshot. No existing session is switched automatically. Account/workout/media cleanup rules from the technique-feedback release remain unchanged.

Focused checks in tests/alternatives.mjs cover snapshot identity, no inherited load, history after deletion, previous-exercise matching, approval permissions, forged/wrong-item choices, completed-set locking, actual-name technique clips, cancelled/failed switches, an in-flight older autosave, cardio logging, restoring the original, finishing and PR attribution. Seven snapshot checks passed locally. Type/database/browser release gates run in GitHub Actions; manual visual and real-device review remain outstanding.


## Notification setup reliability and device verification (26 October 2026)

Read-only live checks confirmed configured push settings, active send-push function, enabled chat/announcement triggers and active schedules. No registered devices existed at the time of inspection, so actual phone delivery cannot be claimed. Pedro selected Android browser/web app for the device test. No test notification, chat message or announcement was sent during automated checking.

Account now confirms a browser subscription against push_subscriptions for the signed-in account before displaying on. Failed verification is a distinct retryable state. Setup, subscription and save failures release the controls; rapid duplicate enables are guarded. Failed server registration cleans up a newly created browser subscription. Disabling checks server deletion before reporting completion and scopes removal to this user's current endpoint, preserving other devices. Server deletion disables PTPN delivery even if local browser cleanup fails. A ten-second worker-ready timeout prevents indefinite setup waits. State refreshes when the app becomes visible after permission settings; stale checks cannot overwrite newer state. Password and notification busy states are separate.

Changes are limited to src/lib/push.ts, Account.tsx, focused browser tests and handoff. No schema, server function, schedules or dependencies changed. tests/notifications.mjs uses mocked browser subscription APIs with the real test database, covering server/current-account confirmation, subscribe errors, failed registration/read/delete, duplicate enable, VAPID decoding, reopen persistence, retry, preserving a second device, permission refresh, worker timeout and phone width. No push service is contacted by these tests.

Next actual-device step after release: open the PTPN web app in Android Chrome, go to Account, choose Turn on notifications and allow the permission prompt. Confirm the account reports on and that a device registration exists. Actual delivery and tapping the notification still require a controlled test on the phone; automated setup tests do not prove delivery. Upload reliability is the next separate review, followed by phone review of onboarding/monthly/alternatives, then dashboard improvements.


The notification release check exposed very slow Ubuntu package downloads during Playwright's unconditional --with-deps installation (earlier logs show most new packages were supplementary fonts; required browser libraries were already installed). CI now installs Chromium first and smoke-launches it, falling back to the existing --with-deps installer if launch fails. The same type/database/browser tests still run; no tests are skipped and the browser version remains Playwright's bundled version.


## Coach dashboard actions (27 October 2026)

Dashboard has a Your next actions card linking to the existing weekly and technique review queues, unread conversations and clients needing attention. Refresh dashboard reloads summary data and both review queues. Active client count, workout compliance, recent workouts and check-in totals exclude archived clients. Unread conversations retain archived clients and their correct names/reply links so messages are not hidden. The unread query no longer silently stops at 50 messages.

Attention uses the latest daily check-in in the last seven days, rather than any old low-mood entry. Training reasons explicitly describe the last 14 calendar days through today. Follow-ups are sorted by missed workouts and a low latest mood; all matching active clients remain visible. Requests have checked errors, unmount protection and a retry screen instead of false empty/all-clear results. A full 1,000-row response is treated as potentially truncated and fails visibly rather than claiming complete totals. The five upcoming sessions and latest-100 review queue scopes remain unchanged.

Changes: src/pages/coach/Dashboard.tsx, tests/dashboard.mjs, tests/e2e.mjs and this handoff. No schema, live data, dependencies or design tokens changed. Focused browser coverage checks active totals/compliance, more than 50 unread messages, archived conversations, recovered versus latest low mood, review refresh and deep links, quick navigation, request failure/retry, truncation protection and phone width. Automated release checks run in GitHub Actions. Manual visual review of this dashboard remains separate.

Device-check update: Pedro confirmed notification enablement after changing Brave's push messaging setting, then confirmed a message notification arrived in a real-device test. One server registration was verified at setup time; this does not establish that both accounts/devices are registered. Pedro also confirmed a progress photo uploaded and stayed visible after refreshing. Notification tapping and separate reminder/announcement delivery were not confirmed in these checks.


## Coach training removal and tab persistence (27 October 2026)

The coach Training list now offers Remove for skipped as well as scheduled sessions. The reported live session was skipped, which explained the missing control. A confirmation names the session/date; checked deletion is scoped to the client and excludes completed sessions atomically. Failed or zero-row deletions keep the dialog available with an error, and a synchronous guard blocks duplicate submissions. Successful removal updates the list without deleting the reusable workout. Sessions with technique feedback are refused to preserve existing media/history. Completed sessions retain no removal control. No live workout was deleted during this investigation.

ClientDetail stores the selected valid tab in the existing tab query parameter, using history replacement and preserving other query parameters. Workout back navigation, browser back and reload therefore restore Training; Nutrition/Habits/Progress are recognised too. No global tab storage or unrelated player changes.

Changed ClientDetail.tsx, tests/coach-training.mjs, tests/e2e.mjs and this handoff. Focused browser checks cover skipped removal, cancellation, failed request and retry, duplicate clicks, preservation of saved workouts/completed sessions/technique clips, a status-change race, persistent removal, workout/browser back, page reload, Nutrition and phone width. Node syntax checks run locally; release type/browser checks run in Actions. No schema, dependency or design-system changes.

Follow-up scope: selected tabs are now retained throughout authenticated navigation using usePageTab in src/hooks.ts. Valid explicit URL parameters take precedence; otherwise sessionStorage restores the preference per account, pathname and nested section. Storage failure is nonfatal and URL/back/reload behaviour still works. Only navigation selections are stored, not client drafts or health data. ClientDetail handles reviewWeek-only links as Overview intent. Shared tab memory is used by coach Library, client details, nested Progress, Train, Community, the food-entry sheet, meal-plan Week/Shopping list/day and programme weeks. Nested controls use distinct URL parameter names. Login form mode stays separate. Closing the browser session may discard tab memory.

Additional tests cover leaving and returning through unrelated pages, Library builder back links, explicit and invalid tab links, independent client selections, nested tabs, review deep-link intent, client Train/Progress/Community, food-entry tab memory and storage-blocked reloads. The existing food-log flow now explicitly selects Foods after Quick add because the user's selected tab is deliberately retained.
