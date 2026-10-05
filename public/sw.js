// PTPN service worker: keeps the app shell available offline.
// Data calls (Supabase) are never cached, so nothing stale or private is stored.
const VERSION = 'ptpn-v1'
const SHELL = VERSION + '-shell'
const ASSETS = VERSION + '-assets'
const IMAGES = VERSION + '-images'
const MAX_IMAGES = 80

self.addEventListener('install', e => {
  e.waitUntil(caches.open(SHELL).then(c => c.add(new Request('./', { cache: 'reload' }))).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => !k.startsWith(VERSION)).map(k => caches.delete(k)))).then(() => self.clients.claim()),
  )
})

async function trim(name, max) {
  const c = await caches.open(name)
  const keys = await c.keys()
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i])
}

self.addEventListener('fetch', e => {
  const req = e.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)

  // Page loads: network first, fall back to the cached shell when offline.
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req).then(res => {
        const copy = res.clone()
        caches.open(SHELL).then(c => c.put('./', copy))
        return res
      }).catch(() => caches.match('./')),
    )
    return
  }

  // Built files have hashed names, so cache-first is safe.
  if (url.origin === location.origin && url.pathname.includes('/assets/')) {
    e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone(); caches.open(ASSETS).then(c => c.put(req, copy)); return res
    })))
    return
  }

  // Fonts and recipe photos: show the saved copy, refresh in the background.
  const isFont = url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'
  const isPhoto = url.hostname === 'images.pexels.com'
  if (isFont || isPhoto) {
    const name = isPhoto ? IMAGES : ASSETS
    e.respondWith(caches.open(name).then(async c => {
      const hit = await c.match(req)
      const net = fetch(req).then(res => { if (res.ok || res.type === 'opaque') { c.put(req, res.clone()); if (isPhoto) trim(IMAGES, MAX_IMAGES) } return res }).catch(() => hit)
      return hit || net
    }))
  }
})
