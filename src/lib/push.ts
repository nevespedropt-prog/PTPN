import { supabase } from './supabase'

export type PushState = 'unsupported' | 'needs-install' | 'denied' | 'off' | 'on' | 'error'

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
async function readyRegistration() {
  const existing = await registration()
  if (existing) return existing
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('push-registration-timeout')), 10000) }),
    ])
  } finally { if (timer) clearTimeout(timer) }
}

export async function pushState(userId: string): Promise<PushState> {
  if (isIOS() && !standalone()) return 'needs-install'
  if (!('Notification' in window) || !('PushManager' in window)) return 'unsupported'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub || Notification.permission !== 'granted') return 'off'
  // Browser permission alone does not prove that this account is registered on the server.
  const result = await supabase.from('push_subscriptions').select('id').eq('user_id', userId).eq('endpoint', sub.endpoint).maybeSingle()
  if (result.error) throw new Error('Could not confirm notification registration')
  return result.data ? 'on' : 'off'
}

export async function enablePush(userId: string): Promise<string | null> {
  let created: PushSubscription | null = null
  try {
    if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) return 'Notifications are not supported on this device.'
    // Keep the permission request in the button's user gesture, before network calls.
    const perm = await Notification.requestPermission()
    if (perm !== 'granted') return 'Notifications were not allowed.'
    const reg = await readyRegistration()
    const { data: key, error: keyError } = await supabase.rpc('push_public_key')
    if (keyError) return 'Could not load notification setup. Please retry when connected.'
    if (typeof key !== 'string' || !key) return 'Notifications are not set up on the server yet.'
    let sub = await reg.pushManager.getSubscription()
    if (!sub) { sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(key) }); created = sub }
    const json = sub.toJSON()
    const result = await supabase.from('push_subscriptions').upsert(
      { user_id: userId, endpoint: sub.endpoint, p256dh: json.keys?.p256dh ?? '', auth: json.keys?.auth ?? '', user_agent: navigator.userAgent.slice(0, 200) },
      { onConflict: 'endpoint' },
    )
    if (result.error) {
      if (created) { try { await created.unsubscribe() } catch { /* state check still verifies server registration */ } }
      return 'Could not save this device for notifications. Please retry when connected.'
    }
    return null
  } catch (error) {
    if (created) { try { await created.unsubscribe() } catch { /* allow a fresh state check */ } }
    return error instanceof Error && error.message === 'push-registration-timeout'
      ? 'Notification setup is taking too long. Reload the app and retry.'
      : 'Could not set up notifications on this device. Please retry.'
  }
}

export async function disablePush(userId: string): Promise<string | null> {
  try {
    const reg = await registration()
    const sub = await reg?.pushManager.getSubscription()
    if (!sub) return null
    const result = await supabase.from('push_subscriptions').delete().eq('user_id', userId).eq('endpoint', sub.endpoint)
    if (result.error) return 'Could not turn off notifications. Please retry when connected.'
    // Removing the server registration stops PTPN delivery even if local cleanup fails.
    try { await sub.unsubscribe() } catch { /* the registration is already disabled on the server */ }
    return null
  } catch { return 'Could not turn off notifications on this device. Please retry.' }
}
