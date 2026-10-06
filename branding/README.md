# PTPN logo

`ptpn-logo.svg` is the master logo, the "rising P": three bars climbing like a progress chart, the tallest one becomes a P with a red bowl. The PTPN wordmark is drawn from the same parts (see `Wordmark` in `src/components/Logo.tsx` and `pro/`). Palette: PTPN Red #E11D2E, Chalk #F4F4F5, Steel #8A8A93, Iron #0B0B0D.

Where it is used:
- `src/components/Logo.tsx` (app header, sidebar, login, loading screen, Get the app page) draws the same shapes inline.
- `public/favicon.svg` (browser tab) is a copy of the master.
- `public/icons/*.png` (install icons, iPhone Home Screen, notification icon) and `mobile/assets/*.png` (Android app icon) are generated.

To change the logo: edit `ptpn-logo.svg`, copy it to `public/favicon.svg`, mirror the shapes in `Logo.tsx`, then run `node branding/make-icons.mjs` (after `cd tests && npm ci`). Push to main; the Android app rebuilds itself when `mobile/**` changes.

Earlier concepts are kept for reference: `logo-options/` (A grid, B progress ring, used until October 2026), `logo-options-2/` (C plate, D rising P, E kettlebell), `logo-options-3/` (F steps, G motion, H ring), `pro/` (the refined rising P system, upright and forward, with lockups and the brand sheet).
