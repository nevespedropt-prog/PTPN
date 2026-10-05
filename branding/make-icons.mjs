// Regenerates every logo image from branding/ptpn-logo.svg.
// Run from the repo root after `cd tests && npm ci`:  node branding/make-icons.mjs
// Uses the Playwright Chromium from tests/ (set CHROMIUM_PATH to use another browser binary).
import { chromium } from '../tests/node_modules/playwright/index.mjs'
import fs from 'node:fs'

const root = new URL('../', import.meta.url).pathname
const svg = fs.readFileSync(root + 'branding/ptpn-logo.svg', 'utf8')
const inner = svg.replace(/<svg[^>]*>/, '').replace('</svg>', '').replace(/<title>.*?<\/title>/, '')
const art = inner.replace(/<rect width="120" height="120"[^>]*\/>/, '') // ring and letters only
const DARK = '#0b0b0d'

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {})
async function png(file, size, { content, bg = null, scale = 1 }) {
  const page = await browser.newPage({ viewport: { width: size, height: size } })
  const k = (size / 120) * scale, off = (size - 120 * k) / 2
  await page.setContent(`<body style="margin:0;background:${bg ?? 'transparent'}"><svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><g transform="translate(${off} ${off}) scale(${k})">${content}</g></svg></body>`)
  await page.screenshot({ path: root + file, omitBackground: bg === null })
  await page.close()
}

// Web app (manifest, home screen, notifications)
await png('public/icons/icon-192.png', 192, { content: inner })
await png('public/icons/icon-512.png', 512, { content: inner })
await png('public/icons/maskable-512.png', 512, { content: art, bg: DARK, scale: 0.8 }) // keeps the ring inside the safe zone
await png('public/icons/apple-touch-icon.png', 180, { content: art, bg: DARK, scale: 0.92 }) // iOS rounds the corners itself
// Android app (Capacitor assets)
await png('mobile/assets/icon-only.png', 1024, { content: art, bg: DARK, scale: 0.9 })
await png('mobile/assets/icon-foreground.png', 1024, { content: art, scale: 0.62 })
await png('mobile/assets/icon-background.png', 1024, { content: '', bg: DARK })
// Previews
await png('branding/ptpn-logo-1024.png', 1024, { content: inner })
await browser.close()
console.log('icons written')
