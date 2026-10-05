import { useEffect, useState } from 'react'
import Icon from './Icon'

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> }

const standalone = () => window.matchMedia('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true
// iPadOS reports as a Mac with touch points.
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** "Install the app" card: one tap on Android and desktop Chrome, step-by-step on iPhone and iPad. Hidden once installed. */
export function InstallCard() {
  const [evt, setEvt] = useState<InstallEvent | null>(null)
  const [installed, setInstalled] = useState(standalone())
  const [help, setHelp] = useState(false)
  useEffect(() => {
    const before = (e: Event) => { e.preventDefault(); setEvt(e as InstallEvent) }
    const done = () => { setInstalled(true); setEvt(null) }
    window.addEventListener('beforeinstallprompt', before)
    window.addEventListener('appinstalled', done)
    return () => { window.removeEventListener('beforeinstallprompt', before); window.removeEventListener('appinstalled', done) }
  }, [])
  if (installed) return null
  const ios = isIOS()
  if (!evt && !ios) return null
  return (
    <div className="card">
      <div className="row nowrap" style={{ gap: 14 }}>
        <span className="avatar" style={{ width: 44, height: 44, borderRadius: 12, background: 'rgba(255,255,255,.06)' }}><Icon name="plus" size={20} /></span>
        <span className="grow"><b>Install the app</b><br /><span className="mute small">Opens full screen from your home screen</span></span>
        {evt
          ? <button className="sm" onClick={async () => { await evt.prompt(); await evt.userChoice; setEvt(null) }}>Install</button>
          : <button className="sm soft" onClick={() => setHelp(!help)}>{help ? 'Hide' : 'How'}</button>}
      </div>
      {help && <ol className="small" style={{ margin: '12px 0 0', paddingLeft: 20, lineHeight: 1.7 }}>
        <li>Open this page in Safari.</li>
        <li>Tap the Share button (the square with an arrow).</li>
        <li>Scroll down and tap Add to Home Screen, then Add.</li>
      </ol>}
    </div>
  )
}

/** Thin bar shown while the phone has no connection. */
export function OfflineBar() {
  const [off, setOff] = useState(!navigator.onLine)
  useEffect(() => {
    const on = () => setOff(false), out = () => setOff(true)
    window.addEventListener('online', on); window.addEventListener('offline', out)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', out) }
  }, [])
  if (!off) return null
  return <div className="offline-bar" role="status">You are offline. Changes will not save until you reconnect.</div>
}
