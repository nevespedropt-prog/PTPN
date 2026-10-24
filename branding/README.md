# PTPN gold identity

Approved 24 October 2026: gold angular monogram with particle halo, outlined PTPN wordmark and Be fit tagline. This replaces the rising-bars red identity. Previous explorations remain historical references.

## Source and reuse

The approved image is saved in ChatGPT as Bronze PTPN Be Fit logo.png. The app copy is public/brand/ptpn-gold-approved.webp: the same composition, encoded for web delivery. It is not an editable vector drawing. No logo was re-created from text for this release.

src/components/Logo.tsx uses SVG viewports to display either the full lockup or the monogram from that approved image. The component respects the Vite base URL, including GitHub Pages /PTPN/. branding/ptpn-logo.svg is a self-contained icon wrapper with embedded artwork; public/favicon.svg uses the same wrapper. public/icons and mobile/assets contain the corresponding raster icons. Run node branding/make-icons.mjs after installing tests dependencies and Chromium to regenerate them.

For the future website reuse the approved source and this palette, with the full lockup on large surfaces and the monogram at small sizes. Retain enough dark clear space around the particle halo. Avoid stretching the artwork or adding red accents.

## Interface palette

- Charcoal background: #111112
- Surface: #171718; card: #1b1b1c
- Champagne gold: #d7b978
- Light gold: #f1dda9
- Antique gold: #b98a42
- Warm ivory text: #f4f0e8
- Muted text: #a09c94

Primary controls have dark text on a restrained gold gradient. Secondary controls use charcoal surfaces and fine warm borders. Error, success and nutrition colours keep their separate meanings. Touch controls remain at least 44px where applicable. Reduced-motion preferences are respected.

Service-worker version ptpn-gold-v3 refreshes old brand assets. It caches static brand files, never Supabase data. Existing installed home-screen icons can take time to refresh; reinstalling the shortcut may be necessary on some phones. The Android workflow rebuilds when mobile assets change.
