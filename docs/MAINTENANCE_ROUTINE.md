# PTPN maintenance routine

Saved 1 Nov 2026 from Pedro's routine. It is sized so most of it takes minutes and Claude does the checking. Calendar reminders (Google Calendar, Pedro's primary calendar) repeat on the schedule below.

Note: the routine mentions Netlify, Cloudflare, an email system and a Wix booking sync. The app repo itself is GitHub Pages + Supabase, so check the live set-up of those services when running the checks.

## Weekly (about 10 minutes), Sundays 22:00

- Exercise suggestions: Pedro asks Claude to review the pending suggestions into the library.
- Check that things still work: log in to the app, make a test booking sync, send a test email or form. Bookings and emails are what members notice first.
- Check for errors: Claude reads the Supabase logs and the edge function errors for failed emails or syncs.

## Monthly (about 30 minutes), first Monday 10:00

- Back-ups: confirm Supabase back-ups ran, and keep a copy of the SQL record outside the project.
- Security advisories: Claude runs the Supabase security and performance checks (for example missing row-level security).
- Costs and limits: check Supabase, Netlify and email usage against free-tier limits. Deploy credits reset on 2026-11-19, so plan one batched deploy per cycle.
- Updates: check whether anything the app depends on needs updating.
- Real-device test: open the installed app on one Android and one iPhone. Service worker and caching bugs only show up on a real phone (for example the Cloudflare ERR_FAILED).

## Quarterly (about 1 hour), first Monday of Jan, Apr, Jul, Oct at 10:00

- Wix booking sync: the gym slots and paid website bookings are still untested. Do a full test of both.
- Members and accounts: remove test accounts, and review who has owner or admin access.
- Privacy and consent: check the privacy policy, terms and cookie notice still match what the app collects.
- Passwords and keys: rotate the keys you can, and check no secrets are sitting in the repo.

## Yearly (about 1 hour), 1 November

- Renew the domain and SSL, and review the pricing of each service.
- Plan the next year's features.

## Open items to fold in

- Switch on leaked-password protection in the Supabase dashboard.
- Point `www.ptpn.co.uk` at GitHub Pages (CNAME `www` to `nevespedropt-prog.github.io`) once the domain provider is known.
