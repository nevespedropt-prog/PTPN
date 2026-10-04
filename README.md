# PTPN

Web app for PTPN personal training clients and their coach. React + Vite + TypeScript, Supabase backend.

- Clients: view their programme, log weight and body fat with trend charts, book PT sessions.
- Coach: see all clients, build programmes, view client progress, manage session slots.

## Setup

1. Create a Supabase project and run `supabase/schema.sql` in the SQL Editor.
2. Copy `.env.example` to `.env` and fill in the project URL and anon key.
3. `npm install` then `npm run dev`.
4. Sign up in the app, then make yourself the coach (SQL at the bottom of `schema.sql`).

New sign-ups are always clients. Roles can only be changed by a coach or in the dashboard.

## Deploy (GitHub Pages)

The workflow in `.github/workflows/deploy.yml` builds and publishes on every push to `main`.

1. Repo Settings > Pages > Source: GitHub Actions.
2. Repo Settings > Secrets and variables > Actions > Variables: add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is public by design, so a variable is fine.
3. In Supabase > Authentication > URL Configuration, set the Site URL to the Pages address.
