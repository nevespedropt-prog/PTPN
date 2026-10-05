# PTPN logo

`ptpn-logo.svg` is the master logo (option B, "progress ring"): monoline PTPN inside a ring that is nearly closed, the last stretch in red. Colours: background #0b0b0d, white #f4f4f5, red #e11d2e, ring track #24242a.

Where it is used:
- `src/components/Logo.tsx` (app header, sidebar, login, loading screen, Get the app page) draws the same shapes inline.
- `public/favicon.svg` (browser tab) is a copy of the master.
- `public/icons/*.png` (install icons, iPhone Home Screen, notification icon) and `mobile/assets/*.png` (Android app icon) are generated.

To change the logo: edit `ptpn-logo.svg`, copy it to `public/favicon.svg`, mirror the shapes in `Logo.tsx`, then run `node branding/make-icons.mjs` (after `cd tests && npm ci`). Push to main; the Android app rebuilds itself when `mobile/**` changes.

`logo-options/` keeps the two concepts that were compared (A grid monogram, B progress ring).
