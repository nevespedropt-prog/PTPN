import { supabase } from './supabase'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on'

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

function keyBytes(b64: string) {
  const pad = '='.repeat((4 - (b64.length % 4)) % 4)
  const raw = atob((b64 + pad).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, c => c.charCodeAt(0))
}

async function registration() {
  if (!('serviceWorker' in navigator)) return null
  return (await navigator.serviceWorker.getRegistration(import.meta.env.BASE_URL)) ?? null
}

export async function pushState(): Promise<PushState> {
  // iPhone and iPad only allow notifications from an app added to the Home Screen.
  if (isIOS() && !standalone()) return 'needs-install'
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'on' : 'off'
}

export async function enablePush(userId: string): Promise<string | null> {
  const perm = await Notification.requestPermission()
  if (perm !== 'granted') return 'Notifications were not allowed.'
  const reg = (await registration()) ?? (await navigator.serviceWorker.ready)
  const { data: key } = await supabase.rpc('push_public_key')
  if (!key) return 'Notifications are not set up on the server yet.'
  const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key as string) }))
  const j = sub.toJSON()
  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: userId, endpoint: sub.endpoint, p256dh: j.keys?.p256dh ?? '', auth: j.keys?.auth ?? '', user_agent: navigator.userAgent.slice(0, 200) },
    { onConflict: 'endpoint' },
  )
  return error ? error.message : null
}

export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
  await sub.unsubscribe()
}
