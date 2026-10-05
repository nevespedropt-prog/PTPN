# PTPN tests

Two suites, both run against an in-memory Postgres ([PGlite](https://pglite.dev)) loaded with the real `supabase/schema.sql` and the seed files. No Supabase project, no network.

- `db.test.mjs`: row-level security and seed checks (who can read or write what, library counts, cascading deletes).
- `e2e.mjs`: drives the built app in Chromium through the coach and client flows (add client, assign workouts, workout player, nutrition, meal plans, chat, photos, menu). `shim.mjs` is a small Supabase-compatible HTTP server on top of PGlite that the app talks to.

## Run

```bash
cd tests
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install
npm run test:db

# browser tests: build the app against the local shim, then run
npm run build:e2e
CHROMIUM_PATH=/path/to/chromium npm run test:e2e   # CHROMIUM_PATH is optional if Playwright's own browser is installed
```

`npm test` runs all three steps. Screenshots from the browser run land in `tests/.out/shots` (ignored by git).

## On GitHub

`.github/workflows/test.yml` runs the type check and both suites on every pull request and on every push to `main`. Screenshots from the browser run are kept for 7 days as the `e2e-screenshots` artifact on each run.

## When you change things

- New seed file: load it in `db.test.mjs` and `shim.mjs`, and update the library counts in both (recipes, foods, photos) and `e2e.mjs` (recipe cards).
- Schema change: add checks for the new table's policies in `db.test.mjs`.
- The e2e flows use today's date. They are written to hold on any weekday.
